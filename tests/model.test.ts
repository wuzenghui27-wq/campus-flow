import assert from 'node:assert/strict';
import test from 'node:test';
import { extractProfile, parseApplications, summarize, summarizeCompanies, type Application } from '../src/model.ts';

test('统计投递并安全恢复损坏数据', () => {
  const apps: Application[] = [
    { id:'1', company:'A', role:'前端', location:'上海', appliedAt:'2026-08-30', status:'面试' },
    { id:'2', company:'B', role:'产品', location:'北京', appliedAt:'2026-08-30', status:'录用' },
  ];
  assert.deepEqual(summarize(apps), { 已投递:0, 笔试:0, 面试:1, 录用:1 });
  assert.deepEqual(summarizeCompanies([...apps,{...apps[0],id:'3',role:'后端'}]), [
    { company:'A', count:2, positions:[{role:'前端',location:'上海',status:'面试'},{role:'后端',location:'上海',status:'面试'}], statuses:{ 已投递:0, 笔试:0, 面试:2, 录用:0 } },
    { company:'B', count:1, positions:[{role:'产品',location:'北京',status:'录用'}], statuses:{ 已投递:0, 笔试:0, 面试:0, 录用:1 } },
  ]);
  assert.deepEqual(parseApplications(null), []);
  assert.deepEqual(parseApplications('{broken'), []);
  assert.deepEqual(parseApplications(JSON.stringify(apps)), apps);
  assert.equal(parseApplications(JSON.stringify([{...apps[0],status:'Offer'}]))[0].status, '录用');
});

test('从中文简历文本提取个人信息', () => {
  assert.deepEqual(extractProfile(`张三\n手机：138 1234 5678\n邮箱 zhangsan@example.com\n教育经历\n清华大学\n专业：计算机科学与技术\n本科`), {
    name:'张三', phone:'13812345678', email:'zhangsan@example.com', school:'清华大学', major:'计算机科学与技术', degree:'本科',
  });
});
