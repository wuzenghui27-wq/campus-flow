'use client';

import { BarChart3, Bell, BriefcaseBusiness, CalendarDays, ChevronRight, CircleHelp, FileText, LayoutDashboard, LockKeyhole, MoreHorizontal, Plus, Search, Sparkles, UserRound, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Application = { id:number; company:string; role:string; location:string; date:string; status:'已投递'|'笔试'|'面试'|'Offer'; color:string };
type Profile = { name:string; phone:string; email:string; school:string; major:string; degree:string };

const seed: Application[] = [
  { id:1, company:'字节跳动', role:'产品经理', location:'北京', date:'08月28日', status:'面试', color:'#f4eee6' },
  { id:2, company:'腾讯', role:'前端开发工程师', location:'深圳', date:'08月26日', status:'笔试', color:'#e8f1ee' },
  { id:3, company:'小红书', role:'数据分析师', location:'上海', date:'08月24日', status:'已投递', color:'#f6e9e5' },
  { id:4, company:'美团', role:'后端开发工程师', location:'北京', date:'08月21日', status:'Offer', color:'#f6f0dc' },
];
const blankProfile: Profile = { name:'', phone:'', email:'', school:'', major:'', degree:'' };
const nav = [['进度',LayoutDashboard],['投递记录',BriefcaseBusiness],['数据统计',BarChart3],['简历',FileText],['个人信息',UserRound],['校招资讯',Sparkles]] as const;
const statusClass = { 已投递:'status sent', 笔试:'status test', 面试:'status interview', Offer:'status offer' };

function Progress({ apps, onAdd }:{ apps:Application[]; onAdd:()=>void }) {
  const counts = useMemo(() => ({ total:apps.length, interview:apps.filter(x=>x.status==='面试').length, test:apps.filter(x=>x.status==='笔试').length, offer:apps.filter(x=>x.status==='Offer').length }), [apps]);
  return <>
    <header className="page-head"><div><p className="eyebrow">2027 届秋招</p><h1>早上好，继续向前。</h1><p>你的每一次投递，都在靠近理想工作。</p></div><button className="primary" onClick={onAdd}><Plus size={18}/>记录新投递</button></header>
    <section className="stat-grid" aria-label="投递统计">
      <article className="stat-card coral"><span>总投递</span><strong>{counts.total}</strong><small>本地记录的全部职位</small><BriefcaseBusiness/></article>
      <article className="stat-card blue"><span>面试中</span><strong>{counts.interview}</strong><small>准备好你的故事</small><UserRound/></article>
      <article className="stat-card sand"><span>待笔试</span><strong>{counts.test}</strong><small>记得检查截止时间</small><FileText/></article>
      <article className="stat-card mint"><span>Offer</span><strong>{counts.offer}</strong><small>好消息正在发生</small><Sparkles/></article>
    </section>
    <section className="content-grid">
      <article className="panel applications"><div className="panel-title"><div><h2>最近投递</h2><p>所有变化，一目了然</p></div><button>查看全部 <ChevronRight size={16}/></button></div><div className="application-list">
        {apps.slice(0,5).map(x=><div className="application-row" key={x.id}><div className="company-logo" style={{background:x.color}}>{x.company[0]}</div><div className="job"><strong>{x.company}</strong><span>{x.role} · {x.location}</span></div><span className={statusClass[x.status]}>{x.status}</span><time>{x.date}</time><button className="icon-btn" aria-label={`${x.company}更多操作`}><MoreHorizontal size={18}/></button></div>)}
      </div></article>
      <aside className="side-stack"><article className="panel todo"><div className="panel-title"><div><h2>今日待办</h2><p>保持节奏</p></div><span className="count">3</span></div><label><input type="checkbox"/> 完成腾讯笔试</label><label><input type="checkbox"/> 准备字节二面</label><label><input type="checkbox"/> 更新产品岗简历</label></article><article className="tip"><div><CalendarDays size={20}/><span>校招小贴士</span></div><strong>面试前，准备 3 个能量化结果的项目故事。</strong><button>查看面试准备清单 <ChevronRight size={15}/></button></article></aside>
    </section>
  </>;
}

function ProfileView({ profile, setProfile }:{ profile:Profile; setProfile:(p:Profile)=>void }) {
  const update=(key:keyof Profile,value:string)=>setProfile({...profile,[key]:value});
  const bookmarklet=`javascript:(()=>{const d=${JSON.stringify(profile)};const m={name:['姓名','name'],phone:['手机','电话','phone','mobile'],email:['邮箱','email'],school:['学校','院校','school'],major:['专业','major'],degree:['学历','degree']};document.querySelectorAll('input').forEach(i=>{const s=(i.name+' '+i.placeholder+' '+i.id).toLowerCase();for(const k in m)if(m[k].some(x=>s.includes(x.toLowerCase()))){i.value=d[k]||'';i.dispatchEvent(new Event('input',{bubbles:true}));break}})})()`;
  return <section className="profile-wrap"><header className="page-head"><div><p className="eyebrow">仅保存在这台设备</p><h1>个人信息</h1><p>填写一次，需要时快速复制或自动填入招聘网站。</p></div><div className="privacy"><LockKeyhole size={17}/> 不上传云端</div></header><div className="profile-grid">
    <form className="panel profile-form" onSubmit={e=>e.preventDefault()}><div className="panel-title"><div><h2>基础资料</h2><p>内容会自动保存到当前浏览器</p></div></div>{([['name','姓名'],['phone','手机号'],['email','邮箱'],['school','学校'],['major','专业'],['degree','学历']] as [keyof Profile,string][]).map(([key,label])=><label key={key}>{label}<input value={profile[key]} onChange={e=>update(key,e.target.value)} placeholder={`请输入${label}`} autoComplete={key==='phone'?'tel':key}/></label>)}</form>
    <aside className="panel autofill"><div className="autofill-icon"><Sparkles/></div><h2>招聘网站自动填写</h2><p>把按钮拖进浏览器书签栏。在招聘网站打开表单后点击书签，会尝试匹配姓名、手机、邮箱、学校等字段。</p><a className="primary bookmarklet" href={bookmarklet}>拖动我：自动填写资料</a><button className="secondary" onClick={()=>navigator.clipboard.writeText(Object.values(profile).filter(Boolean).join('\n'))}>复制全部常用资料</button><small><LockKeyhole size={14}/> 数据写在本地书签中，不经过服务器。部分网站可能因安全策略无法填写。</small></aside>
  </div></section>;
}

function OtherView({title,apps}:{title:string;apps:Application[]}) {
  if(title==='投递记录') return <section><header className="page-head"><div><p className="eyebrow">完整记录</p><h1>我的投递</h1><p>你投过什么、走到哪一步，都留在这里。</p></div></header><article className="panel record-table">{apps.map(x=><div className="application-row" key={x.id}><div className="company-logo" style={{background:x.color}}>{x.company[0]}</div><div className="job"><strong>{x.company}</strong><span>{x.role} · {x.location}</span></div><span className={statusClass[x.status]}>{x.status}</span><time>{x.date}</time><button className="icon-btn" aria-label="更多"><MoreHorizontal/></button></div>)}</article></section>;
  if(title==='数据统计') { const groups=['已投递','笔试','面试','Offer'] as const; return <section><header className="page-head"><div><p className="eyebrow">投递洞察</p><h1>数据统计</h1><p>用数字看清进度，把精力放在下一步。</p></div></header><article className="panel chart-panel"><h2>流程分布</h2>{groups.map(s=>{const n=apps.filter(x=>x.status===s).length;return <div className="bar-row" key={s}><span>{s}</span><div><i style={{width:`${apps.length?n/apps.length*100:0}%`}}/></div><strong>{n}</strong></div>})}</article></section> }
  if(title==='简历') return <section><header className="page-head"><div><p className="eyebrow">本地文件</p><h1>简历</h1><p>按岗位维护版本，文件不会上传服务器。</p></div></header><label className="panel resume-drop"><FileText size={38}/><strong>选择一份 PDF 简历</strong><span>文件仅在本次浏览器会话中打开</span><input type="file" accept="application/pdf"/><b>选择文件</b></label></section>;
  return <section><header className="page-head"><div><p className="eyebrow">求职雷达</p><h1>校招资讯</h1><p>首版提供通用时间节点，避免错过关键动作。</p></div></header><div className="news-grid">{[['网申期','8—10 月','先投递，再持续迭代简历'],['笔面试高峰','9—11 月','每天固定复盘一道题和一个项目故事'],['补录机会','12 月起','关注官网状态与目标岗位更新']].map(x=><article className="panel news" key={x[0]}><span>{x[1]}</span><h2>{x[0]}</h2><p>{x[2]}</p></article>)}</div></section>;
}

export default function Home() {
  const [active,setActive]=useState('进度'); const [apps,setApps]=useState(seed); const [profile,setProfileState]=useState(blankProfile); const [showAdd,setShowAdd]=useState(false); const [ready,setReady]=useState(false);
  useEffect(()=>{ try { const a=localStorage.getItem('campus-flow-applications'), p=localStorage.getItem('campus-flow-profile'); if(a)setApps(JSON.parse(a)); if(p)setProfileState(JSON.parse(p)); } finally { setReady(true) } },[]);
  useEffect(()=>{ if(ready)localStorage.setItem('campus-flow-applications',JSON.stringify(apps)) },[apps,ready]);
  const setProfile=(next:Profile)=>{ setProfileState(next); if(ready)localStorage.setItem('campus-flow-profile',JSON.stringify(next)) };
  const add=(e:FormEvent<HTMLFormElement>)=>{ e.preventDefault(); const d=new FormData(e.currentTarget), now=new Date(); setApps([{id:Date.now(),company:String(d.get('company')),role:String(d.get('role')),location:String(d.get('location')),status:String(d.get('status')) as Application['status'],date:`${String(now.getMonth()+1).padStart(2,'0')}月${String(now.getDate()).padStart(2,'0')}日`,color:'#e8f1ee'},...apps]); setShowAdd(false) };
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span>迹</span><div><strong>校招迹</strong><small>CAMPUS FLOW</small></div></div><nav aria-label="主导航">{nav.map(([label,Icon])=><button className={active===label?'active':''} onClick={()=>setActive(label)} key={label}><Icon size={19}/>{label}</button>)}</nav><div className="sidebar-bottom"><div className="secure-note"><LockKeyhole size={17}/><div><strong>隐私优先</strong><span>个人信息仅存本地</span></div></div><button><CircleHelp size={18}/>帮助与反馈</button></div></aside>
    <main className="main"><div className="topbar"><div className="search"><Search size={18}/><input aria-label="搜索投递" placeholder="搜索公司或职位..."/></div><button className="icon-btn" aria-label="通知"><Bell size={19}/><i/></button><div className="avatar">林</div></div><div className="page-content">{active==='进度'?<Progress apps={apps} onAdd={()=>setShowAdd(true)}/>:active==='个人信息'?<ProfileView profile={profile} setProfile={setProfile}/>:<OtherView title={active} apps={apps}/>}</div></main>
    {showAdd&&<div className="modal-backdrop" onMouseDown={()=>setShowAdd(false)}><form className="modal" onSubmit={add} onMouseDown={e=>e.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">新增记录</p><h2>记录一次投递</h2></div><button type="button" className="icon-btn" onClick={()=>setShowAdd(false)} aria-label="关闭"><X/></button></div><label>公司<input name="company" required autoFocus placeholder="例如：字节跳动"/></label><label>职位<input name="role" required placeholder="例如：产品经理"/></label><label>城市<input name="location" required placeholder="例如：北京"/></label><label>当前状态<select name="status"><option>已投递</option><option>笔试</option><option>面试</option><option>Offer</option></select></label><button className="primary" type="submit">保存投递</button></form></div>}
  </div>;
}
