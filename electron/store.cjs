const fs = require('node:fs/promises');
const path = require('node:path');
let writes = Promise.resolve();

async function readStore(filePath) {
  try {
    const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

async function write(filePath, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Invalid data');
  const json = JSON.stringify({ ...(await readStore(filePath) ?? {}), ...patch });
  if (Buffer.byteLength(json) > 1024 * 1024) throw new RangeError('Data is too large');
  await fs.mkdir(path.dirname(filePath), { recursive:true });
  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, json, 'utf8');
  await fs.copyFile(filePath, `${filePath}.bak`).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await fs.rename(temporary, filePath);
}

function writeStore(filePath, patch) {
  const result = writes.then(() => write(filePath, patch));
  writes = result.catch(() => {});
  return result;
}

async function migrateStore(fromPath, toPath) {
  if (await readStore(toPath)) return false;
  const legacy = await readStore(fromPath);
  if (!legacy) return false;
  await fs.mkdir(path.dirname(toPath), { recursive:true });
  await writeStore(toPath, legacy);
  return true;
}

async function recoverStore(filePath, alternates=[]) {
  const values = await Promise.all([filePath, `${filePath}.bak`, ...alternates].map(readStore));
  const recovered = values.filter(Boolean).sort((a,b) => (b.applications?.length ?? 0) - (a.applications?.length ?? 0))[0] ?? null;
  if (recovered) await writeStore(filePath, recovered);
  return recovered;
}

module.exports = { migrateStore, readStore, recoverStore, writeStore };
