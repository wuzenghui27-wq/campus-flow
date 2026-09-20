// Per-account, atomic disk storage. This module never uploads files.
// 按账号隔离的本地副本；保留旧 data.json，不存储 Firebase 密码或令牌。
const fs = require('node:fs');
const path = require('node:path');
const {createHash,randomUUID} = require('node:crypto');

function atomicWrite(file,value,backup=true) {
  const json=JSON.stringify(value);
  if (Buffer.byteLength(json)>16*1024*1024) throw new Error('本地副本超过 16 MB，请先导出备份');
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temporary=`${file}.${randomUUID()}.tmp`;
  let fd;
  try {
    fd=fs.openSync(temporary,'wx',0o600);
    fs.writeFileSync(fd,json,'utf8'); fs.fsyncSync(fd); fs.closeSync(fd); fd=undefined;
    if (backup && fs.existsSync(file)) fs.copyFileSync(file,`${file}.bak`);
    fs.renameSync(temporary,file);
  } finally {
    if (fd!==undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function readJSON(file) {
  try {return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch (error) {if(error.code==='ENOENT') return null; throw error;}
}
function checkUid(uid) {
  if (uid!==null && (typeof uid!=='string' || !uid.length || uid.length>128)) {
    throw new Error('账号 ID 无效');
  }
}
function validState(data,uid) {
  return data && data.format===1 && data.uid===uid &&
    data.remote && typeof data.remote==='object' && !Array.isArray(data.remote) &&
    Array.isArray(data.outbox) && data.conflicts && Array.isArray(data.conflictArchive);
}
function createScopedStorage(directory,readLegacy) {
  const base=path.join(directory,'账号同步副本');
  const ownerFile=path.join(base,'legacy-owner.json');
  const sourceFile=path.join(base,'legacy-import-source.json');
  const sessions=new Map();
  function fileFor(uid) {
    checkUid(uid);
    const label=uid===null?'guest':createHash('sha256').update(uid).digest('hex');
    return path.join(base,`${label}.json`);
  }
  function current(sender,token) {
    const active=sessions.get(sender);
    if (!active || active.token!==token) throw new Error('账号已经切换，拒绝旧会话写入');
    return active;
  }
  function open(sender,uid) {
    const file=fileFor(uid);
    let data,warning='';
    try {
      data=readJSON(file);
      if (data && !validState(data,uid)) throw new Error('副本格式错误');
    } catch (error) {
      const backup=readJSON(`${file}.bak`);
      if (!validState(backup,uid)) throw new Error(`账号副本读取失败；原文件未覆盖：${file}`);
      fs.copyFileSync(file,`${file}.corrupt-${Date.now()}`);
      data=backup;
      warning='主副本损坏，已读取上一次本地备份；请检查最近修改。损坏原件已保留。';
      atomicWrite(file,data,false);
    }
    // Invalidate all old callbacks for this window, even if the UID repeats.
    const token=randomUUID();
    sessions.set(sender,{uid,token,file});
    return {token,data,warning};
  }
  function save(sender,token,data) {
    const active=current(sender,token);
    if (!validState(data,active.uid)) throw new Error('账号与副本不匹配，未保存');
    atomicWrite(active.file,data);
    return true;
  }
  function summary(sender,token) {
    const {uid}=current(sender,token);
    if (!uid) return {available:false,count:0,hasProfile:false};
    const owner=readJSON(ownerFile);
    if (owner && owner.uid!==uid) return {available:false,count:0,hasProfile:false};
    const result=owner ? {status:'loaded',data:readJSON(sourceFile)} : readLegacy();
    if (result?.status==='error') throw new Error('旧版本数据读取失败，暂时不能导入；原文件未修改');
    const data=result?.data;
    const count=Array.isArray(data?.applications)?data.applications.length:0;
    const hasProfile=Object.values(data?.profile??{}).some(v=>typeof v==='string'&&v.trim());
    return {available:Boolean(count||hasProfile||data?.resume),count,hasProfile};
  }
  function claim(sender,token) {
    const {uid}=current(sender,token);
    if (!uid) throw new Error('请先登录');
    const owner=readJSON(ownerFile);
    if (owner && owner.uid!==uid) throw new Error('旧记录已归属另一个账号，不能导入当前账号');
    if (owner) {
      const source=readJSON(sourceFile);
      if (!source) throw new Error('旧记录导入快照丢失，请从备份恢复');
      return source;
    }
    const result=readLegacy();
    if (result?.status==='error') throw new Error('旧数据读取失败，未导入');
    const source=result?.data??{};
    atomicWrite(sourceFile,source,false);
    atomicWrite(ownerFile,{uid,claimedAt:new Date().toISOString()},false);
    return source;
  }
  return {open,save,summary,claim,close:sender=>sessions.delete(sender),fileFor};
}
function registerSyncStore({ipcMain,directory,readLegacy}) {
  const storage=createScopedStorage(directory,readLegacy);
  function handler(name,fn) {
    ipcMain.on(name,(event,...args)=>{
      // Reject IPC from embedded frames. The app has only a bundled top frame.
      if (event.senderFrame && event.senderFrame!==event.sender.mainFrame) {
        event.returnValue={ok:false,error:'不允许子页面访问本地副本'}; return;
      }
      try {event.returnValue={ok:true,data:fn(event.sender.id,...args)};}
      catch(error) {event.returnValue={ok:false,error:error.message||'本地操作失败'};}
    });
  }
  handler('sync:open',(sender,uid)=>storage.open(sender,uid));
  handler('sync:save',(sender,token,data)=>storage.save(sender,token,data));
  handler('sync:legacy-summary',(sender,token)=>storage.summary(sender,token));
  handler('sync:legacy-claim',(sender,token)=>storage.claim(sender,token));
}
module.exports={createScopedStorage,registerSyncStore,atomicWrite};
