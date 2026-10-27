// Where a demo gets its 3D files: assets/, where the fetch script downloaded them (see the README).
const ROOT = new URL('../../', import.meta.url);
let listing = null;

// A file's address, or for a folder (a page plus the files it loads, such as the robot game) its index.html.
export async function assetUrl(name) {
  listing ??= await (await fetch(new URL('assets/assets.json', ROOT))).json();
  const file = listing.files.find(entry => entry.name === name);
  const folder = (listing.folders ?? []).find(entry => entry.name === name);
  if (!file && !folder) throw new Error(`${name} is not listed in assets/assets.json`);
  const local = new URL(file ? `assets/${name}` : `assets/${name}/index.html`, ROOT);
  const head = await fetch(local, { method: 'HEAD' }).catch(() => null);
  if (!head?.ok) {
    throw new Error(`${name} hasn't been downloaded yet. Run "npm run fetch-assets" (or "python3 scripts/fetch_assets.py"), then reload.`);
  }
  return local.href;
}

// Downloads a file with progress, for demos that parse the bytes themselves.
export async function fetchBytes(url, onProgress = () => {}) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
