// Tiny zero-dependency static server for the 3D client.  npm start  →  http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const ALLOWED = ['web/', 'src/', 'node_modules/three/build/', 'tests/scenarios/', 'game.contract.json'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8' };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  if (p === '') p = 'web/index.html';
  const rel = normalize(p).replace(/\\/g, '/');
  if (rel.startsWith('..') || !ALLOWED.some((a) => rel === a || rel.startsWith(a))) { res.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`Đảo Đèn Lồng đang chạy: http://localhost:${PORT}  (Ctrl+C để dừng)`));
