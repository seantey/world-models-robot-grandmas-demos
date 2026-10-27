// A small static server for the demos (browsers won't run them from file:// pages). Node 18 or newer.
//
//   node scripts/serve.mjs [port]     (or: npm run serve)      default port 8080
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.spz': 'application/octet-stream',
};

const server = http.createServer((request, response) => {
  let file = path.join(root, path.normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)));
  if (!file.startsWith(root)) { response.writeHead(403); return response.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { response.writeHead(404, { 'Content-Type': 'text/plain' }); return response.end('Not found\n'); }
  const data = fs.readFileSync(file);
  response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : data);
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use; try: node scripts/serve.mjs ${port + 1}` : error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => console.log(`Demos at http://localhost:${port}/  (Ctrl+C to stop)`));
