const fs = require('node:fs/promises');
const path = require('node:path');

async function readStore(filePath) {
  try {
    const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

async function writeStore(filePath, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Invalid data');
  const json = JSON.stringify({ ...(await readStore(filePath) ?? {}), ...patch });
  if (Buffer.byteLength(json) > 1024 * 1024) throw new RangeError('Data is too large');
  await fs.writeFile(filePath, json, 'utf8');
}

async function migrateStore(fromPath, toPath) {
  if (await readStore(toPath)) return false;
  const legacy = await readStore(fromPath);
  if (!legacy) return false;
  await fs.mkdir(path.dirname(toPath), { recursive:true });
  await writeStore(toPath, legacy);
  return true;
}

module.exports = { migrateStore, readStore, writeStore };
