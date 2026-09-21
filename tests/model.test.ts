import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWebsite, parseApplications, parseProfile, resolveInitialState, summarize, summarizeCompanies, type Application } from '../src/model.ts';

test('统计投递并安全恢复损坏数据', () => {
  const apps: Application[] = [
    { id:'1', company:'A', role:'前端', location:'上海', website:'https://a.example/', appliedAt:'2026-08-30', status:'面试' },
    { id:'2', company:'B', role:'产品', location:'北京', website:'', appliedAt:'2026-08-30', status:'录用' },
  ];
  assert.deepEqual(summarize(apps), { 已投递:0, 笔试:0, 面试:1, 录用:1, 未通过:0 });
  assert.deepEqual(summarizeCompanies([...apps,{...apps[0],id:'3',role:'后端'}]), [
    { company:'A', count:2, website:'https://a.example/', positions:[{role:'前端',location:'上海',status:'面试'},{role:'后端',location:'上海',status:'面试'}], statuses:{ 已投递:0, 笔试:0, 面试:2, 录用:0, 未通过:0 } },
    { company:'B', count:1, website:'', positions:[{role:'产品',location:'北京',status:'录用'}], statuses:{ 已投递:0, 笔试:0, 面试:0, 录用:1, 未通过:0 } },
  ]);
  assert.deepEqual(parseApplications(null), []);
  assert.deepEqual(parseApplications('{broken'), []);
  assert.deepEqual(parseApplications(JSON.stringify(apps)), apps);
  assert.equal(parseApplications(JSON.stringify([...apps,{ company:'损坏记录' }])).length, 2);
  assert.equal(parseApplications(JSON.stringify([{...apps[0],status:'Offer'}]))[0].status, '录用');
  const rejected = parseApplications(JSON.stringify([{...apps[0],status:'未通过'}]));
  assert.equal(rejected.length, 1);
  assert.equal(summarize(rejected).未通过, 1);
  assert.equal(summarizeCompanies(rejected)[0].statuses.未通过, 1);
  assert.equal(normalizeWebsite('jobs.example.com'), 'https://jobs.example.com/');
  assert.equal(normalizeWebsite('javascript:alert(1)'), '');
  assert.equal(parseProfile(JSON.stringify({name:'张三',school:'清华大学',major:'计算机',degree:'本科'})).education, '清华大学 · 计算机 · 本科');
});

test('接口不可用时进入错误状态而不是显示空记录', () => {
  for (const value of [undefined,null,'loaded',{}, { status:'loaded', source:'main', data:null }]) assert.equal(resolveInitialState(value).status, 'error');
  assert.equal(resolveInitialState({ status:'empty', source:'none', data:null }).status, 'empty');
  assert.deepEqual(resolveInitialState({ status:'loaded', source:'main', data:{ applications:[] }, file:'C:\\data.json' }), { status:'loaded', source:'main', data:{ applications:[] }, file:'C:\\data.json' });
});
