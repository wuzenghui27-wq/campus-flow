const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createCanvas } = require('@napi-rs/canvas');
const { execFile, spawn } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { flushWrites, loadStore, recoverStore, writeStore } = require('./store.cjs');
const { isNewerVersion } = require('./update.cjs');

app.setName('招迹');
const roamingDirectory = app.getPath('appData');
const userDataDirectory = 'E:\\code学习\\招迹数据';
app.setPath('userData', userDataDirectory);
app.setPath('sessionData', path.join(userDataDirectory, '会话'));
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win?.isMinimized()) win.restore();
  win?.show();
  win?.focus();
});

const dataFile = path.join(userDataDirectory, 'data.json');
const previousDataFile = path.join(roamingDirectory, '招迹', 'data.json');
const legacyDataFile = path.join(roamingDirectory, '校招迹', 'data.json');
let storeState = { status:'error', source:'none', data:null };
let dataWrites = Promise.resolve();
const describeState = state => ({ ...state, file:dataFile });
ipcMain.on('data:initial', event => { event.returnValue = describeState(storeState); });
ipcMain.handle('data:retry', async () => { await dataWrites; storeState = await loadStore(dataFile, [previousDataFile, legacyDataFile]); return describeState(storeState); });
ipcMain.handle('data:recover', async () => {
  await dataWrites;
  const data = await recoverStore(dataFile, [previousDataFile, legacyDataFile]);
  storeState = data ? { status:'loaded', source:'recovery', data } : await loadStore(dataFile, [previousDataFile, legacyDataFile]);
  return describeState(storeState);
});
ipcMain.handle('data:save', async (_event, patch) => {
  const result = dataWrites.then(async () => {
    if (storeState.status === 'error') throw new Error('Local data is unavailable');
    const data = await writeStore(dataFile, patch, storeState.data ?? {});
    storeState = { status:'loaded', source:'main', data };
    return data;
  });
  dataWrites = result.catch(() => {});
  return result;
});
ipcMain.handle('data:open-directory', async () => (await shell.openPath(path.dirname(dataFile))) === '');

async function latestRelease() {
  const response = await fetch('https://api.github.com/repos/wuzenghui27-wq/campus-flow/releases/latest', { headers:{ Accept:'application/vnd.github+json', 'User-Agent':'招迹' } });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  const release = await response.json();
  return { ...release, version:String(release.tag_name).replace(/^v/,'') };
}

ipcMain.handle('update:check', async () => {
  try { const release = await latestRelease(); return { available:isNewerVersion(release.version, app.getVersion()), version:release.version }; }
  catch { return { available:false, version:'' }; }
});

ipcMain.handle('update:install', async () => {
  try {
    const release = await latestRelease();
    if (!isNewerVersion(release.version, app.getVersion())) return false;
    if (!process.env.PORTABLE_EXECUTABLE_FILE) {
      autoUpdater.autoDownload = false;
      const result = await autoUpdater.checkForUpdates();
      if (!result?.updateInfo || !isNewerVersion(result.updateInfo.version, app.getVersion())) return false;
      autoUpdater.once('update-downloaded', () => autoUpdater.quitAndInstall(false, true));
      await autoUpdater.downloadUpdate();
      return true;
    }
    const asset = release.assets.find(item => item.name === `campus-flow-${release.version}-portable.exe`);
    if (!asset || asset.size > 200 * 1024 * 1024) return false;
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) return false;
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== asset.size) return false;
    if (asset.digest?.startsWith('sha256:') && createHash('sha256').update(data).digest('hex') !== asset.digest.slice(7)) return false;
    const source = path.join(app.getPath('temp'), `招迹-${release.version}-${randomUUID()}.exe`);
    const target = path.resolve(process.env.PORTABLE_EXECUTABLE_FILE);
    await fs.writeFile(source, data);
    const script = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'update.ps1') : path.join(__dirname, 'update.ps1');
    spawn('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Source',source,'-Target',target,'-RunningId',String(process.pid)], { detached:true, stdio:'ignore', windowsHide:true }).unref();
    setImmediate(() => app.quit());
    return true;
  } catch { return false; }
});

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
  let closing = false;
  win.on('close', event => {
    if (closing) return;
    event.preventDefault();
    Promise.all([dataWrites, flushWrites()]).finally(() => { closing = true; win.close(); });
  });
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

ipcMain.on('window:minimize', event => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on('window:toggle-maximize', event => { const win = BrowserWindow.fromWebContents(event.sender); if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); });
ipcMain.on('window:close', event => BrowserWindow.fromWebContents(event.sender)?.close());

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  storeState = await loadStore(dataFile, [previousDataFile, legacyDataFile]);
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, ({ url }, callback) => {
    const host = new URL(url).hostname;
    callback({ cancel:!(host === 'github.com' || host.endsWith('.github.com') || host.endsWith('.githubusercontent.com')) });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
