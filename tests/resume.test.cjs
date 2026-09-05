const test=require('node:test');
const assert=require('node:assert/strict');
const {layoutText,extractPages}=require('../electron/resume-layout.cjs');
const word=(text,x,y,width=40)=>({text,x,y,width,height:12});
test('坐标合并拆碎中文、保留段落与双栏阅读顺序',()=>{
  assert.equal(layoutText([word('育',12,10,12),word('教',0,10,12),word('项目经历',0,50)],600),'教育\n\n项目经历');
  const items=[word('教育经历',20,10),word('示例大学',20,30),word('本科',20,50),word('项目经历',340,10),word('演示项目',340,30),word('• 实现功能',340,50)];
  assert.equal(layoutText(items,600),'教育经历\n示例大学\n本科\n\n项目经历\n演示项目\n• 实现功能');
});
test('混合 PDF 按页 OCR，四页限制明确返回未处理页',async()=>{
  let calls=0;
  const document={numPages:7,getPage:async n=>({getTextContent:async()=>({items:n===1?[{str:'这是包含足够文字无需扫描识别的正常文字版简历页面',transform:[1,0,0,1,20,20],width:450,height:12}]:[]}),getViewport:()=>({width:600,convertToViewportPoint:(x,y)=>[x,y]})})};
  const result=await extractPages(document,async()=>{calls++;return {words:[word('教育经历',0,0),word('示例大学',0,20)],width:600};});
  assert.equal(calls,4);assert.equal(result.pages[0].method,'text');assert.equal(result.pages[1].method,'ocr');assert.equal(result.processedPages,5);assert.equal(result.pages.filter(p=>p.method==='skipped').length,2);assert.ok(result.warnings.some(w=>w.includes('2 页未处理')));
  const failed=await extractPages({...document,numPages:2},async()=>{throw new Error('OCR failed');});
  assert.equal(failed.pages[1].method,'error');assert.equal(failed.processedPages,1);
});
