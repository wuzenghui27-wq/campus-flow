const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createCanvas } = require('@napi-rs/canvas');
const { execFile } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { migrateStore, readStore, writeStore } = require('./store.cjs');

const appDataRoot = app.getPath('appData');
app.setName('招迹');
app.setPath('userData', path.join(appDataRoot, '招迹'));
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win?.isMinimized()) win.restore();
  win?.show();
  win?.focus();
});

const dataFile = () => path.join(app.getPath('userData'), 'data.json');
ipcMain.handle('data:load', () => readStore(dataFile()));
ipcMain.handle('data:save', (_event, patch) => writeStore(dataFile(), patch));

async function recognizeImage(filePath) {
  const script = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'ocr.ps1')
    : path.join(__dirname, 'ocr.ps1');
  return new Promise((resolve, reject) => execFile('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Path', filePath,
  ], { encoding:'utf8', windowsHide:true, maxBuffer:4 * 1024 * 1024 }, (error, stdout) => {
    if (error) reject(error); else resolve(stdout.replace(/([\u3400-\u9fff\d])\s+(?=[\u3400-\u9fff\d])/g, '$1').replace(/\s*([@.])\s*/g, '$1'));
  }));
}

ipcMain.handle('resume:pick', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '简历文件', extensions: ['pdf'] }] });
  if (result.canceled) return null;
  const filePath = path.resolve(result.filePaths[0]);
  return { name: path.basename(filePath), path: filePath, updatedAt: new Date().toISOString() };
});

ipcMain.handle('resume:open', async (_event, requestedPath) => {
  if (typeof requestedPath !== 'string' || path.extname(requestedPath).toLowerCase() !== '.pdf') return false;
  const filePath = path.resolve(requestedPath);
  try {
    if (!(await fs.stat(filePath)).isFile()) return false;
    return (await shell.openPath(filePath)) === '';
  } catch { return false; }
});

ipcMain.handle('resume:extract', async (_event, requestedPath) => {
  if (typeof requestedPath !== 'string' || path.extname(requestedPath).toLowerCase() !== '.pdf') return null;
  try {
    const filePath = path.resolve(requestedPath);
    if (!(await fs.stat(filePath)).isFile()) return null;
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await getDocument({ data: new Uint8Array(await fs.readFile(filePath)), useSystemFonts: true }).promise;
    const pages = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const content = await (await document.getPage(number)).getTextContent();
      pages.push(content.items.map(item => 'str' in item ? item.str : '').join('\n'));
    }
    const embeddedText = pages.join('\n');
    if (embeddedText.replace(/\s/g, '').length >= 20) {
      await document.cleanup();
      return embeddedText;
    }
    const recognized = [];
    for (let number = 1; number <= Math.min(document.numPages, 4); number += 1) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const imagePath = path.join(app.getPath('temp'), `campus-flow-ocr-${randomUUID()}.png`);
      try {
        await fs.writeFile(imagePath, canvas.toBuffer('image/png'));
        recognized.push(await recognizeImage(imagePath));
      } finally { await fs.unlink(imagePath).catch(() => {}); }
    }
    await document.cleanup();
    return recognized.join('\n');
  } catch { return null; }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#f6f5ef',
    icon: path.join(__dirname, '../build/icon.png'),
    frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { const target = new URL(url); if (['http:','https:'].includes(target.protocol)) shell.openExternal(target.toString()); } catch {}
    return { action:'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file:')) event.preventDefault(); });
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

ipcMain.on('window:minimize', event => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on('window:toggle-maximize', event => { const win = BrowserWindow.fromWebContents(event.sender); if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); });
ipcMain.on('window:close', event => BrowserWindow.fromWebContents(event.sender)?.close());

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  await migrateStore(path.join(appDataRoot, '校招迹', 'data.json'), dataFile()).catch(() => {});
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, ({ url }, callback) => {
    const host = new URL(url).hostname;
    callback({ cancel:!(host === 'github.com' || host.endsWith('.github.com') || host.endsWith('.githubusercontent.com')) });
  });
  createWindow();
  if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 3000);
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
