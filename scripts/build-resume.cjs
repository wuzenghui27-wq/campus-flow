const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const pdf=path.dirname(require.resolve('pdfjs-dist/package.json'));
for(const folder of ['cmaps','standard_fonts','wasm']) {
  fs.cpSync(path.join(pdf,folder),path.join(root,'dist','pdfjs',folder),{recursive:true});
}
if(process.platform==='darwin') {
  execFileSync('xcrun',['swiftc','-O','-target','arm64-apple-macos12.0','-module-cache-path',path.join(root,'work','swift-cache'),
    path.join(root,'electron','ocr-mac.swift'),'-o',path.join(root,'build','ocr-mac')],{stdio:'inherit'});
}
