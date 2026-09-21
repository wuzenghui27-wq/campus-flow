import type {ResumeRecord} from './model';
/** Pure, locally durable sync state. No network calls or file paths in cloud data.
 * 同步状态与合并逻辑；只允许投递字段和个人资料文字进入云端。
 */
export const profileKeys = ['name','phone','email','gender','birthDate',
  'education','work','internship','projects','activities','awards',
  'skills','languages'] as const;
export type ProfileKey = typeof profileKeys[number];
export type SyncProfile = Record<ProfileKey, string>;
export type Job = {
  id: string; company: string; role: string; location: string;
  website: string; appliedAt: string;
  status: '已投递' | '笔试' | '面试' | '录用' | '未通过';
};
export type Value = Job | string | null;
export type Entry = {
  kind: 'application' | 'profile'; value: Value; deleted: boolean;
  revision: number; mutationId: string;
};
export type Operation = {
  key: string; kind: Entry['kind']; value: Value; deleted: boolean;
  id: string; baseRevision: number; started: boolean;
};
export type SyncState = {
  format: 1; uid: string | null; remote: Record<string, Entry>;
  outbox: Operation[]; conflicts: Record<string, true>;
  resume: ResumeRecord | null;
  legacyImported: boolean; legacyDismissed: boolean;
  conflictArchive: Array<{at:string; key:string; operations:Operation[];
    remote:Entry|null; choice:'local'|'cloud'}>;
};
const statusValues = ['已投递','笔试','面试','录用','未通过'];
export function emptyProfile(): SyncProfile {
  return Object.fromEntries(profileKeys.map(k => [k, ''])) as SyncProfile;
}
export function newState(uid: string | null): SyncState {
  return {format:1, uid, remote:{}, outbox:[], conflicts:{}, resume:null,
    legacyImported:false, legacyDismissed:false, conflictArchive:[]};
}
export function copyState(state: SyncState): SyncState {
  return JSON.parse(JSON.stringify(state)) as SyncState;
}
export function cleanJob(raw: unknown): Job {
  if (!raw || typeof raw !== 'object') throw new Error('投递记录格式错误');
  const r = raw as Record<string, unknown>;
  const result: Record<string,string> = {};
  for (const key of ['id','company','role','location','website','appliedAt','status']) {
    if (typeof r[key] !== 'string') throw new Error(`投递字段 ${key} 不是文字`);
    if ((r[key] as string).length > (key === 'website' ? 2048 : 500)) {
      throw new Error(`投递字段 ${key} 太长`);
    }
    result[key] = r[key] as string;
  }
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(result.id)) {
    throw new Error('投递记录 ID 格式不受支持，未上传该记录');
  }
  if (!result.company.trim() || !result.role.trim() ||
      !statusValues.includes(result.status) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(result.appliedAt)) {
    throw new Error('投递记录缺少公司、职位、日期或有效状态');
  }
  // Unknown fields (including PDF paths) are deliberately excluded.
  // 不使用 {...raw}，防止附带文件路径、密码等额外字段。
  return result as Job;
}
export function cleanProfile(raw: unknown): SyncProfile {
  const r = raw && typeof raw === 'object' ? raw as Record<string,unknown> : {};
  const result = emptyProfile();
  for (const k of profileKeys) {
    const value = r[k];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(`个人资料字段 ${k} 格式错误`);
    }
    if (typeof value === 'string' && value.length > 20000) {
      throw new Error(`个人资料字段 ${k} 超过 20000 字符`);
    }
    result[k] = typeof value === 'string' ? value : '';
  }
  return result;
}
export function cleanEntry(key: string, raw: unknown): Entry {
  if (!raw || typeof raw !== 'object') throw new Error('云端记录格式错误');
  const r = raw as Record<string,unknown>;
  if (!Number.isSafeInteger(r.revision) || Number(r.revision) < 0 ||
      typeof r.mutationId !== 'string' || typeof r.deleted !== 'boolean') {
    throw new Error('云端版本信息错误');
  }
  let value:Value;
  if (r.kind === 'application' && /^a_[A-Za-z0-9_-]{1,120}$/.test(key)) {
    value = r.deleted ? null : cleanJob(r.value);
    if (value && (value as Job).id !== key.slice(2)) throw new Error('记录 ID 不匹配');
  } else if (r.kind === 'profile' && profileKeys.includes(key.slice(2) as ProfileKey)
      && key.startsWith('p_') && r.deleted === false) {
    if (typeof r.value !== 'string' || r.value.length > 20000) throw new Error('资料格式错误');
    value = r.value;
  } else throw new Error('不支持的云端字段');
  return {kind:r.kind as Entry['kind'], value, deleted:r.deleted,
    revision:Number(r.revision), mutationId:r.mutationId};
}
export function validateState(raw:unknown, uid:string|null): SyncState {
  const r = raw as SyncState;
  if (!r || r.format !== 1 || r.uid !== uid || !r.remote || !r.conflicts ||
      !Array.isArray(r.outbox) || !Array.isArray(r.conflictArchive)) {
    throw new Error('账号本地副本格式错误；未覆盖原文件');
  }
  for (const [key, entry] of Object.entries(r.remote)) cleanEntry(key, entry);
  for (const op of r.outbox) {
    cleanEntry(op.key, {...op, revision:op.baseRevision, mutationId:op.id});
    if (typeof op.started !== 'boolean') throw new Error('待同步队列格式错误');
  }
  return copyState(r);
}
export function projected(state:SyncState): Record<string,Entry> {
  const entries = {...state.remote};
  for (const op of state.outbox) {
    entries[op.key] = {kind:op.kind,value:op.value,deleted:op.deleted,
      revision:op.baseRevision+1,mutationId:op.id};
  }
  return entries;
}
export function dataView(state:SyncState) {
  const entries = projected(state);
  const applications:Job[] = [];
  const profile = emptyProfile();
  for (const [key, e] of Object.entries(entries)) {
    if (e.deleted) continue;
    if (e.kind === 'application') applications.push(cleanJob(e.value));
    else if (key.startsWith('p_')) profile[key.slice(2) as ProfileKey] = e.value as string;
  }
  applications.sort((a,b) => b.appliedAt.localeCompare(a.appliedAt));
  return {applications, profile, resume:state.resume};
}
/** Coalesce only operations that have NEVER been sent.
 * 已尝试发送的操作不能覆盖，防止“服务端已保存但客户端未收到确认”时丢数据。
 */
