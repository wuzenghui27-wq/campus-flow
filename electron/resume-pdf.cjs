const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const {createCanvas} = require('@napi-rs/canvas');
const {extractPages} = require('./resume-layout.cjs');

function pdfError(error) {
  if (error.name === 'PasswordException') return 'PDF 已加密，请先用密码打开并另存为未加密文件。';
  if (error.name === 'InvalidPDFException') return 'PDF 格式损坏或不受支持，请重新导出 PDF。';
  if (error.code === 'ENOENT') return 'PDF 文件不存在或已移动，请重新选择。';
  if (error.code === 'EACCES' || error.code === 'EPERM') return '没有权限读取 PDF，请检查文件访问权限。';
  return error.message || 'PDF 读取失败。';
}
async function readPdf(filePath) {
  if (typeof filePath !== 'string' || path.extname(filePath).toLowerCase() !== '.pdf') throw new Error('请选择 PDF 文件。');
  const info = await fs.stat(filePath);
  if (!info.isFile()) throw new Error('所选路径不是文件。');
  if (info.size > 50 * 1024 * 1024) throw new Error('PDF 超过 50 MB，请压缩后再导入。');
  return new Uint8Array(await fs.readFile(filePath));
}
function recognizeImage(file, resources) {
  const mac = process.platform === 'darwin';
  if (!mac && process.platform !== 'win32') throw new Error('当前系统未提供扫描识别组件。');
  const command = mac ? resources.macOcr : 'powershell.exe';
  const args = mac ? [file] : ['-NoProfile','-ExecutionPolicy','Bypass','-File',resources.windowsOcr,'-Path',file];
  return new Promise((resolve,reject)=>execFile(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024,timeout:120000},(error,stdout)=>{
    if (error) {
      reject(new Error(mac ? 'Mac 本机文字识别失败，请确认安装包内的识别组件完整。' : 'Windows 扫描识别失败，请检查系统 OCR 语言组件。'));
    } else {
      try {resolve(JSON.parse(stdout.replace(/^\uFEFF/,'')));} catch {reject(new Error('本机文字识别返回了无效结果。'));}
    }
  }));
}
async function extractPdf(filePath, resources) {
  const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const base = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const task = getDocument({data:await readPdf(filePath),useSystemFonts:true,
    cMapUrl:path.join(base,'cmaps')+'/',cMapPacked:true,
    standardFontDataUrl:path.join(base,'standard_fonts')+'/',wasmUrl:path.join(base,'wasm')+'/'});
  try {
    const document = await task.promise;
    return await extractPages(document,async page=>{
      const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(page.getViewport({scale:1}).width,page.getViewport({scale:1}).height))});
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      await fs.mkdir(resources.tempDirectory,{recursive:true});
      const imagePath=path.join(resources.tempDirectory,`resume-${randomUUID()}.png`);
      try {await fs.writeFile(imagePath,canvas.toBuffer('image/png'));return await recognizeImage(imagePath,resources);}
      finally {await fs.unlink(imagePath).catch(()=>{});}
    });
  } finally {await task.destroy();}
}
module.exports={readPdf,extractPdf,pdfError};
