const {registerSyncStore}=require('./sync-store.cjs');
const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { loadStore } = require('./store.cjs');
const { isNewerVersion } = require('./update.cjs');
const {readPdf,extractPdf,pdfError} = require('./resume-pdf.cjs');

app.setName('招迹');
const roamingDirectory = app.getPath('appData');
const applicationDirectory = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
const userDataDirectory = app.isPackaged && process.platform === 'darwin'
  ? path.join(roamingDirectory, '招迹')
  : path.resolve(applicationDirectory, '..', '招迹数据');
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
    if (process.platform === 'darwin') {
      await shell.openExternal('https://github.com/wuzenghui27-wq/campus-flow/releases/latest');
      return true;
    }
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

ipcMain.handle('resume:pick', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '简历文件', extensions: ['pdf'] }] });
  if (result.canceled) return null;
  const filePath = path.resolve(result.filePaths[0]);
  return { name: path.basename(filePath), path: filePath, updatedAt: new Date().toISOString() };
});

ipcMain.handle('resume:read', async (_event, filePath) => {
  try {return {ok:true,data:await readPdf(filePath)};}
  catch(error) {return {ok:false,error:pdfError(error)};}
});

ipcMain.handle('resume:extract', async (_event, filePath) => {
  try {
    const data=await extractPdf(filePath, {
      macOcr:app.isPackaged ? path.join(process.resourcesPath,'ocr-mac') : path.join(app.getAppPath(),'build','ocr-mac'),
      windowsOcr:app.isPackaged ? path.join(process.resourcesPath,'app.asar.unpacked','electron','ocr.ps1') : path.join(__dirname,'ocr.ps1'),
      tempDirectory:path.join(userDataDirectory,'识别临时文件'),
    });
    return {ok:true,data};
  } catch(error) {return {ok:false,error:pdfError(error)};}
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
  registerSyncStore({ipcMain,directory:userDataDirectory,readLegacy:()=>storeState});

  storeState = await loadStore(dataFile, [previousDataFile, legacyDataFile]);
    session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    ({ url }, callback) => {
      const target = new URL(url);
      const host = target.hostname;

      const isGitHub = host === 'github.com'
        || host.endsWith('.github.com')
        || host.endsWith('.githubusercontent.com');

      const isFirebase = target.protocol === 'https:' && [
        'identitytoolkit.googleapis.com',
        'securetoken.googleapis.com',
        'firestore.googleapis.com',
      ].includes(host);

      callback({ cancel: !(isGitHub || isFirebase) });
    },
  );
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
