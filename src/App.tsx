import SyncPanel from './SyncPanel';
import {useWorkspace} from './useWorkspace';
import {dataView} from './sync-core';
import {auth} from './firebase';
import {
  BarChart3, BriefcaseBusiness, Building2, Download, ExternalLink, FolderOpen, LayoutDashboard, LockKeyhole,
  Pencil, Plus, RefreshCw, Trash2, UserRound, X,
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState, useRef } from 'react';
import ResumeView from './ResumeView';
import AccountPanel from './AccountPanel';
import { Application, normalizeWebsite, ResumeRecord, Status, statuses, summarize, summarizeCompanies } from './model';

type Page = '工作台' | '投递记录' | '数据统计' | '个人信息' | '已投递公司统计';
const nav: [Page, typeof LayoutDashboard][] = [
  ['工作台', LayoutDashboard], ['投递记录', BriefcaseBusiness], ['数据统计', BarChart3],
  ['个人信息', UserRound], ['已投递公司统计', Building2],
];

const fox = [
  '00200000000200','02200000000220','02221111112220','01111111111110',
  '01111111111110','01113111131110','01113111131110','01111444411110',
  '01144444444110','01144433444110','01114444441110','02211111112220',
  '00055555555000','00005555550000',
];
const foxColors = ['transparent','#ff7a45','#c2551f','#16241f','#ffffff','#3f8f76'];

function FoxLogo() {
  return <svg viewBox="0 0 14 14" aria-hidden="true" shapeRendering="crispEdges">{fox.flatMap((row,y)=>[...row].map((cell,x)=>cell==='0'?null:<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={foxColors[Number(cell)]}/>))}</svg>;
}

function PageHeader({ eyebrow, title, subtitle, action }:{ eyebrow:string; title:string; subtitle:string; action?:ReactNode }) {
  return <header className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}

function PixelButton({ children, secondary=false, ...props }:React.ButtonHTMLAttributes<HTMLButtonElement>&{secondary?:boolean}) {
  return <button className={`pixel-button${secondary?' secondary':''}`} {...props}>{children}</button>;
}

function Empty({ title, copy, onAdd, icon=<BriefcaseBusiness/> }:{ title:string; copy:string; onAdd?:()=>void; icon?:ReactNode }) {
  return <div className="empty-panel"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{copy}</p>{onAdd&&<PixelButton onClick={onAdd}><Plus size={16}/>记录新投递</PixelButton>}</div>;
}

function Workbench({ apps }:{ apps:Application[] }) {
  const counts=useMemo(()=>summarize(apps),[apps]);
  const cards=[
    ['总投递',apps.length,apps.length?'已记录的投递会持续保存在本机。':'还没有记录，去投递记录里添加第一条。','orange'],
    ['进行中',counts.笔试+counts.面试,'笔试、面试阶段的投递会汇总在这里。','teal'],
    ['录用',counts.录用,'获得录用后会自动统计到这一项。','yellow'],
  ];
  return <><PageHeader eyebrow="总览" title="工作台" subtitle="今天也要稳步推进求职计划。"/><section className="info-cards">{cards.map(([label,count,copy,color])=><article className="pixel-card info-card" key={label}><span className={`badge ${color}`}>{label}</span><strong>{count}</strong><p>{copy}</p></article>)}</section></>;
}

function ApplicationRow({ app, duplicate, edit, update, remove }:{ app:Application; duplicate:()=>void; edit:()=>void; update:(status:Status)=>void; remove:()=>void }) {
  return <div className="record-row"><div className="company-mark">{app.company[0]}</div><div className="job"><strong>{app.company}</strong><span>{app.role} · {app.location}</span></div><select value={app.status} onChange={event=>update(event.target.value as Status)} aria-label={`${app.company}当前状态`}>{statuses.map(status=><option key={status}>{status}</option>)}</select><time>{new Date(`${app.appliedAt}T00:00:00`).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}</time><div className="row-actions"><button onClick={duplicate} aria-label="为该公司新增职位" title="新增职位"><Plus/></button><button onClick={edit} aria-label="编辑"><Pencil/></button><button onClick={remove} aria-label="删除"><Trash2/></button></div></div>;
}

function Records({ apps, add, edit, update, remove }:{ apps:Application[]; add:()=>void; edit:(app:Application)=>void; update:(id:string,status:Status)=>void; remove:(id:string)=>void }) {
  return <><PageHeader eyebrow="完整记录" title="投递记录" subtitle="更新状态后，工作台和统计会立即同步。" action={<PixelButton onClick={add}><Plus size={16}/>新增投递</PixelButton>}/><section className="pixel-card records">{apps.length?apps.map(app=><ApplicationRow key={app.id} app={app} duplicate={()=>edit({...app,id:'',role:''})} edit={()=>edit(app)} update={status=>update(app.id,status)} remove={()=>remove(app.id)}/>):<Empty title="从第一份投递开始" copy="记录公司、岗位和当前进度，工作台会自动汇总。" onAdd={add}/>}</section></>;
}

