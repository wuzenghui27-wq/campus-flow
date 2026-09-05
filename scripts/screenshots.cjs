// Real production UI; fictional data stays in memory, separate from user data.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
app.setPath('userData', path.join(root, 'work', 'screenshots'));
const applications = [
  ['星河科技（演示）','前端开发工程师','上海','面试'],
  ['星河科技（演示）','客户端开发工程师','上海','笔试'],
  ['青禾网络（演示）','软件开发工程师','杭州','已投递'],
  ['云帆软件（演示）','前端开发工程师','深圳','录用'],
  ['远山信息（演示）','测试开发工程师','北京','未通过'],
].map(([company,role,location,status], i) => ({ id:String(i), company, role, location, status, website:'https://example.com', appliedAt:`2026-09-0${5-i}` }));
ipcMain.on('data:initial', e => { e.returnValue = { status:'loaded', source:'main', file:'演示数据（仅内存）', data:{ applications } }; });
ipcMain.handle('update:check', () => ({ available:false, version:'' }));
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls:['http://*/*','https://*/*'] }, (_, done) => done({ cancel:true }));
  const win = new BrowserWindow({ width:1280, height:820, show:false, frame:false, webPreferences:{ preload:path.join(root,'electron','preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true, backgroundThrottling:false } });
  await win.loadFile(path.join(root,'dist','index.html'));
  const output = path.join(root,'docs','screenshots');
  await fs.mkdir(output, { recursive:true });
  for (const [label,name] of [['工作台','dashboard'],['投递记录','applications'],['数据统计','statistics'],['已投递公司统计','companies']]) {
    await win.webContents.executeJavaScript(`document.querySelectorAll('nav button').forEach(b => { if(b.textContent === ${JSON.stringify(label)}) b.click(); })`);
    await new Promise(resolve => setTimeout(resolve, 300));
    await fs.writeFile(path.join(output,`${name}.png`), (await win.webContents.capturePage()).toPNG());
  }
  win.destroy(); app.quit();
}).catch(error => { console.error(error); app.exit(1); });
