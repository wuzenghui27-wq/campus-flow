import {
  BarChart3, BriefcaseBusiness, Building2, ExternalLink, FileText, FolderOpen, LayoutDashboard, LockKeyhole,
  Pencil, Plus, Sparkles, Trash2, UserRound, X,
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Application, extractProfile, normalizeWebsite, parseApplications, parseObject, parseProfile, Profile, ResumeRecord, Status, statuses, summarize, summarizeCompanies } from './model';

type Page = '工作台' | '投递记录' | '数据统计' | '简历' | '个人信息' | '已投递公司统计';
const nav: [Page, typeof LayoutDashboard][] = [
  ['工作台', LayoutDashboard], ['投递记录', BriefcaseBusiness], ['数据统计', BarChart3],
  ['简历', FileText], ['个人信息', UserRound], ['已投递公司统计', Building2],
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
    ['总投递',apps.length,'还没有记录，去投递记录里添加第一条。','orange'],
    ['进行中',counts.笔试+counts.面试,'笔试、面试阶段的投递会汇总在这里。','teal'],
    ['录用',counts.录用,'获得录用后会自动统计到这一项。','yellow'],
  ];
  return <><PageHeader eyebrow="总览" title="工作台" subtitle="今天也要稳步推进求职计划。"/><section className="info-cards">{cards.map(([label,count,copy,color])=><article className="pixel-card info-card" key={label}><span className={`badge ${color}`}>{label}</span><strong>{count}</strong><p>{copy}</p></article>)}</section></>;
}

function ApplicationRow({ app, edit, update, remove }:{ app:Application; edit:()=>void; update:(status:Status)=>void; remove:()=>void }) {
  return <div className="record-row"><div className="company-mark">{app.company[0]}</div><div className="job"><strong>{app.company}</strong><span>{app.role} · {app.location}</span></div><select value={app.status} onChange={event=>update(event.target.value as Status)} aria-label={`${app.company}当前状态`}>{statuses.map(status=><option key={status}>{status}</option>)}</select><time>{new Date(`${app.appliedAt}T00:00:00`).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}</time><div className="row-actions"><button onClick={edit} aria-label="编辑"><Pencil/></button><button onClick={remove} aria-label="删除"><Trash2/></button></div></div>;
}

function Records({ apps, add, edit, update, remove }:{ apps:Application[]; add:()=>void; edit:(app:Application)=>void; update:(id:string,status:Status)=>void; remove:(id:string)=>void }) {
  return <><PageHeader eyebrow="完整记录" title="投递记录" subtitle="更新状态后，工作台和统计会立即同步。" action={<PixelButton onClick={add}><Plus size={16}/>新增投递</PixelButton>}/><section className="pixel-card records">{apps.length?apps.map(app=><ApplicationRow key={app.id} app={app} edit={()=>edit(app)} update={status=>update(app.id,status)} remove={()=>remove(app.id)}/>):<Empty title="从第一份投递开始" copy="记录公司、岗位和当前进度，工作台会自动汇总。" onAdd={add}/>}</section></>;
}

function Statistics({ apps }:{ apps:Application[] }) {
  const counts=summarize(apps);
  const rate=apps.length?Math.round((counts.笔试+counts.面试+counts.录用)/apps.length*100):0;
  return <><PageHeader eyebrow="投递洞察" title="数据统计" subtitle="用最少的数字看清当前求职进度。"/><section className="statistics"><article className="pixel-card flow-card"><h2>流程分布</h2>{statuses.map(status=><div className="flow-row" key={status}><span>{status}</span><div className="flow-track"><i style={{width:`${apps.length?Math.max(2,counts[status]/apps.length*100):2}%`}}/></div><strong>{counts[status]}</strong></div>)}</article><article className="pixel-card rate-card"><span>推进率</span><strong>{rate}%</strong><p>进入笔试及后续阶段的投递占比</p></article></section></>;
}

function ResumeView({ resume, setResume, importProfile }:{ resume:ResumeRecord|null; setResume:(resume:ResumeRecord)=>void; importProfile:(profile:Partial<Profile>)=>void }) {
  const [extracting,setExtracting]=useState(false);
  const extract=async(path=resume?.path)=>{ if(!path||!window.campus)return; setExtracting(true); const text=await window.campus.extractResume(path); setExtracting(false); if(!text)return alert('无法识别这份简历，请确认扫描清晰，或在 Windows 设置中安装中文识别语言包。'); const fields=extractProfile(text); if(!Object.keys(fields).length)return alert('没有识别到个人信息，请手动填写。'); importProfile(fields) };
  const pick=async()=>{ const selected=await window.campus?.pickResume(); if(selected){setResume(selected); await extract(selected.path)} };
  const open=async()=>{ if(resume&&window.campus&&!(await window.campus.openResume(resume.path)))alert('无法打开该文件，请重新选择。') };
  return <><PageHeader eyebrow="求职材料" title="简历" subtitle="简历文件只在本机读取，不会上传。" action={<PixelButton onClick={pick} disabled={extracting}><Plus size={16}/>{extracting?'正在识别':resume?'替换简历':'选择简历'}</PixelButton>}/><section className="pixel-card resume-panel">{resume?<><div className="empty-icon"><FileText/></div><h2>{resume.name}</h2><p className="file-path">{resume.path}</p><small>选择时间：{new Date(resume.updatedAt).toLocaleString('zh-CN')}</small><div className="resume-actions"><PixelButton onClick={()=>extract()} disabled={extracting}><Sparkles size={16}/>{extracting?'正在提取':'重新提取资料'}</PixelButton><PixelButton secondary onClick={open}><FolderOpen size={16}/>打开简历</PixelButton></div><p className="hint">选择或替换简历后，基础资料会自动同步，请核对识别结果。</p></>:<Empty title="还没有简历" copy="选择一份简历，基础资料会自动同步。" icon={<FileText/>}/>}</section></>;
}