function Statistics({ apps }:{ apps:Application[] }) {
  const counts=summarize(apps);
  const rate=apps.length?Math.round((counts.笔试+counts.面试+counts.录用)/apps.length*100):0;
  return <><PageHeader eyebrow="投递洞察" title="数据统计" subtitle="用最少的数字看清当前求职进度。"/><section className="statistics"><article className="pixel-card flow-card"><h2>流程分布</h2>{statuses.map(status=><div className="flow-row" key={status}><span>{status}</span><div className="flow-track"><i style={{width:`${apps.length?Math.max(2,counts[status]/apps.length*100):2}%`}}/></div><strong>{counts[status]}</strong></div>)}</article><article className="pixel-card rate-card"><span>推进率</span><strong>{rate}%</strong><p>进入笔试及后续阶段的投递占比</p></article></section></>;
}

function Companies({ apps }:{ apps:Application[] }) {
  const companies=summarizeCompanies(apps);
  return <><PageHeader eyebrow="公司去向" title="已投递公司统计" subtitle={`共投递 ${companies.length} 家公司、${apps.length} 个岗位。`}/>{companies.length?<section className="info-cards">{companies.map(item=><article className="pixel-card info-card" key={item.company}><span className="badge orange">{item.count} 个岗位</span><h2>{item.company}</h2><div className="company-positions">{item.positions.map((position,index)=><div className="company-position" key={`${position.role}-${index}`}><b>职位 {index+1}</b><span>{position.role}</span><small>{position.location} · {position.status}</small></div>)}</div><small>{statuses.filter(status=>item.statuses[status]).map(status=>`${status} ${item.statuses[status]}`).join('　')}</small>{item.website?<a className="company-link" href={item.website} target="_blank" rel="noreferrer"><ExternalLink/>访问招聘网站</a>:<small>未填写招聘网站，请编辑投递记录补充。</small>}</article>)}</section>:<section className="pixel-card"><Empty title="还没有已投递公司" copy="新增投递记录后，这里会自动按公司汇总。"/></section>}</>;
}

function ApplicationModal({ app, close, save }:{ app:Application|null; close:()=>void; save:(app:Application)=>Promise<void> }) {
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const submitting=useRef(false);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{ event.preventDefault(); if(submitting.current)return; const data=new FormData(event.currentTarget); submitting.current=true;setSaving(true);setError(''); try { await save({id:app?.id||crypto.randomUUID(),company:String(data.get('company')).trim(),role:String(data.get('role')).trim(),location:String(data.get('location')).trim(),website:normalizeWebsite(data.get('website')),appliedAt:String(data.get('appliedAt')),status:data.get('status') as Status}); } catch { setError('保存失败，填写内容已保留，请重试。'); } finally { submitting.current=false;setSaving(false); } };
  return <div className="modal-backdrop"><form className="pixel-card modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">{app?.id?'编辑记录':'新增记录'}</div><h2>{app?.id?'更新投递':app?'为该公司新增职位':'记录一次投递'}</h2></div><button type="button" disabled={saving} onClick={close} aria-label="关闭"><X/></button></div><label>公司<input disabled={saving} name="company" defaultValue={app?.company} required autoFocus={!app}/></label><label>职位<input disabled={saving} name="role" defaultValue={app?.role} required autoFocus={Boolean(app&&!app.id)}/></label><label>招聘网站<input disabled={saving} name="website" defaultValue={app?.website} placeholder="例如：jobs.example.com"/></label><div className="form-row"><label>城市<input disabled={saving} name="location" defaultValue={app?.location} required/></label><label>投递日期<input disabled={saving} name="appliedAt" type="date" defaultValue={app?.appliedAt??new Date().toISOString().slice(0,10)} required/></label></div><label>当前状态<select disabled={saving} name="status" defaultValue={app?.status??'已投递'}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label><PixelButton type="submit" disabled={saving}>{saving?'正在保存…':app&&!app.id?'另存投递':'保存投递'}</PixelButton>{error&&<p role="alert">{error}</p>}</form></div>;
}

function TitleBar() {
  return <div className="title-bar"><span className="title-dot"/><span>招迹</span><div className="window-controls"><button title="最小化" onClick={()=>window.campus?.minimizeWindow()}/><button title="最大化" onClick={()=>window.campus?.toggleMaximizeWindow()}/><button title="关闭" onClick={()=>window.campus?.closeWindow()}/></div></div>;
}

