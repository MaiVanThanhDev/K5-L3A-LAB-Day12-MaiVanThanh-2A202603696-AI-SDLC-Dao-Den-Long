// Tiny zero-dependency server for the 3D client.  npm start  →  http://localhost:5173
// Also hosts the local leaderboard (stored on disk) and its export command:
//   npm start -- --export-leaderboard out.json     (or: node server.js --export-leaderboard out.json)
// Leaderboard file: $LEADERBOARD_FILE, default <repo>/data/leaderboard.json
// Accessory shop (xu earned after every Night): PostgreSQL when $DATABASE_URL is set (docker compose up), otherwise
// a JSON file $SHOP_FILE (default <repo>/data/shop.json).
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join, normalize, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, insert, load, save } from './src/leaderboard.js';
import { openStore, ShopError } from './src/shop-store.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const LB_FILE = resolve(process.env.LEADERBOARD_FILE || join(ROOT, 'data', 'leaderboard.json'));
const SHOP_FILE = resolve(process.env.SHOP_FILE || join(ROOT, 'data', 'shop.json'));
const ALLOWED = ['web/', 'src/', 'node_modules/three/build/', 'tests/scenarios/', 'game.contract.json'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
// Installable app (PWA): the service worker must be served from the root so its scope covers the whole game.
const ALIASES = { 'sw.js': 'web/sw.js', 'manifest.webmanifest': 'web/manifest.webmanifest' };

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
async function readBody(req, limit = 4096) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > limit) throw new ShopError('too large', 413); }
  try { return JSON.parse(body); } catch { throw new ShopError('invalid JSON'); }
}

let shop;
try { shop = await openStore({ databaseUrl: process.env.DATABASE_URL, file: SHOP_FILE }); } catch (e) { process.stderr.write(`shop: ${e.message}
`); process.exit(1); }
console.log(`Cửa hàng: lưu ở ${shop.kind === 'postgres' ? 'PostgreSQL' : SHOP_FILE}`);
// GET /api/shop/profile?name=  ·  POST /api/shop/earn {name, run_id, score}  ·  POST /api/shop/buy|equip {name, item}
async function shopRoute(req, res, url) {
  try {
    const op = url.pathname.slice('/api/shop/'.length);
    let profile;
    if (op === 'profile' && req.method === 'GET') profile = await shop.get(url.searchParams.get('name'));
    else if (['earn', 'buy', 'equip'].includes(op) && req.method === 'POST') {
      const b = await readBody(req);
      if (!b || typeof b !== 'object') throw new ShopError('body must be a JSON object');
      profile = op === 'earn' ? await shop.earn(b.name, b.run_id, b.score) : await shop[op](b.name, b.item);
    } else return json(res, op === 'profile' || ['earn', 'buy', 'equip'].includes(op) ? 405 : 404, { error: 'not found' });
    return json(res, 200, { ...profile, storage: shop.kind });
  } catch (e) {
    if (e instanceof ShopError) return json(res, e.status, { error: e.message });
    process.stderr.write(`shop: ${e.stack || e}
`);
    return json(res, 500, { error: 'lỗi máy chủ' });
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/shop/')) return shopRoute(req, res, url);
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
  if (ALIASES[p]) p = ALIASES[p];
  const rel = normalize(p).replace(/\\/g, '/');
  if (rel.startsWith('..') || !ALLOWED.some((a) => rel === a || rel.startsWith(a))) { res.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => {
  console.log(`Đảo Đèn Lồng đang chạy: http://localhost:${PORT}  (Ctrl+C để dừng)`);
  // phones on the same Wi-Fi can play in the browser (touch controls turn on by themselves)
  const lan = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => `http://${a.address}:${PORT}`);
  if (lan.length) console.log(`Điện thoại cùng mạng Wi-Fi: ${lan.join('  ')}`);
});
