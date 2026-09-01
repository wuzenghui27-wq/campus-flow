const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { flushWrites, loadStore, migrateStore, readStore, recoverStore, writeStore } = require('../electron/store.cjs');

test('本机数据重开后仍可读取并合并更新', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-flow-store-'));
  t.after(() => fs.rm(dir, { recursive:true, force:true }));
  const file = path.join(dir, 'data.json');
  await writeStore(file, { profile:{ name:'张三' } });
  await writeStore(file, { applications:[{ id:'1' }] });
  assert.deepEqual(await readStore(file), { profile:{ name:'张三' }, applications:[{ id:'1' }] });
  const migrated = path.join(dir, 'new', 'data.json');
  assert.equal(await migrateStore(file, migrated), true);
  assert.deepEqual(await readStore(migrated), await readStore(file));
});

test('并发保存不丢字段，空主文件可从备份恢复', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-flow-recover-'));
  t.after(() => fs.rm(dir, { recursive:true, force:true }));
  const file = path.join(dir, 'data.json');
  await writeStore(file, { applications:[{ id:'1' }] });
  await Promise.all([writeStore(file, { profile:{ name:'张三' } }), writeStore(file, { resume:{ name:'简历.pdf' } })]);
  assert.equal((await readStore(file)).applications.length, 1);
  await writeStore(file, { applications:[] });
  assert.equal((await recoverStore(file)).applications.length, 1);
});

test('启动读取区分正常、首次启动、备份恢复和读取错误', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-flow-load-'));
  t.after(() => fs.rm(dir, { recursive:true, force:true }));
  const file = path.join(dir, 'data.json');
  assert.equal((await loadStore(file)).status, 'empty');
  await writeStore(file, { applications:[{ id:'1' }] });
  assert.deepEqual(await loadStore(file), { status:'loaded', source:'main', data:{ applications:[{ id:'1' }] } });
  await fs.copyFile(file, `${file}.bak`);
  await fs.writeFile(file, '{broken');
  assert.equal((await loadStore(file)).source, 'backup');
  assert.equal((await readStore(file)).applications.length, 1);
  const unreadable = path.join(dir, 'directory-as-file');
  await fs.mkdir(unreadable);
  assert.equal((await loadStore(unreadable)).status, 'error');
  await writeStore(file, { profile:{ name:'李四' } });
  await flushWrites();
  assert.equal((await readStore(file)).profile.name, '李四');
});
