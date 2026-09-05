import { useState } from 'react';
import './resume-import.css';
import { extractProfile, mergeImport, profileLabels, selectImportFields, type Profile, type ResumeExtraction } from './model';

export default function ResumeImport({result,current,save,cancel}:{result:ResumeExtraction;current:Profile;save:(profile:Profile)=>Promise<void>;cancel:()=>void}) {
  const [fields,setFields]=useState(()=>extractProfile(result.text));
  const [selected,setSelected]=useState(()=>selectImportFields(current,fields,result.text,result.warnings.length>0));
  const [saving,setSaving]=useState(false), [error,setError]=useState('');
  const submit=async()=>{setSaving(true);setError('');try{await save(mergeImport(current,fields,selected));cancel();}catch{setError('保存失败，编辑内容已保留，请重试。');}finally{setSaving(false);}};
  return <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="预览简历资料" className="pixel-card import-dialog">
    <h2>预览简历资料</h2><p>已处理 {result.processedPages}/{result.totalPages} 页。请核对原文并勾选要导入的字段；已有资料默认保留。</p>
    {result.warnings.map((warning,i)=><p role="status" key={i}>{warning}</p>)}
    <p>未识别内容保留在左侧原文；自动识别可能出错，请特别核对姓名、日期和经历分类。</p>
    <div className="import-columns"><div><h3>识别原文</h3><pre>{result.text||'未识别到文字，可取消后重新选择简历。'}</pre></div>
    <div><h3>导入内容</h3>{(Object.keys(profileLabels) as (keyof Profile)[]).map(key=><div className="import-field" key={key}>
      <label><input type="checkbox" checked={selected[key]} disabled={saving} onChange={e=>setSelected({...selected,[key]:e.target.checked})}/>{profileLabels[key]}{!selected[key]&&fields[key]?'（待确认）':''}</label>
      <small>现有值：{current[key]||'未填写'}</small>
      <textarea aria-label={`导入${profileLabels[key]}`} value={fields[key]??''} disabled={saving} onChange={e=>setFields({...fields,[key]:e.target.value})}/>
    </div>)}</div></div>
    {error&&<p role="alert">{error}</p>}<div className="resume-actions"><button className="pixel-button secondary" disabled={saving} onClick={cancel}>取消</button><button className="pixel-button" disabled={saving||!Object.entries(selected).some(([key,value])=>value&&fields[key as keyof Profile]?.trim())} onClick={()=>void submit()}>{saving?'正在保存':'确认导入'}</button></div>
  </section></div>;
}
