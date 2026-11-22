// Accessory shop cases (creative feature on branch feature/shop-scenery, not part of the game contract).
// Expected values come from the catalog prices in src/shop-rules.js and hand arithmetic, never from a run.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './cases.js';
import * as R from '../src/shop-rules.js';
import { FileStore, PgStore } from '../src/shop-store.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rejects = async (p, status, re) => { await assert.rejects(p, (e) => e instanceof R.ShopError && e.status === status && re.test(e.message)); };

// One flow shared by the file store and PostgreSQL: earn 700 + 450, buy, equip, errors.
async function storeFlow(store, name) {
  let p = await store.get(name);
  assert.deepEqual(p, { name, balance: 0, owned: [], equipped: R.DEFAULT_OUTFIT });
  p = await store.earn(name, `${name}-run1`, 700);
  assert.equal(p.balance, 700);
  p = await store.earn(name, `${name}-run1`, 700); // same Night again → not paid twice
  assert.equal(p.balance, 700);
  p = await store.buy(name, 'hat_quaithao'); // 700 − 600 = 100
  assert.equal(p.balance, 100); assert.deepEqual(p.owned, ['hat_quaithao']);
  await rejects(store.buy(name, 'shirt_do'), 409, /Chưa đủ xu: cần 400, đang có 100/);
  await rejects(store.buy(name, 'hat_quaithao'), 409, /đã có/);
  await rejects(store.equip(name, 'shoes_vang'), 409, /mua món này trước/);
  await rejects(store.buy(name, 'hat_vuongmien'), 404, /Không có món/);
  p = await store.equip(name, 'hat_quaithao');
  assert.equal(p.equipped.hat, 'hat_quaithao');
  p = await store.earn(name, `${name}-run2`, 450); // 100 + 450 = 550 → shirt_do (400) → 150
  p = await store.buy(name, 'shirt_do');
  assert.equal(p.balance, 150);
  p = await store.equip(name, 'shirt_do');
  p = await store.equip(name, 'shoes_nau'); // starting items are always wearable
  assert.deepEqual(p.equipped, { hat: 'hat_quaithao', shirt: 'shirt_do', pants: 'pants_cham', shoes: 'shoes_nau' });
  await rejects(store.get('ab'), 400, /3–12/);
  return p;
}

