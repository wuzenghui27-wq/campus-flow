const assert = require('node:assert/strict');
const test = require('node:test');
const { isNewerVersion } = require('../electron/update.cjs');

test('只在远程版本较新时提示更新', () => {
  assert.equal(isNewerVersion('1.0.6', '1.0.5'), true);
  assert.equal(isNewerVersion('1.0.5', '1.0.5'), false);
  assert.equal(isNewerVersion('1.0.4', '1.0.5'), false);
});
