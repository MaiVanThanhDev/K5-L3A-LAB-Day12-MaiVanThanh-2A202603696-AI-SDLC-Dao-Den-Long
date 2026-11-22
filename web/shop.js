// Accessory shop client: server API (/api/shop/*, PostgreSQL or JSON file behind it) with a browser-storage fallback
// that applies the same rules (src/shop-rules.js) when the game is served statically. No gameplay rules here.
import * as R from '/src/shop-rules.js';

const LOCAL = 'ddl-shop-local', PENDING = 'ddl-shop-pending', NAME = 'ddl-last-name';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const savedName = () => { try { return localStorage.getItem(NAME) || ''; } catch { return ''; } };
export const setSavedName = (n) => { try { localStorage.setItem(NAME, n); } catch { /* ignore */ } };
export const validName = (n) => { try { return R.playerName(n); } catch { return null; } };

class Offline extends Error {}
let browserOnly = false;

async function server(op, body, query = '') {
  if (browserOnly) throw new Offline();
  let r;
  try {
    r = await fetch(`/api/shop/${op}${query}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  } catch { browserOnly = true; throw new Offline(); }
  const data = await r.json().catch(() => null);
  if (r.ok && data) return data;
  if (data && data.error) throw new R.ShopError(data.error, r.status);
  browserOnly = true; throw new Offline(); // static hosting: no API route
}

// browser fallback: { players: { name: profile } } in localStorage
function local(rawName, fn) {
  const name = R.playerName(rawName), db = read(LOCAL, { players: {} });
  const before = db.players[name] ?? R.newProfile(name);
  const after = fn ? fn(before) : before;
  if (fn && after !== before) { db.players[name] = after; if (!write(LOCAL, db)) throw new R.ShopError('không lưu được trong trình duyệt'); }
  return { ...R.publicProfile(after), storage: 'browser' };
}

async function call(op, name, extra, apply) {
  try { return await server(op, op === 'profile' ? null : { name, ...extra }, op === 'profile' ? `?name=${encodeURIComponent(name)}` : ''); } catch (e) {
    if (!(e instanceof Offline)) throw e;
    return local(name, apply);
  }
}
export const getProfile = (name) => call('profile', name, {}, null);
export const buyItem = (name, item) => call('buy', name, { item }, (p) => R.buy(p, item));
export const equipItem = (name, item) => call('equip', name, { item }, (p) => R.equip(p, item));

// xu of finished Nights wait here until there is a player name, then are paid once each (run_id)
export const pendingXu = () => read(PENDING, []).reduce((a, e) => a + e.score, 0);
export function queueEarn(runId, score) { const list = read(PENDING, []); list.push({ run_id: runId, score }); write(PENDING, list); }
export async function flushEarnings(name) {
  let list = read(PENDING, []), profile = null;
  while (list.length) {
    const e = list[0];
    try { profile = await call('earn', name, { run_id: e.run_id, score: e.score }, (p) => R.earn(p, e.run_id, e.score)); } catch (err) {
      if (!(err instanceof R.ShopError) || err.status >= 500) break; // keep it for later
    }
    list = list.slice(1); write(PENDING, list); // paid, or rejected for good (invalid)
  }
  return profile ?? getProfile(name);
}
