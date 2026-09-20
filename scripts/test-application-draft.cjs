// Run after npm run build: npx electron scripts/test-application-draft.cjs
// Production UI, isolated Electron profile, fictional records held only in memory.
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let stored=null;
const applications=()=>Object.values(stored?.remote??{}).filter(entry=>entry.kind==='application'&&!entry.deleted).map(entry=>entry.value);
let saves=0, attempts=0, failNextSave=false;
ipcMain.on('data:initial',e=>{e.returnValue={status:'empty',source:'none',file:'测试数据（仅内存）',data:null};});
ipcMain.handle('update:check',()=>({available:false}));
ipcMain.on('sync:open',(event,uid)=>{assert.equal(uid,null,'测试只能打开未登录工作区');event.returnValue={ok:true,data:{token:'draft-test',data:stored,warning:''}};});
ipcMain.on('sync:save',(event,token,next)=>{
  assert.equal(token,'draft-test');assert.equal(next.uid,null);attempts++;
  if(failNextSave){failNextSave=false;event.returnValue={ok:false,error:'simulated write failure'};return;}
  stored=structuredClone(next);saves++;event.returnValue={ok:true,data:true};
});
ipcMain.on('sync:legacy-summary',event=>{event.returnValue={ok:true,data:{available:false,count:0,hasProfile:false}};});
ipcMain.on('sync:legacy-claim',event=>{event.returnValue={ok:false,error:'测试中禁止导入真实旧记录'};});
(async()=>{
  const userData=await fs.mkdtemp(path.join(os.tmpdir(),'campus-flow-draft-'));
  app.setPath('userData',userData);
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,done)=>done({cancel:true}));
  const win=new BrowserWindow({width:1280,height:820,show:false,webPreferences:{preload:path.join(root,'electron','preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  const evaluate=code=>win.webContents.executeJavaScript(code);
  const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
  const click=async label=>{await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);await wait();};
  const fields=()=>evaluate("document.querySelector('form.modal') ? Object.fromEntries(new FormData(document.querySelector('form.modal'))) : null");
  const draft={company:'草稿测试公司',role:'前端工程师',website:'https://example.com/',location:'上海',appliedAt:'2026-09-20',status:'面试'};
  const fill=()=>evaluate(`Object.entries(${JSON.stringify(draft)}).forEach(([name,value])=>{const input=document.querySelector('form.modal').elements.namedItem(name);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})`);
  const preserve=async()=>{
    await evaluate("document.querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));document.querySelector('.modal-backdrop')?.click()");
    await wait();assert.deepEqual(await fields(),draft,'背景点击必须保留表单');
    await evaluate("window.dispatchEvent(new Event('offline'));window.dispatchEvent(new Event('online'))");await wait();
    assert.deepEqual(await fields(),draft,'同步状态重绘后必须保留表单');
    win.show();
    const cover=new BrowserWindow({width:1280,height:820,show:true});
    cover.focus();await wait();
    assert.deepEqual(await fields(),draft,'被另一窗口覆盖和失焦后必须保留表单');
    cover.destroy();win.hide();await wait();win.show();await wait();
    assert.deepEqual(await fields(),draft,'隐藏及恢复窗口后必须保留表单');
  };
  try {
    await win.loadFile(path.join(root,'dist','index.html'));
    for(let tries=0;tries<50&&!await evaluate("Boolean(document.querySelector('nav'))");tries++)await wait();
    assert.ok(stored,'工作区初始化成功');saves=0;attempts=0;await click('投递记录');
    await click('新增投递');await fill();await preserve();assert.equal(saves,0);
    await evaluate("document.querySelector('form.modal [aria-label=关闭]').click()");await wait();
    assert.equal(await fields(),null,'明确关闭会取消草稿');assert.equal(saves,0);
    await click('新增投递');assert.equal((await fields()).company,'','关闭后再次新增应为空');
    await fill();failNextSave=true;
    await evaluate("const form=document.querySelector('form.modal');form.requestSubmit();form.requestSubmit()");await wait();
    assert.equal(attempts,1,'保存期间重复提交只写入一次');
    assert.deepEqual(await fields(),draft,'保存失败必须保留全部输入');assert.equal(applications().length,0);assert.equal(saves,0);
    assert.equal(await evaluate("document.querySelectorAll('.record-row').length"),0,'失败后不能显示虚假的已保存记录');
    assert.ok(await evaluate("document.querySelector('form.modal [role=alert]').textContent.includes('保存失败')"));
    await click('保存投递');assert.equal(await fields(),null,'重试保存成功后关闭表单');
    assert.equal(applications().length,1);assert.equal(applications()[0].company,draft.company);
    for(const label of ['编辑','为该公司新增职位']) {
      await evaluate(`document.querySelector('.record-row [aria-label="${label}"]').click()`);await wait();
      await fill();await preserve();await click(label==='编辑'?'保存投递':'另存投递');
      assert.equal(await fields(),null);
    }
    assert.equal(applications().length,2);assert.equal(saves,3);assert.equal(attempts,4);
    console.log('PASS: new, edit and duplicate drafts survive background clicks, covering windows, blur, hide/show and sync-status rerenders; failed save preserves inputs with an error, retry succeeds, duplicate submits write once, and only close/successful save dismisses.');
  } finally {
    win.destroy();await session.defaultSession.clearStorageData();await fs.rm(userData,{recursive:true,force:true});
  }
  app.quit();
})().catch(error=>{console.error(error);app.exit(1);});
