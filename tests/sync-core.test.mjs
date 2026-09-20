import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,copyState,cleanJob,cleanProfile,cleanEntry,dataView,enqueue,
  acknowledge,receive,recordConflict,resolveConflict,planLegacyImport,validateState} from '../src/sync-core.ts';
const job=(id='job1',company='示例公司')=>({id,company,role:'开发',location:'上海',
  website:'',appliedAt:'2026-09-20',status:'已投递'});
const entry=(value,revision=1,mutationId='remote1')=>({kind:'application',
  value,revision,mutationId,deleted:value===null});
let sequence=0;const uuid=()=>`op${++sequence}`;
test('账号 A、B 和未登录副本独立，不共享对象',()=>{
  const a=newState('A'),b=newState('B'),guest=newState(null);
  enqueue(a,'a_job1','application',job(),false,uuid());
  assert.equal(dataView(a).applications.length,1);
  assert.equal(dataView(b).applications.length,0);
  assert.equal(dataView(guest).applications.length,0);
});
test('云端应用字段白名单丢弃 path、resume、密码等额外属性',()=>{
  const value=cleanJob({...job(),path:'/secret.pdf',resume:'bytes',password:'secret'});
  assert.deepEqual(Object.keys(value).sort(),['id','company','role','location','website','appliedAt','status'].sort());
});
test('个人资料只保留明确的 13 个文字字段',()=>{
  const p=cleanProfile({name:'用户',pdf:'/private.pdf',password:'x'});
  assert.equal(Object.keys(p).length,13);assert.equal(p.pdf,undefined);
});
test('未发送输入会合并，避免每个按键都写云端',()=>{
  const s=newState('A');enqueue(s,'p_name','profile','小',false,'1');
  enqueue(s,'p_name','profile','小明',false,'2');
  assert.equal(s.outbox.length,1);assert.equal(s.outbox[0].value,'小明');
});
test('已尝试发送的操作不合并，追加的版本与前序操作衔接',()=>{
  const s=newState('A');enqueue(s,'p_name','profile','小',false,'1');
  s.outbox[0].started=true;enqueue(s,'p_name','profile','小明',false,'2');
  assert.equal(s.outbox.length,2);assert.equal(s.outbox[1].baseRevision,1);
});
test('服务端确认第一项后仍保留正在输入的新修改',()=>{
  const s=newState('A');enqueue(s,'a_job1','application',job(),false,'first');
  s.outbox[0].started=true;enqueue(s,'a_job1','application',job('job1','新公司'),false,'second');
  acknowledge(s,'a_job1',entry(job(),1,'first'));
  assert.equal(s.outbox.length,1);assert.equal(s.outbox[0].id,'second');
  assert.equal(dataView(s).applications[0].company,'新公司');
});
test('重启后依据 mutationId 识别已经提交的操作，不重复写入',()=>{
  const s=newState('A');enqueue(s,'a_job1','application',job(),false,'first');
  s.outbox[0].started=true;
  const restored=validateState(JSON.parse(JSON.stringify(s)),'A');
  receive(restored,{'a_job1':entry(job(),1,'first')});
  assert.equal(restored.outbox.length,0);
});
test('收到其他记录更新不会覆盖本机未发送修改',()=>{
  const s=newState('A');enqueue(s,'a_job1','application',job(),false,'first');
  receive(s,{'a_job2':entry(job('job2','另一公司'),1,'remote')});
  assert.equal(dataView(s).applications.length,2);
});
test('旧的远端快照不能把本地已确认版本回退',()=>{
  const s=newState('A');receive(s,{'a_job1':entry(job('job1','新'),3,'three')});
  receive(s,{'a_job1':entry(job('job1','旧'),2,'two')});
  assert.equal(dataView(s).applications[0].company,'新');
});
test('事务冲突结果不会回退或删除监听器先收到的新版本',()=>{
  for(const remote of [entry(job('job1','旧'),2,'r2'),null,entry(job('job1','更新'),4,'r4')]) {
    const s=newState('A');s.remote.a_job1=entry(job(),1,'r1');
    enqueue(s,'a_job1','application',job('job1','本机'),false,'local');
    receive(s,{'a_job1':entry(job('job1','新'),3,'r3')});
    recordConflict(s,'a_job1',remote);
    assert.equal(s.remote.a_job1.revision,remote?.revision===4?4:3);
    assert.equal(s.conflicts.a_job1,true);
    assert.equal(dataView(s).applications[0].company,'本机');
    resolveConflict(s,'a_job1','cloud','choice');
    assert.equal(dataView(s).applications[0].company,remote?.revision===4?'更新':'新');
  }
});
test('相同记录冲突时保留本机投影，不静默覆盖',()=>{
  const s=newState('A');s.remote.a_job1=entry(job(),1,'r1');
  enqueue(s,'a_job1','application',job('job1','本机'),false,'local');
  receive(s,{'a_job1':entry(job('job1','云端'),2,'r2')});s.conflicts.a_job1=true;
  assert.equal(dataView(s).applications[0].company,'本机');
  resolveConflict(s,'a_job1','cloud','choice');
  assert.equal(dataView(s).applications[0].company,'云端');
  assert.equal(s.conflictArchive.length,1);assert.equal(s.conflictArchive[0].operations[0].value.company,'本机');
});
test('选择本机版本使用当前云端版本作为新基线，且存档冲突',()=>{
  const s=newState('A');s.remote.a_job1=entry(job(),1,'r1');
  enqueue(s,'a_job1','application',job('job1','本机'),false,'local');
  s.remote.a_job1=entry(job('job1','云端'),5,'r5');s.conflicts.a_job1=true;
  resolveConflict(s,'a_job1','local','choice');
  assert.equal(s.outbox[0].baseRevision,5);assert.equal(s.outbox[0].id,'choice');
  assert.equal(s.conflictArchive.length,1);
});
test('删除使用墓碑，离线记录不会被导入功能复活',()=>{
  const s=newState('A');s.remote.a_job1=entry(null,2,'deleted');
  const report=planLegacyImport(s,{applications:[job()]},uuid);
  assert.equal(report.skipped,1);assert.equal(s.outbox.length,0);
  assert.equal(dataView(s).applications.length,0);
});
test('首次导入只补缺失记录，不覆盖云端同 ID 内容和已保存资料',()=>{
  const s=newState('A');s.remote.a_job1=entry(job('job1','云端公司'));
  s.remote.p_name={kind:'profile',value:'云端姓名',revision:1,mutationId:'name',deleted:false};
  const result=planLegacyImport(s,{applications:[job(),job('job2')],profile:{name:'旧姓名',skills:'Python'}},uuid);
  assert.deepEqual(result,{imported:1,skipped:1,fields:1});
  assert.equal(dataView(s).profile.name,'云端姓名');assert.equal(dataView(s).profile.skills,'Python');
});
test('简历路径仅留在本机，导入后的任何云端操作都不包含它',()=>{
  const s=newState('A');const resume={name:'cv.pdf',path:'/Users/A/cv.pdf',updatedAt:'now'};
  planLegacyImport(s,{applications:[job()],profile:{name:'A'},resume},uuid);
  assert.equal(s.resume.path,resume.path);
  assert.ok(!JSON.stringify(s.outbox).includes(resume.path));
});
test('非法资料不会部分改坏已提交的工作状态（事务副本）',()=>{
  const original=newState('A'),draft=copyState(original);
  assert.throws(()=>planLegacyImport(draft,{applications:[job(),{bad:true}]},uuid));
  assert.equal(original.outbox.length,0);
});
test('未登录工作区永不生成云端待发送队列',()=>{
  const s=newState(null);enqueue(s,'a_job1','application',job(),false,'local');
  assert.equal(s.outbox.length,0);assert.equal(dataView(s).applications.length,1);
});
test('拒绝将 A 的本地状态作为 B 的状态打开',()=>{
  assert.throws(()=>validateState(newState('A'),'B'));
});
test('拒绝伪造 PDF 云端条目和超长个人资料',()=>{
  assert.throws(()=>cleanEntry('p_resume',{kind:'profile',value:'pdf',revision:1,mutationId:'x',deleted:false}));
  assert.throws(()=>cleanProfile({name:'x'.repeat(20001)}));
});

test('表单打开后云端又发生修改，保存仍使用打开表单时的版本',()=>{
  const s=newState('A');s.remote.a_job1=entry(job('job1','另一设备刚修改'),8,'r8');
  enqueue(s,'a_job1','application',job('job1','旧表单修改'),false,'form-save',5);
  assert.equal(s.outbox[0].baseRevision,5); // transport must report conflict, not write at revision 8.
});