export function enqueue(state:SyncState, key:string, kind:Entry['kind'],
    value:Value, deleted:boolean, id:string, expectedRevision?:number):void {
  const clean = cleanEntry(key,{kind,value,deleted,revision:0,mutationId:id});
  if (state.uid === null) {
    state.remote[key] = clean;
    return;
  }
  const same = state.outbox.filter(op => op.key === key);
  const last = same.at(-1);
  if (last && !last.started) {
    last.value = clean.value; last.deleted = deleted; last.kind = kind;
    return;
  }
  state.outbox.push({key,kind,value:clean.value,deleted,id,started:false,
    baseRevision:last ? last.baseRevision+1 : expectedRevision ?? state.remote[key]?.revision ?? 0});
}
export function acknowledge(state:SyncState,key:string,entry:Entry):void {
  const index = state.outbox.findIndex(op => op.key===key && op.id===entry.mutationId);
  if (index >= 0) {
    state.outbox = state.outbox.filter((op,i) => op.key!==key || i>index);
    let revision = entry.revision;
    for (const op of state.outbox) if (op.key===key) op.baseRevision=revision++;
    delete state.conflicts[key];
  }
  if (!state.remote[key] || entry.revision >= state.remote[key].revision) {
    state.remote[key] = entry;
  }
}
export function receive(state:SyncState, entries:Record<string,Entry>):void {
  for (const [key,entry] of Object.entries(entries)) acknowledge(state,key,entry);
}
export function recordConflict(state:SyncState,key:string,entry:Entry|null):void {
  if (entry) acknowledge(state,key,entry);
  state.conflicts[key]=true;
}
export function resolveConflict(state:SyncState,key:string,choice:'local'|'cloud',id:string):void {
  const operations = state.outbox.filter(op => op.key===key);
  if (!operations.length || !state.conflicts[key]) return;
  const last = operations[operations.length-1];
  state.conflictArchive.push({at:new Date().toISOString(),key,
    operations:JSON.parse(JSON.stringify(operations)),
    remote:state.remote[key]??null,choice});
  state.outbox = state.outbox.filter(op => op.key!==key);
  delete state.conflicts[key];
  if (choice==='local') enqueue(state,key,last.kind,last.value,last.deleted,id);
}
/** Import-only: never change an existing cloud document, including tombstones.
 * 旧记录只追加，云端已有 ID 和已删除记录不复活；资料仅填从未保存过的字段。
 */
export function planLegacyImport(state:SyncState,raw:unknown,makeId:()=>string) {
  const r = raw as {applications?:unknown[];profile?:unknown;resume?:SyncState['resume']};
  if (!r || typeof r!=='object') throw new Error('旧数据不可用');
  if (r.applications !== undefined && !Array.isArray(r.applications)) {
    throw new Error('旧投递记录不是列表，未导入');
  }
  const jobs = (r.applications??[]).map(rawJob => {
    const j = rawJob as Record<string,unknown>;
    return cleanJob({...j,website:j?.website??'',
      status:j?.status==='Offer'?'录用':j?.status});
  });
  const oldProfile = r.profile && typeof r.profile==='object'
    ? r.profile as Record<string,unknown> : {};
  const education = oldProfile.education ||
    [oldProfile.school,oldProfile.major,oldProfile.degree]
      .filter(v=>typeof v==='string'&&v).join(' · ');
  const profile = cleanProfile({...oldProfile,education});
  const existing = projected(state);
  let imported=0, skipped=0, fields=0;
  for (const job of jobs) {
    const key=`a_${job.id}`;
    if (existing[key]) {skipped++; continue;}
    enqueue(state,key,'application',job,false,makeId());
    existing[key]={kind:'application',value:job,deleted:false,revision:0,mutationId:''};
    imported++;
  }
  for (const k of profileKeys) if (profile[k] && !existing[`p_${k}`]) {
    enqueue(state,`p_${k}`,'profile',profile[k],false,makeId()); fields++;
  }
  if (!state.resume && r.resume && typeof r.resume.path==='string' &&
      typeof r.resume.name==='string' && typeof r.resume.updatedAt==='string') {
    state.resume={name:r.resume.name,path:r.resume.path,updatedAt:r.resume.updatedAt};
  }
  state.legacyImported=true;
  return {imported,skipped,fields};
}