function ProfileView({ profile, setProfile }:{ profile:Profile; setProfile:(profile:Profile)=>void }) {
  const basic:[keyof Profile,string,string][]=[['name','姓名','text'],['phone','手机号','tel'],['email','邮箱','email'],['gender','性别','text'],['birthDate','出生日期','date']];
  const details:[keyof Profile,string][]=[['education','教育经历'],['work','工作经历'],['internship','实习经历'],['projects','项目经历'],['activities','实践活动'],['awards','奖励荣誉'],['skills','专业技能'],['languages','语言']];
  const bookmarklet=`javascript:(()=>{const d=${JSON.stringify(profile)};const m={name:['姓名','name'],phone:['手机','电话','phone','mobile'],email:['邮箱','email'],gender:['性别','gender'],birthDate:['出生日期','生日','birth'],education:['教育','学校','院校','education'],work:['工作经历','work'],internship:['实习','internship'],projects:['项目','project'],activities:['实践活动','activity'],awards:['奖励','荣誉','award'],skills:['专业技能','skill'],languages:['语言','language']};document.querySelectorAll('input,textarea,select').forEach(i=>{const s=(i.name+' '+i.placeholder+' '+i.id).toLowerCase();for(const k in m)if(m[k].some(x=>s.includes(x.toLowerCase()))){i.value=d[k]||'';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));break}})})()`;
  return <><PageHeader eyebrow="本机资料" title="个人信息" subtitle="输入后立即保存在本机，重开应用仍会保留。"/><section className="profile-scroll"><div className="profile-grid"><form className="pixel-card profile-form" onSubmit={event=>event.preventDefault()}><h2>基础资料</h2>{basic.map(([key,label,type])=><label key={key}>{label}{key==='gender'?<select value={profile[key]} onChange={event=>setProfile({...profile,[key]:event.target.value})}><option value="">请选择</option><option>男</option><option>女</option><option>其他</option></select>:<input type={type} value={profile[key]} onChange={event=>setProfile({...profile,[key]:event.target.value})} placeholder={`请输入${label}`}/>}</label>)}<h2>经历与能力</h2>{details.map(([key,label])=><label className="profile-detail" key={key}>{label}<textarea value={profile[key]} onChange={event=>setProfile({...profile,[key]:event.target.value})} placeholder={`请输入${label}`}/></label>)}</form><aside className="pixel-card autofill"><div className="empty-icon"><Sparkles/></div><h2>招聘网站自动填写</h2><p>把下方按钮拖入浏览器书签栏，在招聘表单页面点击即可尝试填写。</p><a href={bookmarklet} draggable onClick={event=>event.preventDefault()} className="pixel-button">拖动我：自动填写资料</a><PixelButton secondary onClick={()=>navigator.clipboard.writeText(Object.values(profile).filter(Boolean).join('\n'))}>复制全部资料</PixelButton><small><LockKeyhole/>资料变化后，请重新拖入书签栏。</small></aside></div></section></>;
}

function Companies({ apps }:{ apps:Application[] }) {
  const companies=summarizeCompanies(apps);
  return <><PageHeader eyebrow="公司去向" title="已投递公司统计" subtitle={`共投递 ${companies.length} 家公司、${apps.length} 个岗位。`}/>{companies.length?<section className="info-cards">{companies.map(item=><article className="pixel-card info-card" key={item.company}><span className="badge orange">{item.count} 个岗位</span><h2>{item.company}</h2><div className="company-positions">{item.positions.map((position,index)=><div className="company-position" key={`${position.role}-${index}`}><b>职位 {index+1}</b><span>{position.role}</span><small>{position.location} · {position.status}</small></div>)}</div><small>{statuses.filter(status=>item.statuses[status]).map(status=>`${status} ${item.statuses[status]}`).join('　')}</small>{item.website?<a className="company-link" href={item.website} target="_blank" rel="noreferrer"><ExternalLink/>访问招聘网站</a>:<small>未填写招聘网站，请编辑投递记录补充。</small>}</article>)}</section>:<section className="pixel-card"><Empty title="还没有已投递公司" copy="新增投递记录后，这里会自动按公司汇总。"/></section>}</>;
}

