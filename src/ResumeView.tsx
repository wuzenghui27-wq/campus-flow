import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import type {Profile,ResumeRecord} from './model';
import './resume-import.css';
const PdfPreview=lazy(()=>import('./PdfPreview'));

export default function ResumeView({resume,profile,save}:{resume:ResumeRecord|null;profile:Profile;save:(record:ResumeRecord)=>Promise<void>}) {
  const [draft,setDraft]=useState<ResumeRecord|null>(null);
  const [mode,setMode]=useState<'text'|'pdf'>('text');
  const [busy,setBusy]=useState(false),[saving,setSaving]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const request=useRef(0),submitting=useRef(false);
  useEffect(()=>()=>{request.current++;},[]);
  const profileText=Object.values(profile).filter(Boolean).join('\n\n');
  const current=draft??{name:'个人信息',path:'',updatedAt:'',...resume,text:resume?.text??profileText};
  const hasText=typeof current?.text==='string';
  async function extract(file:ResumeRecord,id:number) {
    setBusy(true);setError('');setNotice('');
    try {
      if(!window.campus)throw new Error('桌面接口不可用，请重新打开应用。');
      const result=await window.campus.extractResume(file.path);
      if(id!==request.current)return;
      if(!result.ok)throw new Error(result.error);
      if(!result.data.text.trim())throw new Error(result.data.warnings.join('\n')||'未读取到文字，原有简历仍保留。');
      setDraft({...file,text:result.data.text,originalText:result.data.text,warnings:result.data.warnings});
      setMode('text');
    } catch(reason) {if(id===request.current)setError((reason as Error).message);}
    finally {if(id===request.current)setBusy(false);}
  }
  async function pick() {
    const id=++request.current;setBusy(true);setError('');setNotice('');
    try {
      if(!window.campus)throw new Error('桌面接口不可用，请重新打开应用。');
      const file=await window.campus.pickResume();
      if(file&&id===request.current)await extract(file,id);
    } catch(reason) {if(id===request.current)setError((reason as Error).message);}
    finally {if(id===request.current)setBusy(false);}
  }
  async function submit() {
    if(!draft||submitting.current)return;
    submitting.current=true;setSaving(true);setError('');
    try {await save({...draft,updatedAt:new Date().toISOString()});setDraft(null);setNotice('整篇正文已保存到本机。');}
    catch {setError('保存失败，整篇编辑内容已保留，请重试。');}
    finally {submitting.current=false;setSaving(false);}
  }
  async function copy() {
    try {await navigator.clipboard.writeText(current?.text??'');setNotice('已复制当前显示的完整正文。');}
    catch {setError('复制失败，请在文字区域全选后复制。');}
  }
  return <section className="resume-workspace" aria-label="个人信息">
    <header className="page-head"><div><div className="eyebrow">求职材料</div><h1>个人信息</h1><p>整篇阅读与编辑，正文和PDF仅保存在本机。</p></div>
      <button className="pixel-button" disabled={busy||saving||Boolean(draft)} onClick={()=>void pick()}>{resume?.path?'替换PDF':'导入PDF'}</button>
    </header>
    <section className="pixel-card resume-document">
      <div className="resume-heading"><h2>{current?.path?current.name:'个人信息正文'}</h2>{draft&&<span>未保存预览</span>}</div>
      {current&&<>
        <div className="resume-toolbar" role="group" aria-label="个人信息操作">
          <button className="pixel-button secondary" aria-pressed={mode==='text'} onClick={()=>setMode('text')}>文字</button>
          <button className="pixel-button secondary" disabled={!current.path} aria-pressed={mode==='pdf'} onClick={()=>setMode('pdf')}>原版</button>
          <button className="pixel-button secondary" disabled={!current.path||busy||saving||Boolean(draft)} onClick={()=>void extract(current,++request.current)}>重新读取</button>
          <button className="pixel-button secondary" disabled={!hasText} onClick={()=>void copy()}>复制全文</button>
          {!draft&&<button className="pixel-button secondary" disabled={busy||!hasText} onClick={()=>{setDraft({...current});setMode('text');setNotice('');setError('');}}>编辑正文</button>}
          {!draft&&profileText&&current.text!==profileText&&<button className="pixel-button secondary" disabled={busy} onClick={()=>{setDraft({...current,text:[current.text,profileText].filter(Boolean).join('\n\n')});setMode('text');}}>加入已有资料</button>}
          {draft&&<>
            <button className="pixel-button secondary" disabled={saving||draft.originalText===undefined} onClick={()=>{setDraft({...draft,text:draft.originalText});setMode('text');}}>恢复提取原文</button>
            <button className="pixel-button secondary" disabled={saving} onClick={()=>{setDraft(null);setError('');setNotice('已取消，保留原有正文。');}}>取消</button>
            <button className="pixel-button" disabled={saving} onClick={()=>void submit()}>{saving?'正在保存…':'确认保存全文'}</button>
          </>}
        </div>
        <p className="resume-note">文字模式保留完整内容，不拆分字段；字体和双栏位置请切换「原版」核对。</p>
        {current.warnings?.length? <details className="resume-warnings"><summary>读取提示（{current.warnings.length}）</summary>{current.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</details>:null}
      </>}
      {busy&&<p role="status">正在读取整篇简历，请稍候…</p>}
      {error&&<p role="alert" className="resume-error">{error}</p>}
      {notice&&<p role="status">{notice}</p>}
      <div className="resume-body">
        {mode==='pdf'&&current?<Suspense fallback={<p>正在加载原版…</p>}><PdfPreview filePath={current.path}/></Suspense>:
          hasText?<textarea aria-label="个人信息全文" className="resume-text" placeholder="填写个人信息，或导入PDF全文后编辑。" readOnly={!draft} disabled={saving} spellCheck={false} value={current?.text??''} onChange={event=>{if(draft)setDraft({...draft,text:event.target.value});}}/>:
          <div className="resume-empty">{current?'点击「重新读取」生成整篇正文；已有个人资料不受影响。':'选择PDF后预览全文，确认保存后才替换已有简历。'}</div>}
      </div>
    </section>
  </section>;
}
