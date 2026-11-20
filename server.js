// Tiny zero-dependency server for the 3D client.  npm start  →  http://localhost:5173
// Also hosts the local leaderboard (stored on disk) and its export command:
//   npm start -- --export-leaderboard out.json     (or: node server.js --export-leaderboard out.json)
// Leaderboard file: $LEADERBOARD_FILE, default <repo>/data/leaderboard.json
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join, normalize, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, insert, load, save } from './src/leaderboard.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const LB_FILE = resolve(process.env.LEADERBOARD_FILE || join(ROOT, 'data', 'leaderboard.json'));
const ALLOWED = ['web/', 'src/', 'node_modules/three/build/', 'tests/scenarios/', 'game.contract.json'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const argv = process.argv.slice(2);
const exp = argv.indexOf('--export-leaderboard');
if (exp >= 0) {
  const out = argv[exp + 1];
  if (!out) { process.stderr.write('usage: --export-leaderboard <out.json>\n'); process.exit(1); }
  writeFileSync(out, JSON.stringify({ entries: load(LB_FILE) }, null, 2) + '\n');
  console.log(`leaderboard (${load(LB_FILE).length} entries) → ${out}`);
  process.exit(0);
}

const json = (res, code, body) => res.writeHead(code, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(body));

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/leaderboard') {
    if (req.method === 'GET') return json(res, 200, { entries: load(LB_FILE) });
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: 'too large' }); }
      let input;
      try { input = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid JSON' }); }
      const { entry, error } = validate(input);
      if (error) return json(res, 400, { error });
      const { entries, rank } = insert(load(LB_FILE), entry);
      try { save(LB_FILE, entries); } catch (e) { return json(res, 500, { error: `cannot save: ${e.message}` }); }
      return json(res, 200, { entries, rank });
    }
    return json(res, 405, { error: 'method not allowed' });
  }
  let p = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (p === '') p = 'web/index.html';
  const rel = normalize(p).replace(/\\/g, '/');
  if (rel.startsWith('..') || !ALLOWED.some((a) => rel === a || rel.startsWith(a))) { res.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`Đảo Đèn Lồng đang chạy: http://localhost:${PORT}  (Ctrl+C để dừng)`));