// CAMPUS_FLOW_CLOUD_STEP_1 — generated workspace integration.
export default function App() {
  const {view,controller,fatal}=useWorkspace();
  const [page,setPage]=useState<Page>('工作台');
  const [updateVersion,setUpdateVersion]=useState('');
  const [updating,setUpdating]=useState(false);
  useEffect(()=>{
    let mounted=true;
    window.campus?.checkUpdate().then(info=>{
      if(mounted&&info.available)setUpdateVersion(info.version);
    }).catch(()=>{});
    return ()=>{mounted=false;};
  },[]);
  const installUpdate=async()=>{
    setUpdating(true);
    try{if(!await window.campus?.installUpdate())throw new Error('更新失败，请稍后重试。');}
    catch(error){alert((error as Error).message);}
    finally{setUpdating(false);}
  };
  const [editing,setEditing]=useState<{uid:string|null;app:Application|null;baseRevision?:number}|undefined>();
  const uid=view?.state.uid;
  const visible=view && (auth.currentUser?.uid??null)===view.state.uid;
  const attempt=(fn:()=>void)=>{try{fn();}catch(error){alert((error as Error).message);}};
  if(fatal || !view || !visible || !controller) {
    return <div className="desktop-window"><TitleBar/><main className="page-content">
      {page==='工作台'&&<AccountPanel/>}
      <h2>{fatal?'账号副本未能打开':'正在读取当前账号…'}</h2>
      <p>{fatal||'不会将上个账号的数据带入当前工作区。'}</p>
      {page!=='工作台'&&<PixelButton onClick={()=>setPage('工作台')}>返回工作台</PixelButton>}
      {fatal&&<PixelButton onClick={()=>void window.campus?.openDataDirectory()}>打开数据目录</PixelButton>}
    </main></div>;
  }
  const {applications:apps,profile,resume}=dataView(view.state);
  const edit=(app:Application|null)=>setEditing({uid:view.state.uid,app,baseRevision:app?.id?controller.jobRevision(app.id):undefined});
  const save=async(app:Application)=>{controller.saveJob(app,editing?.app?.id===app.id?editing?.baseRevision:undefined);setEditing(undefined);};
  const remove=(id:string)=>{if(confirm('确定删除这条投递记录吗？登录状态下，该删除也会同步到其他设备。'))attempt(()=>controller.removeJob(id));};
  const update=(id:string,status:Status)=>attempt(()=>controller.updateStatus(id,status));
  const saveResume=async(next:ResumeRecord)=>{controller.saveResume(next);};
  const content=page==='工作台'?<Workbench apps={apps}/>:
    page==='投递记录'?<Records apps={apps} add={()=>edit(null)} edit={edit} update={update} remove={remove}/>:
    page==='数据统计'?<Statistics apps={apps}/>:
    page==='个人信息'?null:
    <Companies apps={apps}/>;
  return <div className="desktop-window"><TitleBar/>
    <div className="window-body"><aside className="sidebar">
      <div className="brand"><span><FoxLogo/></span><strong>招迹</strong></div>
      <nav>{nav.map(([label,Icon])=><button className={page===label?'active':''}
        onClick={()=>setPage(label)} key={label}><Icon/>{label}</button>)}</nav>
      <button className="restore-button" onClick={()=>void window.campus?.openDataDirectory()}>
        <FolderOpen/><span>打开数据目录</span></button>
      <a className="update-button" href="https://github.com/wuzenghui27-wq/campus-flow/releases/latest" target="_blank" rel="noreferrer">
        <Download/><span>版本更新</span></a>
      {updateVersion&&<button className="update-button" onClick={()=>void installUpdate()} disabled={updating}>
        <Download/><span>{updating?'正在更新':`更新到 ${updateVersion}`}</span></button>}
      <div className="local-box"><LockKeyhole/><div>
        <strong>{uid?'账号工作区':'本地工作区'}</strong>
        <span>PDF和文件路径只在本机</span></div></div>
    </aside><main className={page==='个人信息'?'resume-page':undefined}><div className="page-content" key={uid??'guest'}>
      {page==='工作台'&&<>
        <AccountPanel pendingCount={view.state.outbox.length}/>
        <SyncPanel controller={controller}/>
      </>}
      {content}
      <div className="resume-container" hidden={page!=='个人信息'}><ResumeView resume={resume} profile={profile} save={saveResume}/></div>
    </div></main></div>
    {editing&&editing.uid===uid&&<ApplicationModal key={editing.app?.id??'new'}
      app={editing.app} close={()=>setEditing(undefined)} save={save}/>}
  </div>;
}