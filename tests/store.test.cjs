const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { migrateStore, readStore, writeStore } = require('../electron/store.cjs');

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
