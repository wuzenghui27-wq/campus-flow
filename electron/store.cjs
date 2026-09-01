const fs = require('node:fs/promises');
const path = require('node:path');
let writes = Promise.resolve();

async function inspectStore(filePath) {
  try {
    const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return { exists:true, data:value && typeof value === 'object' && !Array.isArray(value) ? value : null };
  } catch (error) { return { exists:error.code !== 'ENOENT', data:null }; }
}

async function readStore(filePath) {
  return (await inspectStore(filePath)).data;
}

async function replace(filePath, value, backup=true) {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > 1024 * 1024) throw new RangeError('Data is too large');
  await fs.mkdir(path.dirname(filePath), { recursive:true });
  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, json, 'utf8');
  if (backup) await fs.copyFile(filePath, `${filePath}.bak`).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await fs.rename(temporary, filePath);
}

async function write(filePath, patch, current) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Invalid data');
  const value = { ...(current ?? await readStore(filePath) ?? {}), ...patch };
  await replace(filePath, value);
  return value;
}

function writeStore(filePath, patch, current) {
  const result = writes.then(() => write(filePath, patch, current));
  writes = result.catch(() => {});
  return result;
}

function flushWrites() { return writes; }

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
  if (recovered) {
    await replaceStore(filePath, recovered, false);
    await fs.copyFile(filePath, `${filePath}.bak`);
  }
  return recovered;
}

function replaceStore(filePath, value, backup=true) {
  const result = writes.then(() => replace(filePath, value, backup));
  writes = result.catch(() => {});
  return result;
}

async function loadStore(filePath, alternates=[]) {
  const main = await inspectStore(filePath);
  if (main.data) return { status:'loaded', source:'main', data:main.data };
  const backup = await inspectStore(`${filePath}.bak`);
  if (backup.data) {
    await replaceStore(filePath, backup.data, false);
    return { status:'loaded', source:'backup', data:backup.data };
  }
  for (const alternate of alternates) {
    const candidate = await inspectStore(alternate);
    if (candidate.data) {
      await replaceStore(filePath, candidate.data, false);
      return { status:'loaded', source:'legacy', data:candidate.data };
    }
    if (candidate.exists) return { status:'error', source:'none', data:null };
  }
  return main.exists || backup.exists ? { status:'error', source:'none', data:null } : { status:'empty', source:'none', data:null };
}

module.exports = { flushWrites, loadStore, migrateStore, readStore, recoverStore, writeStore };