function ApplicationModal({ app, close, save }:{ app:Application|null; close:()=>void; save:(app:Application)=>void }) {
  const submit=(event:FormEvent<HTMLFormElement>)=>{ event.preventDefault(); const data=new FormData(event.currentTarget); save({id:app?.id??crypto.randomUUID(),company:String(data.get('company')).trim(),role:String(data.get('role')).trim(),location:String(data.get('location')).trim(),website:normalizeWebsite(data.get('website')),appliedAt:String(data.get('appliedAt')),status:data.get('status') as Status}) };
  return <div className="modal-backdrop" onMouseDown={close}><form className="pixel-card modal" onSubmit={submit} onMouseDown={event=>event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">{app?'编辑记录':'新增记录'}</div><h2>{app?'更新投递':'记录一次投递'}</h2></div><button type="button" onClick={close} aria-label="关闭"><X/></button></div><label>公司<input name="company" defaultValue={app?.company} required autoFocus/></label><label>职位<input name="role" defaultValue={app?.role} required/></label><label>招聘网站<input name="website" defaultValue={app?.website} placeholder="例如：jobs.example.com"/></label><div className="form-row"><label>城市<input name="location" defaultValue={app?.location} required/></label><label>投递日期<input name="appliedAt" type="date" defaultValue={app?.appliedAt??new Date().toISOString().slice(0,10)} required/></label></div><label>当前状态<select name="status" defaultValue={app?.status??'已投递'}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label><PixelButton type="submit">保存投递</PixelButton></form></div>;
}

function TitleBar() {
  return <div className="title-bar"><span className="title-dot"/><span>校招迹</span><div className="window-controls"><button title="最小化" onClick={()=>window.campus?.minimizeWindow()}/><button title="最大化" onClick={()=>window.campus?.toggleMaximizeWindow()}/><button title="关闭" onClick={()=>window.campus?.closeWindow()}/></div></div>;
}

export default function App() {
  const [page,setPage]=useState<Page>('工作台');
  const [apps,setAppsState]=useState(()=>parseApplications(localStorage.getItem('campus-flow-applications')));
  const [profile,setProfileState]=useState(()=>parseProfile(localStorage.getItem('campus-flow-profile')));
  const [resume,setResumeState]=useState<ResumeRecord|null>(()=>parseObject(localStorage.getItem('campus-flow-resume'),null as unknown as ResumeRecord));
  const [editing,setEditing]=useState<Application|null|undefined>();
  useEffect(()=>{ window.campus?.loadData().then(data=>{ if(data){ if(data.applications)setAppsState(parseApplications(JSON.stringify(data.applications))); if(data.profile)setProfileState(parseProfile(JSON.stringify(data.profile))); if(data.resume)setResumeState(parseObject(JSON.stringify(data.resume),null as unknown as ResumeRecord)) } else window.campus?.saveData({applications:apps,profile,resume}) }) },[]);
  const setApps=(next:Application[])=>{ const sorted=[...next].sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt)); setAppsState(sorted); localStorage.setItem('campus-flow-applications',JSON.stringify(sorted)); window.campus?.saveData({applications:sorted}) };
  const setProfile=(next:Profile)=>{ setProfileState(next); localStorage.setItem('campus-flow-profile',JSON.stringify(next)); window.campus?.saveData({profile:next}) };
  const setResume=(next:ResumeRecord)=>{ setResumeState(next); localStorage.setItem('campus-flow-resume',JSON.stringify(next)); window.campus?.saveData({resume:next}) };
  const save=(app:Application)=>{ setApps(apps.some(item=>item.id===app.id)?apps.map(item=>item.id===app.id?app:item):[app,...apps]); setEditing(undefined) };
  const remove=(id:string)=>{ if(confirm('确定删除这条投递记录吗？'))setApps(apps.filter(app=>app.id!==id)) };
  const update=(id:string,status:Status)=>setApps(apps.map(app=>app.id===id?{...app,status}:app));
  const importProfile=(fields:Partial<Profile>)=>{ setProfile({...profile,...fields}); setPage('个人信息') };
  const content=page==='工作台'?<Workbench apps={apps}/>:page==='投递记录'?<Records apps={apps} add={()=>setEditing(null)} edit={setEditing} update={update} remove={remove}/>:page==='数据统计'?<Statistics apps={apps}/>:page==='简历'?<ResumeView resume={resume} setResume={setResume} importProfile={importProfile}/>:page==='个人信息'?<ProfileView profile={profile} setProfile={setProfile}/>:<Companies apps={apps}/>;
  return <div className="desktop-window"><TitleBar/><div className="window-body"><aside className="sidebar"><div className="brand"><span><FoxLogo/></span><strong>校招迹</strong></div><nav>{nav.map(([label,Icon])=><button className={page===label?'active':''} onClick={()=>setPage(label)} key={label}><Icon/>{label}</button>)}</nav><div className="local-box"><LockKeyhole/><div><strong>本地模式</strong><span>没有云端同步</span></div></div></aside><main><div className="page-content">{content}</div></main></div>{editing!==undefined&&<ApplicationModal key={editing?.id??'new'} app={editing} close={()=>setEditing(undefined)} save={save}/>}</div>;
}
