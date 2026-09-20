const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8');

function desktop(platform, isPackaged) {
  const paths = { appData:path.resolve('/users/test/Library/Application Support'), exe:path.resolve('/Applications/招迹.app/Contents/MacOS/招迹') };
  const handlers = {}, opened = [];
  const app = { isPackaged, setName(){}, getPath:key=>paths[key], setPath:(key,value)=>{paths[key]=value;}, getAppPath:()=>path.resolve('/projects/campus-flow'), requestSingleInstanceLock:()=>false, quit(){}, on(){}, getVersion:()=> '1.0.15' };
  const electron = { app, ipcMain:{ handle:(name,fn)=>{handlers[name]=fn;}, on(){} }, shell:{openExternal:async url=>{opened.push(url);}} };
  vm.runInNewContext(source, {
    require:name=>{
      if(name==='electron')return electron;
      if(name==='electron-updater')return {autoUpdater:{checkForUpdates:()=>assert.fail('Mac 应打开下载页')}};
      if(name==='@napi-rs/canvas')return {};
      return require(name.startsWith('./')?path.join(__dirname,'../electron',name):name);
    },
    process:{platform,env:{}},
    fetch:async()=>({ok:true,json:async()=>({tag_name:'v1.0.16'})}),
    __dirname:path.join(__dirname,'../electron'),
  });
  return {paths,handlers,opened};
}

test('Mac 安装版数据写到用户目录，开发版和 Windows 保持原数据位置', () => {
  assert.equal(desktop('darwin',true).paths.userData,path.resolve('/users/test/Library/Application Support/招迹'));
  assert.equal(desktop('darwin',false).paths.userData,path.resolve('/projects/招迹数据'));
  assert.equal(desktop('win32',true).paths.userData,path.resolve('/Applications/招迹.app/Contents/招迹数据'));
});

test('Mac 更新打开下载页，不执行需要开发者签名的自动替换', async () => {
  const {handlers,opened}=desktop('darwin',true);
  assert.equal(await handlers['update:install'](),true);
  assert.deepEqual(opened,['https://github.com/wuzenghui27-wq/campus-flow/releases/latest']);
});
