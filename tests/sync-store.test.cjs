const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createScopedStorage}=require('../electron/sync-store.cjs');
const state=uid=>({format:1,uid,remote:{},outbox:[],conflicts:{},resume:null,
  conflictArchive:[],legacyImported:false,legacyDismissed:false});
function setup(t,legacy={applications:[]}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'campus-sync-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const legacyFile=path.join(dir,'data.json');fs.writeFileSync(legacyFile,JSON.stringify(legacy));
  return {dir,legacyFile,storage:createScopedStorage(dir,()=>({status:'loaded',data:legacy}))};
}
test('UID 映射不同文件，不同账号保存互不影响',t=>{
  const {storage}=setup(t);let a=storage.open(1,'A');storage.save(1,a.token,state('A'));
  let b=storage.open(1,'B');storage.save(1,b.token,state('B'));
  assert.notEqual(storage.fileFor('A'),storage.fileFor('B'));
  assert.equal(storage.open(1,'A').data.uid,'A');
});
test('退出/切换后旧会话令牌不能写入任何副本',t=>{
  const {storage}=setup(t);const a=storage.open(1,'A');storage.open(1,'B');
  assert.throws(()=>storage.save(1,a.token,state('A')),/切换/);
});
test('同账号重新打开也使上次的异步回调令牌失效',t=>{
  const {storage}=setup(t);const a=storage.open(1,'A');storage.open(1,'A');
  assert.throws(()=>storage.save(1,a.token,state('A')));
});
test('内嵌 uid 不匹配时拒绝写入',t=>{
  const {storage}=setup(t);const a=storage.open(1,'A');
  assert.throws(()=>storage.save(1,a.token,state('B')));
});
test('旧记录必须显式认领，B 不能导入已归 A 的旧数据',t=>{
  const {storage}=setup(t,{applications:[{id:'legacy'}]});
  let a=storage.open(1,'A');assert.equal(storage.summary(1,a.token).count,1);
  assert.equal(storage.claim(1,a.token).applications.length,1);
  let b=storage.open(1,'B');assert.equal(storage.summary(1,b.token).available,false);
  assert.throws(()=>storage.claim(1,b.token));
});
test('认领和保存新副本均不修改原 data.json',t=>{
  const {storage,legacyFile}=setup(t,{applications:[{id:'legacy'}]});
  const before=fs.readFileSync(legacyFile,'utf8');const a=storage.open(1,'A');
  storage.claim(1,a.token);storage.save(1,a.token,state('A'));
  assert.equal(fs.readFileSync(legacyFile,'utf8'),before);
});
test('缓存含待发送操作，关闭后重新打开仍存在',t=>{
  const {storage}=setup(t);const a=storage.open(1,'A'),s=state('A');s.outbox=[{id:'waiting'}];
  storage.save(1,a.token,s);storage.close(1);
  assert.equal(storage.open(2,'A').data.outbox[0].id,'waiting');
});
test('损坏主副本时保留损坏原件并读取备份',t=>{
  const {storage}=setup(t);const a=storage.open(1,'A');storage.save(1,a.token,state('A'));
  storage.save(1,a.token,state('A'));fs.writeFileSync(storage.fileFor('A'),'BROKEN');
  const result=storage.open(1,'A');assert.ok(result.warning);assert.equal(result.data.uid,'A');
  assert.ok(fs.readdirSync(path.dirname(storage.fileFor('A'))).some(f=>f.includes('.corrupt-')));
});
test('损坏且无备份时停止，不拿空数据覆盖',t=>{
  const {storage}=setup(t);const a=storage.open(1,'A');storage.save(1,a.token,state('A'));
  fs.writeFileSync(storage.fileFor('A'),'BROKEN');assert.throws(()=>storage.open(1,'A'));
  assert.equal(fs.readFileSync(storage.fileFor('A'),'utf8'),'BROKEN');
});
test('UID 中的路径符号只参与哈希，不形成目录穿越',t=>{
  const {storage,dir}=setup(t);const file=storage.fileFor('../../outside');
  assert.equal(path.dirname(file),path.join(dir,'账号同步副本'));
});
