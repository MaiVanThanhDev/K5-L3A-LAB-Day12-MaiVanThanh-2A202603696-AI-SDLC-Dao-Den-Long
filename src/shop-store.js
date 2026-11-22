// Accessory shop storage (Node only). Same async API for both stores:
//   get(name) · earn(name, runId, score) · buy(name, itemId) · equip(name, itemId)  → { name, balance, owned, equipped }
// PgStore: PostgreSQL (DATABASE_URL, e.g. the docker compose `db` service). FileStore: JSON file, used when no database is set.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import * as R from './shop-rules.js';

export { ShopError } from './shop-rules.js';

export class FileStore {
  constructor(file) { this.file = file; this.kind = 'file'; this.queue = Promise.resolve(); }
  load() {
    try { const d = JSON.parse(readFileSync(this.file, 'utf8')); return d && typeof d.players === 'object' ? d.players : {}; } catch { return {}; }
  }
  save(players) {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.tmp`, JSON.stringify({ players }, null, 2) + '\n');
    renameSync(`${this.file}.tmp`, this.file);
  }
  // one change at a time: read → transition → write
  change(rawName, fn) {
    const run = this.queue.then(() => {
      const name = R.playerName(rawName), players = this.load();
      const next = fn(players[name] ?? R.newProfile(name));
      if (next !== players[name]) { players[name] = next; this.save(players); }
      return R.publicProfile(next);
    });
    this.queue = run.catch(() => {});
    return run;
  }
  async get(name) { const n = R.playerName(name); return R.publicProfile(this.load()[n] ?? R.newProfile(n)); }
  async earn(name, runId, score) { R.checkEarn(runId, score); return this.change(name, (p) => R.earn(p, runId, score)); }
  buy(name, itemId) { return this.change(name, (p) => R.buy(p, itemId)); }
  equip(name, itemId) { return this.change(name, (p) => R.equip(p, itemId)); }
  async close() {}
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shop_players (
  name       text PRIMARY KEY,
  balance    integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  equipped   jsonb   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop_owned (
  name      text NOT NULL REFERENCES shop_players(name) ON DELETE CASCADE,
  item_id   text NOT NULL,
  bought_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (name, item_id)
);
CREATE TABLE IF NOT EXISTS shop_earnings (
  run_id    text PRIMARY KEY,
  name      text NOT NULL REFERENCES shop_players(name) ON DELETE CASCADE,
  score     integer NOT NULL CHECK (score >= 0),
  earned_at timestamptz NOT NULL DEFAULT now()
);`;

export class PgStore {
  constructor(pool) { this.pool = pool; this.kind = 'postgres'; }
  static async connect(url, { retries = 20, delayMs = 1000 } = {}) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    for (let i = 0; ; i++) {
      try { await pool.query(SCHEMA); break; } catch (e) {
        if (i >= retries) { await pool.end(); throw new Error(`cannot reach PostgreSQL: ${e.message}`); }
        await new Promise((r) => setTimeout(r, delayMs)); // the db container may still be starting
      }
    }
    return new PgStore(pool);
  }
  async tx(fn) {
    const c = await this.pool.connect();
    try { await c.query('BEGIN'); const out = await fn(c); await c.query('COMMIT'); return out; } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
  // creates the row if needed and locks it for the rest of the transaction
  async lock(c, name) {
    await c.query('INSERT INTO shop_players (name, equipped) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [name, R.DEFAULT_OUTFIT]);
    return (await c.query('SELECT name, balance, equipped FROM shop_players WHERE name = $1 FOR UPDATE', [name])).rows[0];
  }
  async read(c, name) {
    const row = (await c.query('SELECT balance, equipped FROM shop_players WHERE name = $1', [name])).rows[0];
    if (!row) return R.publicProfile(R.newProfile(name));
    const owned = (await c.query('SELECT item_id FROM shop_owned WHERE name = $1 ORDER BY bought_at, item_id', [name])).rows.map((r) => r.item_id);
    return { name, balance: row.balance, owned, equipped: { ...R.DEFAULT_OUTFIT, ...row.equipped } };
  }
  async get(raw) { const name = R.playerName(raw); return this.read(this.pool, name); }
  async earn(raw, runId, score) {
    const name = R.playerName(raw);
    R.checkEarn(runId, score);
    return this.tx(async (c) => {
      await this.lock(c, name);
      const ins = await c.query('INSERT INTO shop_earnings (run_id, name, score) VALUES ($1, $2, $3) ON CONFLICT (run_id) DO NOTHING', [runId, name, score]);
      if (ins.rowCount === 1) await c.query('UPDATE shop_players SET balance = balance + $2 WHERE name = $1', [name, score]);
      return this.read(c, name);
    });
  }
  async buy(raw, itemId) {
    const name = R.playerName(raw), it = R.checkItem(itemId);
    return this.tx(async (c) => {
      const row = await this.lock(c, name);
      const owned = (await c.query('SELECT 1 FROM shop_owned WHERE name = $1 AND item_id = $2', [name, itemId])).rowCount > 0;
      // same checks and messages as the in-memory rules
      R.buy({ ...R.newProfile(name), balance: row.balance, owned: owned ? [itemId] : [] }, itemId);
      await c.query('UPDATE shop_players SET balance = balance - $2 WHERE name = $1', [name, it.price]);
      await c.query('INSERT INTO shop_owned (name, item_id) VALUES ($1, $2)', [name, itemId]);
      return this.read(c, name);
    });
  }
  async equip(raw, itemId) {
    const name = R.playerName(raw), it = R.checkItem(itemId);
    return this.tx(async (c) => {
      await this.lock(c, name);
      const owned = (await c.query('SELECT 1 FROM shop_owned WHERE name = $1 AND item_id = $2', [name, itemId])).rowCount > 0;
      R.equip({ ...R.newProfile(name), owned: owned ? [itemId] : [] }, itemId);
      await c.query('UPDATE shop_players SET equipped = equipped || $2::jsonb WHERE name = $1', [name, JSON.stringify({ [it.slot]: itemId })]);
      return this.read(c, name);
    });
  }
  async close() { await this.pool.end(); }
}

export async function openStore({ databaseUrl, file }) {
  return databaseUrl ? PgStore.connect(databaseUrl) : new FileStore(file);
}
