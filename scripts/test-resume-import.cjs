// Run after npm run build: npx electron scripts/test-resume-import.cjs
const {app,BrowserWindow,ipcMain,session,clipboard}=require('electron');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {extractPdf,pdfError,readPdf}=require('../electron/resume-pdf.cjs');
app.on('window-all-closed',()=>{});
const root=path.resolve(__dirname,'..');
let stored=null,failSave=false,failExtract=false,fixture;
const body='姓名：测试用户\n邮箱 demo@example.com\n\n• 完整项目文字  保留空格\n不分类的其他内容';
ipcMain.on('sync:open',e=>{e.returnValue={ok:true,data:{token:'resume-test',data:stored,warning:''}};});
ipcMain.on('sync:save',(e,token,next)=>{assert.equal(token,'resume-test');if(failSave){failSave=false;e.returnValue={ok:false,error:'simulated failure'};return;}stored=structuredClone(next);e.returnValue={ok:true,data:true};});
ipcMain.on('sync:legacy-summary',e=>{e.returnValue={ok:true,data:{available:false,count:0,hasProfile:false}};});
ipcMain.handle('update:check',()=>({available:false}));
ipcMain.handle('resume:pick',()=>({name:'演示.pdf',path:fixture,updatedAt:new Date().toISOString()}));
ipcMain.handle('resume:read',async()=>({ok:true,data:new Uint8Array(await fs.readFile(fixture))}));
ipcMain.handle('resume:extract',()=>failExtract?{ok:false,error:'文件损坏'}:{ok:true,data:{text:body,pages:[{number:1,method:'text',text:body}],totalPages:1,processedPages:1,warnings:[]}});
// Minimal real PDF: exercises the actual text extractor and renderer without dependencies or personal files.
function pdf(objects){let data='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(data,'latin1'));data+=`${i+1} 0 obj\n${object}\nendobj\n`;});const start=Buffer.byteLength(data,'latin1');data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(data,'latin1');}
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'resume-test-'));app.setPath('userData',temp);await app.whenReady();console.log('Starting PDF and OCR checks');fixture=path.join(temp,'resume.pdf');
 const win=new BrowserWindow({width:1280,height:820,show:false,webPreferences:{preload:path.join(root,'electron/preload.cjs'),sandbox:true,backgroundThrottling:false}});
 const stream='BT /F1 24 Tf 50 700 Td (Resume test) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 await fs.writeFile(fixture,pdf(objects));
 const resources={macOcr:path.join(root,'build/ocr-mac'),tempDirectory:temp};
 assert.match(pdfError({name:'PasswordException'}),/加密/);assert.match(pdfError({name:'InvalidPDFException'}),/损坏/);assert.match(pdfError({code:'EACCES'}),/权限/);await assert.rejects(readPdf(path.join(temp,'missing.pdf')),error=>pdfError(error).includes('不存在'));
 assert.equal((await extractPdf(fixture,resources)).text,'Resume test');console.log('Text PDF passed');
 if(process.platform==='darwin'){
  const {createCanvas}=require('@napi-rs/canvas');const canvas=createCanvas(1200,800),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,800);ctx.fillStyle='black';ctx.font='60px Arial';ctx.fillText('RESUME TEST',80,150);ctx.fillText('Software Engineer',80,250);const jpg=canvas.toBuffer('image/jpeg');
  const draw='q 600 0 0 400 0 0 cm /Im0 Do Q';
  const scanned=pdf([objects[0],objects[1],'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',`<< /Type /XObject /Subtype /Image /Width 1200 /Height 800 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n${jpg.toString('latin1')}\nendstream`,`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
  const scanPath=path.join(temp,'scan.pdf');await fs.writeFile(scanPath,scanned);const result=await extractPdf(scanPath,resources);assert.match(result.text,/RESUME TEST/);assert.match(result.text,/Software Engineer/);assert.equal(result.pages[0].method,'ocr');console.log('Mac scan OCR passed');
 }
 await app.whenReady();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,done)=>done({cancel:true}));

 const evaluate=code=>win.webContents.executeJavaScript(code),wait=()=>new Promise(r=>setTimeout(r,150));
 const click=async label=>{for(let i=0;i<50&&!await evaluate(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(label)})`);i++)await wait();await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);await wait();};
 const text=()=>evaluate(`document.querySelector('[aria-label="个人信息全文"]').value`);
 try{
  console.log('Loading UI');await win.loadFile(path.join(root,'dist/index.html'));console.log('UI loaded');await wait();await click('个人信息');assert.equal(await evaluate("Array.from(document.querySelectorAll('nav button')).filter(b=>b.textContent==='简历').length"),0);await click('编辑正文');await evaluate(`var area=document.querySelector('[aria-label="个人信息全文"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'无需PDF的个人信息');area.dispatchEvent(new Event('input',{bubbles:true}));`);await wait();await click('确认保存全文');assert.equal(stored.resume.text,'无需PDF的个人信息');assert.equal(stored.resume.path,'');const profile=JSON.stringify(stored.remote);await click('导入PDF');assert.equal(stored.resume.text,'无需PDF的个人信息');assert.equal(await text(),body);
  await click('投递记录');await click('个人信息');assert.equal(await text(),body);
  win.show();win.focus();await wait();await click('复制全文');assert.ok(clipboard.readText()===body,'复制内容应与整篇正文一致');
  failSave=true;await click('确认保存全文');assert.equal(stored.resume.text,'无需PDF的个人信息');assert.equal(await text(),body);assert.match(await evaluate("document.querySelector('[role=alert]').textContent"),/保存失败/);
  await click('确认保存全文');console.log('Save retry passed');assert.equal(stored.resume.text,body);assert.equal(stored.resume.originalText,body);assert.equal(JSON.stringify(stored.remote),profile);
  await click('编辑正文');await evaluate(`var area=document.querySelector('[aria-label="个人信息全文"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'手动修改');area.dispatchEvent(new Event('input',{bubbles:true}));`);await wait();assert.equal(await text(),'手动修改');await click('确认保存全文');assert.equal(stored.resume.text,'手动修改');
  await win.loadFile(path.join(root,'dist/index.html'));await wait();await click('个人信息');assert.equal(await text(),'手动修改');await click('编辑正文');await click('恢复提取原文');assert.equal(await text(),body);await click('取消');assert.equal(await text(),'手动修改');
  failExtract=true;await click('重新读取');assert.equal(await text(),'手动修改');assert.equal(stored.resume.text,'手动修改');failExtract=false;await click('替换PDF');assert.equal(await text(),body);await click('取消');assert.equal(await text(),'手动修改');
  console.log('Data retention passed');await click('原版');for(let i=0;i<50&&!await evaluate("Boolean(document.querySelector('.resume-pdf canvas'))");i++)await wait();assert.ok(await evaluate("Boolean(document.querySelector('.resume-pdf canvas'))"),await evaluate("document.querySelector('.resume-pdf')?.textContent"));await wait();
  await fs.mkdir(path.join(root,'work'),{recursive:true});await fs.writeFile(path.join(root,'work/resume-original.png'),(await win.webContents.capturePage()).toPNG());await click('文字');await click('编辑正文');await click('恢复提取原文');await fs.writeFile(path.join(root,'work/resume-whole-preview.png'),(await win.webContents.capturePage()).toPNG());
  assert.ok(await evaluate("document.querySelector('main').scrollHeight<=document.querySelector('main').clientHeight+1"),'简历页不应出现第二个主滚动条');win.setSize(920,640);await wait();assert.ok(await evaluate("document.querySelector('.resume-body').clientHeight>100"),'小窗口应保留可用正文区');
  console.log('PASS: real PDF extraction, Mac scan OCR, original PDF rendering, exact copy/save, failed save retry, edit/reload, restore, cancel, failed extraction and navigation retain data.');
 }finally{win.destroy();await session.defaultSession.clearStorageData();await fs.rm(temp,{recursive:true,force:true});}
 app.quit();
})().catch(error=>{console.error(error);app.exit(1);});
