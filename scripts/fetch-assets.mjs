// Downloads the demos' 3D files and the robot game listed in assets/assets.json into assets/, checking each
// file's size and SHA-256. Files already present and correct are skipped. Node 18 or newer; no packages needed.
//
//   node scripts/fetch-assets.mjs [--base-url <address>]     (or: npm run fetch-assets)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const list = JSON.parse(fs.readFileSync(path.join(assetsDir, 'assets.json'), 'utf8'));
const baseFlag = process.argv.indexOf('--base-url');
const baseUrl = (baseFlag > 0 ? process.argv[baseFlag + 1] : list.base_url).replace(/\/+$/, '');

const sha256 = data => createHash('sha256').update(data).digest('hex');

// Downloads one file unless it's already there and correct. Returns 'ok' or 'fetched'; throws on failure.
async function fetchOne(url, target, { bytes, sha256: expected }) {
  if (fs.existsSync(target) && sha256(fs.readFileSync(target)) === expected) return 'ok';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length !== bytes || sha256(data) !== expected) throw new Error(`${url} does not match assets.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(`${target}.part`, data);
  fs.renameSync(`${target}.part`, target);
  return 'fetched';
}

// Every download as one item: a single file, or a folder (a page plus the files it loads) as a group.
const items = [
  ...list.files.map(entry => ({ name: entry.name, bytes: entry.bytes,
    parts: [{ url: `${baseUrl}/${entry.path}`, target: path.join(assetsDir, entry.name), entry }] })),
  ...(list.folders ?? []).map(folder => ({ name: `${folder.name}/ (${folder.files.length} files)`, bytes: folder.bytes,
    parts: folder.files.map(entry => ({ url: `${baseUrl}/${folder.path}/${entry.path}`, target: path.join(assetsDir, folder.name, entry.path), entry })) })),
];

let failures = 0;
for (const item of items) {
  const megabytes = (item.bytes / 1e6).toFixed(1);
  try {
    const results = [];
    for (const part of item.parts) results.push(await fetchOne(part.url, part.target, part.entry));
    console.log(`${results.includes('fetched') ? 'fetched' : 'ok     '}  ${item.name} (${megabytes} MB${results.includes('fetched') ? '' : ', already here'})`);
  } catch (error) {
    failures++;
    console.error(`FAILED   ${item.name}: ${error.cause?.message ?? error.message}`);
  }
}
if (failures) {
  console.error(`\n${failures} of ${items.length} downloads failed.`);
  process.exitCode = 1;
} else console.log(`\nEverything is in assets/.`);
