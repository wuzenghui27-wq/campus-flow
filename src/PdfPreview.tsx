import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;

export default function PdfPreview({filePath}:{filePath:string}) {
  const container=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let cancelled=false;
    let task:ReturnType<typeof getDocument>|undefined;
    const root=container.current!;
    root.replaceChildren();setError('');setLoading(true);
    void (async()=>{
      try {
        if(!window.campus)throw new Error('桌面接口不可用。');
        const reply=await window.campus.readResume(filePath);
        if(cancelled)return;
        if(!reply.ok)throw new Error(reply.error);
        const base=new URL('./pdfjs/',document.baseURI);
        task=getDocument({data:reply.data,cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,
          standardFontDataUrl:new URL('standard_fonts/',base).href,wasmUrl:new URL('wasm/',base).href});
        task.onPassword=()=>{setError('PDF 已加密，请先另存为未加密文件。');void task?.destroy();};
        const pdf=await task.promise;
        for(let number=1;number<=pdf.numPages&&!cancelled;number++) {
          try {
            const page=await pdf.getPage(number);
            if(cancelled)return;
            const viewport=page.getViewport({scale:Math.min(1.5,1400/page.getViewport({scale:1}).width)});
            const canvas=document.createElement('canvas');
            canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PDF 原版第 ${number} 页`);
            root.append(canvas);
            await page.render({canvas,viewport}).promise;
            page.cleanup();
          } catch(reason) {
            if(cancelled)return;
            const note=document.createElement('p');note.textContent=`第 ${number} 页显示失败：${(reason as Error).message}`;root.append(note);
          }
        }
      } catch(reason) {if(!cancelled)setError(previous=>previous||`原版读取失败：${(reason as Error).message}`);}
      finally {if(!cancelled)setLoading(false);}
    })();
    return ()=>{cancelled=true;void task?.destroy();root.replaceChildren();};
  },[filePath]);
  return <div className="resume-pdf" tabIndex={0} aria-label="PDF原版">
    {loading&&<p role="status">正在读取原版页面…</p>}{error&&<p role="alert">{error} 已保存正文不受影响。</p>}
    <div ref={container}/>
  </div>;
}
