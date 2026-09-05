// Coordinates use a top-left origin for both PDF and Windows OCR words.
function layoutText(items, width) {
  const words = items.filter(i => typeof i.text === 'string' && i.text.trim() && [i.x,i.y,i.width,i.height].every(Number.isFinite));
  if (!words.length) return '';
  function lines(group) {
    const rows = [];
    for (const word of [...group].sort((a,b) => a.y-b.y || a.x-b.x)) {
      let row = rows.find(r => Math.abs(r.y-word.y) < Math.max(2, Math.min(r.height,word.height)*0.45));
      if (!row) { row = { y:word.y, height:word.height, words:[] }; rows.push(row); }
      row.words.push(word);
    }
    return rows.sort((a,b) => a.y-b.y).map((row,index) => {
      const sorted = row.words.sort((a,b) => a.x-b.x);
      let text = '';
      for (let i=0;i<sorted.length;i++) {
        const word=sorted[i], prev=sorted[i-1];
        const gap=prev ? word.x-prev.x-prev.width : 0;
        const separator=prev && (gap > Math.max(2,word.height*0.3) || /[A-Za-z0-9]$/.test(prev.text) && /^[A-Za-z]/.test(word.text)) ? ' ' : '';
        text += separator+word.text;
      }
      const previous=rows[index-1];
      return (previous && row.y-previous.y > Math.max(row.height,previous.height)*1.8 ? '\n' : '')+text.trim();
    }).join('\n');
  }
  // Common two-column pages: accept a central gutter only with repeated rows on both sides.
  const cuts = [0.35,0.4,0.45,0.5,0.55,0.6,0.65].map(ratio => {
    const cut=width*ratio, margin=width*0.015;
    const left=words.filter(w=>w.x+w.width<=cut-margin), right=words.filter(w=>w.x>=cut+margin);
    const crossing=words.filter(w=>!left.includes(w)&&!right.includes(w));
    return { left,right,crossing };
  }).filter(c=>c.left.length>=3 && c.right.length>=3 && c.crossing.length<=words.length*0.15 && Math.min(...c.left.map(w=>w.y)) < Math.max(...c.right.map(w=>w.y)) && Math.min(...c.right.map(w=>w.y)) < Math.max(...c.left.map(w=>w.y)));
  const columns=cuts.sort((a,b)=>a.crossing.length-b.crossing.length)[0];
  if (!columns) return lines(words);
  // Full-width headings divide the page into bands rather than being mixed into columns.
  const anchors=[...columns.crossing].sort((a,b)=>a.y-b.y);
  const output=[]; let top=-Infinity;
  for (const anchor of [...anchors,{ y:Infinity }]) {
    for (const group of [columns.left,columns.right]) {
      const text=lines(group.filter(w=>w.y>=top && w.y<anchor.y));
      if(text) output.push(text);
    }
    if(anchor.text) output.push(anchor.text);
    top=anchor.y;
  }
  return output.join('\n\n');
}

async function extractPages(document, readOcr) {
  const pages=[], warnings=[]; let ocrCount=0;
  for(let number=1;number<=document.numPages;number++) {
    try {
      const page=await document.getPage(number), content=await page.getTextContent();
      const viewport=page.getViewport({scale:1});
      const items=content.items.filter(i=>'str' in i).map(i=>{
        const [x,y]=viewport.convertToViewportPoint(i.transform[4],i.transform[5]);
        return {text:i.str,x,y,width:i.width,height:Math.abs(i.height)||12};
      });
      let text=layoutText(items,viewport.width), method='text';
      if(text.replace(/\s/g,'').length<20) {
        if(ocrCount>=4) { pages.push({number,method:'skipped',text:''}); continue; }
        ocrCount++; method='ocr'; const result=await readOcr(page);
        text=layoutText(result.words,result.width);
      }
      pages.push({number,method,text});
      if(!text.trim()) warnings.push(`第 ${number} 页未识别到文字。`);
    } catch { pages.push({number,method:'error',text:''}); warnings.push(`第 ${number} 页识别失败，请检查 PDF 或本机 OCR 语言组件。`); }
  }
  const skipped=pages.filter(p=>p.method==='skipped').length;
  if(skipped) warnings.push(`本次最多识别 4 张扫描页，另有 ${skipped} 页未处理。`);
  if(pages.some(p=>p.method==='ocr')) warnings.push('扫描识别结果需要核对，复杂排版可能存在阅读顺序偏差。');
  return {text:pages.map(p=>p.text).join('\n\n'),pages,processedPages:pages.filter(p=>p.method==='text'||p.method==='ocr').length,totalPages:document.numPages,warnings};
}
module.exports={layoutText,extractPages};