export const casesShop = [
  {
    id: 'SH1', req: 'Danh mục: 4 ô (nón, áo, quần, giày), mỗi ô đúng 1 món khởi đầu giá 0, giá là số nguyên ≥ 0, id không trùng',
    run() {
      assert.equal(new Set(R.CATALOG.map((it) => it.id)).size, R.CATALOG.length);
      for (const s of R.SLOTS) assert.equal(R.CATALOG.filter((it) => it.slot === s && it.price === 0).length, 1, s);
      for (const it of R.CATALOG) { assert.ok(R.SLOTS.includes(it.slot)); assert.ok(Number.isInteger(it.price) && it.price >= 0); }
      assert.ok(R.CATALOG.filter((it) => it.slot === 'hat').every((it) => typeof it.style === 'string'));
      return `${R.CATALOG.length} món; mặc định ${Object.values(R.DEFAULT_OUTFIT).join(', ')}`;
    },
  },
  {
    id: 'SH2', req: 'Nhận xu sau mỗi Đêm: +điểm của Đêm đó, mỗi run_id chỉ một lần; điểm ngoài 0–5000, run_id sai → lỗi',
    run() {
      let p = R.newProfile('Mây');
      p = R.earn(p, 'r1', 1063); p = R.earn(p, 'r2', 220); p = R.earn(p, 'r1', 1063);
      assert.equal(p.balance, 1063 + 220);
      for (const [id, sc] of [['r3', -1], ['r3', 5001], ['r3', 1.5], ['', 10], ['a b', 10], ['x'.repeat(65), 10]]) assert.throws(() => R.earn(p, id, sc), R.ShopError, `${id}/${sc}`);
      assert.equal(R.earn(p, 'r4', R.MAX_EARN).balance, 1283 + 5000);
      return '1063 + 220 = 1283 (r1 lần 2 không cộng); 6 đầu vào sai bị từ chối; 5000 là mức trần';
    },
  },
  {
    id: 'SH3', req: 'Mua và mặc: trừ đúng giá, không đủ xu / đã có / chưa mua mà mặc / món lạ → lỗi và không đổi số dư',
    run() {
      let p = R.earn(R.newProfile('Mây'), 'r1', 900);
      assert.throws(() => R.buy(p, 'hat_mugam'), /Chưa đủ xu: cần 1500, đang có 900/);
      p = R.buy(p, 'hat_khanvan'); // 900 − 900 = 0
      assert.equal(p.balance, 0);
      assert.throws(() => R.buy(p, 'hat_khanvan'), /đã có/);
      assert.throws(() => R.buy(p, 'hat_nonla'), /đã có/); // starting item
      assert.throws(() => R.equip(p, 'shirt_gam'), /mua món này trước/);
      assert.throws(() => R.equip(p, 'nope'), /Không có món/);
      p = R.equip(p, 'hat_khanvan');
      assert.equal(p.equipped.hat, 'hat_khanvan');
      assert.deepEqual(R.outfitItems({ hat: 'shirt_do', shirt: 'zzz' }).hat.id, 'hat_nonla'); // wrong slot / unknown → default
      return 'khăn vấn 900 → còn 0; mũ gấm 1500 bị từ chối khi có 900; mặc áo gấm chưa mua bị từ chối';
    },
  },
  {
    id: 'SH4', req: 'Server không có DATABASE_URL: lưu file JSON qua /api/shop/*, còn sau khi tắt và bật lại server',
    async run() {
      const dir = mkdtempSync(join(tmpdir(), 'ddl-shop-'));
      const env = { ...process.env, SHOP_FILE: join(dir, 'shop.json'), LEADERBOARD_FILE: join(dir, 'lb.json') };
      delete env.DATABASE_URL;
      const start = async () => {
        const port = 20000 + Math.floor(Math.random() * 10000);
        const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...env, PORT: String(port) }, stdio: 'ignore' });
        const base = `http://127.0.0.1:${port}/api/shop`;
        for (let i = 0; i < 50; i++) { try { if ((await fetch(`${base}/profile?name=Probe`)).ok) break; } catch { /* starting */ } await wait(100); }
        return { srv, base };
      };
      const post = (base, op, b) => fetch(`${base}/${op}`, { method: 'POST', body: JSON.stringify(b) });
      let { srv, base } = await start();
      try {
        assert.equal((await post(base, 'earn', { name: 'Mây_01', run_id: 's1-1-1', score: 800 })).status, 200);
        const b = await (await post(base, 'buy', { name: 'Mây_01', item: 'hat_rom' })).json(); // 800 − 300 = 500
        assert.equal(b.balance, 500); assert.equal(b.storage, 'file');
        assert.equal((await post(base, 'buy', { name: 'Mây_01', item: 'shirt_gam' })).status, 409);
        assert.equal((await post(base, 'earn', { name: 'ab', run_id: 'x', score: 1 })).status, 400);
        assert.equal((await post(base, 'equip', { name: 'Mây_01', item: 'hat_rom' })).status, 200);
      } finally { srv.kill(); }
      await wait(200);
      ({ srv, base } = await start());
      try {
        const p = await (await fetch(`${base}/profile?name=${encodeURIComponent('Mây_01')}`)).json();
        assert.equal(p.balance, 500); assert.deepEqual(p.owned, ['hat_rom']); assert.equal(p.equipped.hat, 'hat_rom');
      } finally { srv.kill(); }
      const f = new FileStore(join(dir, 'flow.json'));
      await storeFlow(f, 'Lan_02');
      return 'earn 800 → mua mũ rơm 300 → 500; áo gấm 409; tên sai 400; bật lại server vẫn 500 xu + mũ rơm đang đội; luồng đầy đủ trên FileStore đạt';
    },
  },
  {
    id: 'SH5', req: 'PostgreSQL (docker compose): cùng luồng mua bán; hai lệnh mua song song chỉ một lệnh thành công, số dư không âm',
    skip: !process.env.SHOP_TEST_DATABASE_URL && 'đặt SHOP_TEST_DATABASE_URL (ví dụ postgres://ddl:ddl@localhost:5433/ddl) để chạy',
    async run() {
      const store = await PgStore.connect(process.env.SHOP_TEST_DATABASE_URL, { retries: 3 });
      try {
        const name = `t${Date.now().toString(36).slice(-8)}`;
        await storeFlow(store, name);
        // 150 xu left; two parallel buys of shoes_do (200)… first top up to 150 + 100 = 250 → exactly one buy of 200 can pass
        await store.earn(name, `${name}-run3`, 100);
        const r = await Promise.allSettled([store.buy(name, 'shoes_do'), store.buy(name, 'shoes_do')]);
        assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
        const p = await store.get(name);
        assert.equal(p.balance, 50); assert.ok(p.owned.includes('shoes_do'));
        await store.pool.query('DELETE FROM shop_players WHERE name = $1', [name]);
        return `luồng đầy đủ trên PostgreSQL đạt; 2 lệnh mua song song → 1 thành công, còn 250 − 200 = 50 xu`;
      } finally { await store.close(); }
    },
  },
];
