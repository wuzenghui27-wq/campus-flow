import {useEffect,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from './firebase';
import {createTransport} from './cloud-transport';
import {acknowledge,cleanJob,cleanProfile,copyState,dataView,enqueue,
  newState,planLegacyImport,profileKeys,projected,receive,recordConflict,resolveConflict,
  validateState} from './sync-core';
import type {Entry,Job,SyncState} from './sync-core';
import type {LegacySummary} from './sync-globals';

type Snapshot={state:SyncState;connected:boolean;working:boolean;error:string;
  warning:string;legacy:LegacySummary;email:string};
function message(error:unknown):string {
  const e=error as {code?:string;message?:string};
  if (e.code==='permission-denied') return '云端拒绝访问：请发布配套 firestore.rules，并确认当前账号已登录。记录仍保存在本机。';
  if (e.code==='resource-exhausted') return 'Firebase 免费额度暂时不足；记录保存在本机，稍后点击重试。';
  if (e.code==='unavailable' || e.code==='deadline-exceeded') return '暂时连不上云端；修改已保存在本机，恢复连接后重试。';
  return e.message||'同步失败；请保留本地副本并稍后重试。';
}
function unwrap<T>(reply:{ok:true;data:T}|{ok:false;error:string}):T {
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
export class WorkspaceController {
  state:SyncState;
  token:string;
  email:string;
  stopped=false;
  connected=false;
  working=false;
  error='';
  warning='';
  legacy:LegacySummary={available:false,count:0,hasProfile:false};
  private listeners=new Set<(snapshot:Snapshot)=>void>();
  private unsubscribe:(()=>void)|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private failures=0;
  private transport:ReturnType<typeof createTransport>|null=null;

  constructor(uid:string|null,email:string) {
    if (!window.campusSync) throw new Error('账号存储接口未加载：请完全退出软件并重新运行 npm run desktop。');
    const opened=unwrap(window.campusSync.open(uid));
    this.token=opened.token; this.email=email; this.warning=opened.warning;
    this.state=opened.data?validateState(opened.data,uid):newState(uid);
    this.persist(this.state);
    if (uid) {
      try {this.legacy=unwrap(window.campusSync.legacySummary(this.token));}
      catch(error) {this.warning=message(error);}
      this.transport=createTransport(uid,()=>!this.stopped);
    }
  }
  private authorized() {
    if (this.stopped || (auth.currentUser?.uid??null)!==this.state.uid) {
      throw new Error('账号已切换，请在当前账号下重新操作');
    }
  }
  private persist(next:SyncState) {
    if (!window.campusSync) throw new Error('本地存储接口不可用');
    unwrap(window.campusSync.save(this.token,next));
  }
  private change(fn:(state:SyncState)=>void) {
    this.authorized();
    const next=copyState(this.state);
    fn(next);
    // Do not acknowledge a save or send it to the cloud before disk succeeds.
    // 本地原子写入成功后，才更新界面和发送云端操作。
    this.persist(next);
    this.state=next;
    this.emit();
  }
  snapshot():Snapshot {
    return {state:this.state,connected:this.connected,working:this.working,
      error:this.error,warning:this.warning,legacy:this.legacy,email:this.email};
  }
  subscribe(listener:(snapshot:Snapshot)=>void) {
    this.listeners.add(listener); listener(this.snapshot());
    return ()=>{this.listeners.delete(listener);};
  }
  private emit() {if (!this.stopped) for (const fn of this.listeners) fn(this.snapshot());}
  start() {
    if (!this.transport || this.stopped) return;
    this.unsubscribe?.();
    this.unsubscribe=this.transport.watch(entries=>{
      if(this.stopped) return;
      try {
        this.change(next=>receive(next,entries));
        this.connected=true; this.error=''; this.failures=0; this.emit();
        this.schedule(100);
      } catch(error) {this.error=message(error);this.emit();}
    },error=>{
      if(this.stopped) return;
      this.connected=false;this.error=message(error);this.emit();
    },()=>{this.connected=false;this.emit();});
  }
  stop() {
    this.stopped=true;this.unsubscribe?.();
    if(this.timer)clearTimeout(this.timer);
    this.listeners.clear();
  }
  retry() {
    this.authorized();this.error='';this.connected=false;this.emit();
    this.start();
  }
  private schedule(delay=900) {
    if(this.timer)clearTimeout(this.timer);
    if(!this.state.uid||this.stopped)return;
    this.timer=setTimeout(()=>{this.timer=null;void this.flush();},delay);
  }
  private async flush() {
    if(this.working||this.stopped||!this.transport||!this.connected||!navigator.onLine)return;
    this.working=true;this.emit();
    try {
      for(;;) {
        this.authorized();
        const op=this.state.outbox.find(item=>!this.state.conflicts[item.key]);
        if(!op)break;
        this.change(next=>{const saved=next.outbox.find(item=>item.id===op.id);if(saved)saved.started=true;});
        const result=await this.transport.write({...op,started:true});
        if(this.stopped)return;
        this.change(next=>{
          if(result.ok)acknowledge(next,op.key,result.entry);
          else recordConflict(next,op.key,result.remote);
        });
        this.failures=0;this.error='';
      }
    } catch(error) {
      if(!this.stopped) {
        this.error=message(error);
        const code=(error as {code?:string}).code;
        if(code==='unavailable'||code==='deadline-exceeded'||code==='aborted') {
          this.schedule(Math.min(60000,2000*2**Math.min(this.failures++,5)));
        }
      }
    } finally {this.working=false;this.emit();}
  }
  jobRevision(id:string) {return projected(this.state)[`a_${id}`]?.revision??0;}
  saveJob(raw:unknown,expectedRevision?:number) {
    const job=cleanJob(raw);
    this.change(next=>enqueue(next,`a_${job.id}`,'application',job,false,crypto.randomUUID(),expectedRevision));
    this.schedule();
  }
  removeJob(id:string) {
    this.change(next=>enqueue(next,`a_${id}`,'application',null,true,crypto.randomUUID()));
    this.schedule();
  }
  updateStatus(id:string,status:Job['status']) {
    const job=dataView(this.state).applications.find(item=>item.id===id);
    if(!job)throw new Error('记录不存在，请刷新后重试');
    this.saveJob({...job,status});
  }
  saveProfile(raw:unknown,baseline:SyncState=this.state) {
    const profile=cleanProfile(raw);
    const baseEntries=projected(baseline);
    this.change(next=>{
      const old=dataView(baseline).profile;
      for(const k of profileKeys)if(profile[k]!==old[k]) {
        enqueue(next,`p_${k}`,'profile',profile[k],false,crypto.randomUUID(),baseEntries[`p_${k}`]?.revision??0);
      }
    });
    this.schedule();
  }
  saveResume(resume:SyncState['resume']) {
    this.change(next=>{next.resume=resume;});
  }
  dismissLegacy() {this.change(next=>{next.legacyDismissed=true;});}
  showLegacy() {this.change(next=>{next.legacyDismissed=false;});}
  importLegacy() {
    this.authorized();
    if(!this.connected||!this.state.uid)throw new Error('请连接云端后再导入，以免覆盖已有数据');
    if(this.state.legacyImported)throw new Error('这份旧数据已导入，不重复追加');
    const raw=unwrap(window.campusSync!.claimLegacy(this.token));
    let report={imported:0,skipped:0,fields:0};
    this.change(next=>{report=planLegacyImport(next,raw,()=>crypto.randomUUID());});
    this.schedule(100);return report;
  }
  chooseConflict(key:string,choice:'local'|'cloud') {
    this.change(next=>resolveConflict(next,key,choice,crypto.randomUUID()));
    this.schedule(100);
  }
}
export function useWorkspace() {
  const [view,setView]=useState<Snapshot|null>(null);
  const [controller,setController]=useState<WorkspaceController|null>(null);
  const [fatal,setFatal]=useState('');
  useEffect(()=>{
    let current:WorkspaceController|null=null;
    const unsubscribe=onAuthStateChanged(auth,user=>{
      current?.stop();current=null;
      setView(null);setController(null);setFatal('');
      try {
        const next=new WorkspaceController(user?.uid??null,user?.email??'');
        current=next;next.subscribe(setView);setController(next);next.start();
      } catch(error) {setFatal(message(error));}
    },error=>setFatal(message(error)));
    const online=()=>current?.retry();
    const offline=()=>{if(current){current.connected=false;setView(current.snapshot());}};
    window.addEventListener('online',online);window.addEventListener('offline',offline);
    return ()=>{unsubscribe();current?.stop();window.removeEventListener('online',online);window.removeEventListener('offline',offline);};
  },[]);
  return {view,controller,fatal};
}
export function conflictValues(state:SyncState,key:string) {
  return {local:projected(state)[key]?.value??null,cloud:state.remote[key]?.value??null};
}
