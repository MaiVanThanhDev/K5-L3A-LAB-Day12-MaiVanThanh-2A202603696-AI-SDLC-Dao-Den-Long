// Phase 4 cases (Ticket-04, Test Contract v1.3): leaderboard rules + storage + export, bench scene, soak, contract keys.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, TUNING, runHeadless, end, snapAt } from './cases.js';
import { validate, insert, isoWithOffset, MAX_ENTRIES } from '../src/leaderboard.js';
import { Game } from '../src/sim/game.js';
import { benchScenario, benchCamera } from '../src/sim/bench.js';

const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const entry = (name, score, at) => ({ name, score, nights_won: 1, achieved_at: at, seed: 1 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const cases4 = [
  {
    id: 'R1', req: 'Contract v1.3: contract_version "1.3", có bench_cmd và soak_cmd; yêu cầu v1.0–v1.2 giữ nguyên (headless vẫn chạy)',
    run() {
      assert.equal(contract.contract_version, '1.3');
      assert.equal(contract.bench_cmd, 'node scripts/bench.js'); assert.equal(contract.soak_cmd, 'node scripts/soak.js');
      const r = runHeadless({ ticks: 10 });
      assert.equal(r.code, 0); assert.equal(end(r).ticks, 10);
      return `bench_cmd="${contract.bench_cmd}", soak_cmd="${contract.soak_cmd}"; headless vẫn chạy`;
    },
  },
  {
    id: 'R2', req: 'Bảng xếp hạng: tên 3–12 ký tự [A-Za-z0-9_] (tiếng Việt có dấu được chấp nhận); score/nights_won/seed hợp lệ; achieved_at ISO 8601 có múi giờ',
    run() {
      for (const ok of ['May', 'Mai_Thanh_12', 'Mây', 'Đèn_Lồng', 'abc']) assert.ok(validate({ name: ok, score: 1, nights_won: 0, seed: 1 }).entry, ok);
      for (const bad of ['ab', 'abcdefghijklm', 'a b c', 'tên!', '', 'x-y-z']) assert.ok(validate({ name: bad, score: 1, nights_won: 0, seed: 1 }).error, bad);
      assert.ok(validate({ name: 'abc', score: -1, nights_won: 0, seed: 1 }).error);
      assert.ok(validate({ name: 'abc', score: 5, nights_won: 4, seed: 1 }).error);
      assert.ok(validate({ name: 'abc', score: 5, nights_won: 1, seed: 1.5 }).error);
      const at = validate({ name: 'abc', score: 5, nights_won: 1, seed: 3 }).entry.achieved_at;
      assert.match(at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
      assert.equal(Math.abs(Date.parse(at) - Date.now()) < 5000, true);
      assert.match(isoWithOffset(new Date('2026-11-20T09:00:00Z')), /[+-]\d{2}:\d{2}$/);
      return `5 tên hợp lệ (có "Mây", "Đèn_Lồng"), 6 tên sai bị từ chối; achieved_at = ${at}`;
    },
  },
  {
    id: 'R3', req: 'Bảng xếp hạng: điểm giảm dần, bằng điểm thì ai đạt trước đứng trên, giữ top 10',
    run() {
      let list = [];
      const base = Date.parse('2026-11-20T10:00:00+07:00');
      for (let i = 0; i < 12; i++) list = insert(list, entry(`P${i}x`, (i % 4) * 100, new Date(base + i * 1000).toISOString())).entries;
      assert.equal(list.length, MAX_ENTRIES);
      assert.deepEqual(list.map((e) => e.score), [300, 300, 300, 200, 200, 200, 100, 100, 100, 0]);
      assert.deepEqual(list.slice(0, 3).map((e) => e.name), ['P3x', 'P7x', 'P11x']); // equal score → earlier first
      const r = insert(list, entry('Late', 300, new Date(base + 99000).toISOString()));
      assert.equal(r.rank, 4);
      const out = insert(list, entry('Zero', 0, new Date(base + 99000).toISOString()));
      assert.equal(out.rank, null); assert.equal(out.entries.length, 10);
      return '12 lần lưu → còn 10; 300,300,300 theo thứ tự đạt (P3x, P7x, P11x); điểm 300 đến muộn xếp hạng 4; điểm 0 đến muộn bị loại';
    },
  },
  {
    id: 'R4', req: 'Bảng xếp hạng lưu trên đĩa qua server (POST/GET /api/leaderboard), còn sau khi tắt server; <run_cmd> --export-leaderboard out.json → {"entries": [...]} đúng thứ tự',
    async run() {
      const dir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
      const file = join(dir, 'lb.json'), port = 20000 + Math.floor(Math.random() * 10000); // outside fetch()'s blocked ports (e.g. 6665–6669)
      const env = { ...process.env, PORT: String(port), LEADERBOARD_FILE: file };
      const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });
      try {
        for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/leaderboard`)).ok) break; } catch { /* starting */ } await wait(100); }
        const post = (b) => fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST', body: JSON.stringify(b) });
        assert.equal((await post({ name: 'Alpha', score: 300, nights_won: 1, seed: 11 })).status, 200);
        assert.equal((await post({ name: 'Bravo', score: 900, nights_won: 3, seed: 12 })).status, 200);
        assert.equal((await post({ name: 'Al', score: 9, nights_won: 0, seed: 1 })).status, 400);
        const got = await (await fetch(`http://127.0.0.1:${port}/api/leaderboard`)).json();
        assert.deepEqual(got.entries.map((e) => e.name), ['Bravo', 'Alpha']);
      } finally { srv.kill(); }
      await wait(200);
      const out = join(dir, 'out.json');
      const ex = spawnSync(process.execPath, ['server.js', '--export-leaderboard', out], { cwd: ROOT, env, encoding: 'utf8' });
      assert.equal(ex.status, 0);
      const data = JSON.parse(readFileSync(out, 'utf8'));
      assert.deepEqual(Object.keys(data), ['entries']);
      assert.deepEqual(data.entries.map((e) => [e.name, e.score, e.nights_won, e.seed]), [['Bravo', 900, 3, 12], ['Alpha', 300, 1, 11]]);
      for (const e of data.entries) assert.deepEqual(Object.keys(e).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
      return 'POST 2 điểm + 1 tên sai (400); tắt server; --export-leaderboard ra {"entries":[Bravo 900, Alpha 300]} đủ 5 trường';
    },
  },
  {
    id: 'R5', req: 'Cảnh benchmark: Đêm 1, đúng 200 Bóng Mực wander rải đều (seed 42) + 100 đom đóm, L1–L3 sáng fuel 100; tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm; Bóng Mực vẫn di chuyển',
    run() {
      const sc = benchScenario(42);
      assert.equal(sc.shades.length, 200); assert.equal(sc.motes.length, 100);
      assert.ok(sc.shades.every((s) => s.state === 'wander' && Math.hypot(s.pos[0], s.pos[2]) <= 40));
      assert.deepEqual(benchScenario(42), sc, 'same seed → same scene');
      const g = new Game({ tuning: TUNING, seed: 42, night: 1, scenario: sc, bench: true });
      const p0 = g.shades.map((s) => [...s.pos]);
      for (let k = 0; k < 18000; k++) g.step({ move: [0, 0] }); // 300 s, longer than the night
      assert.equal(g.state, 'playing'); assert.equal(g.shades.length, 200); assert.equal(g.motes.length, 100);
      assert.deepEqual(g.lanterns.map((l) => [l.id, l.lit, l.fuel / 60]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
      assert.equal(g.player.flames, TUNING.flames); assert.equal(g.player.carried, 0);
      assert.ok(g.shades.every((s) => s.state === 'wander'));
      const moved = g.shades.filter((s, i) => Math.hypot(s.pos[0] - p0[i][0], s.pos[2] - p0[i][2]) > 1).length;
      assert.ok(moved > 150, `moved ${moved}`);
      return `200 bóng + 100 đom đóm; sau 18.000 tick: vẫn playing, không sinh thêm, fuel L1–L3 = 100, lửa 3, carried 0, ${moved}/200 bóng đã di chuyển (wander)`;
    },
  },
  {
    id: 'R6', req: 'Camera bench: vòng tròn tâm (0,0,0) bán kính 30 m, Y = 15, bắt đầu ở (30,15,0), ngược chiều kim đồng hồ nhìn từ trên, 15 s một vòng',
    run() {
      const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));
      near(benchCamera(0), [30, 15, 0]);
      near(benchCamera(3.75), [0, 15, 30]); // +90° in the map convention (x = r·cos a, z = r·sin a)
      near(benchCamera(7.5), [-30, 15, 0]);
      near(benchCamera(15), [30, 15, 0]);
      return 't=0 (30,15,0) → 3.75 s (0,15,30) → 7.5 s (−30,15,0) → 15 s về (30,15,0)';
    },
  },
  {
    id: 'R7', req: 'Soak: chạy nhiều Đêm trong một tiến trình (1→2→3), seed 7 + i, ghi nights/crashes/results/mem_start_mb/mem_end_mb/duration_s; crashes = 0, mem_end ≤ 1.2 × mem_start',
    run() {
      const out = join(mkdtempSync(join(tmpdir(), 'ddl-soak-')), 'soak.json');
      const r = spawnSync(process.execPath, ['scripts/soak.js', '--seed', '7', '--nights', '4', '--out', out], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const s = JSON.parse(readFileSync(out, 'utf8'));
      for (const k of ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']) assert.ok(k in s, k);
      assert.equal(s.nights, 4); assert.equal(s.crashes, 0); assert.equal(s.results.length, 4);
      assert.deepEqual(s.per_night.map((n) => [n.night, n.seed]), [[1, 7], [2, 8], [3, 9], [1, 10]]);
      assert.ok(s.results.every((x) => x === 'won' || x === 'lost'));
      assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} > 1.2 × ${s.mem_start_mb}`);
      return `4 Đêm: ${s.results.join(',')}, 0 crash, RSS ${s.mem_start_mb} → ${s.mem_end_mb} MB, heap ${s.heap_used_start_mb} → ${s.heap_used_end_mb} MB`;
    },
  },
  {
    id: 'R8', req: 'Vật cản trang trí (đá, cây) chỉ có ở client: chặn Mây và cho trượt dọc; vật cản thấp nhảy qua được; headless không truyền vật cản nên đầu ra contract không đổi',
    run() {
      const sc = { random_motes: false, random_shades: false, motes: [], shades: [], random_drifters: false };
      const go = (obstacles, inputs) => {
        const g = new Game({ tuning: TUNING, seed: 1, night: 1, scenario: sc, obstacles });
        for (let k = 0; k < 120; k++) g.step(inputs(k));
        return g.player.pos;
      };
      const fwd = () => ({ move: [0, 1] });
      // tree (r 0.5, h 4) at z = 5 straight ahead: player stops at 5 − (0.5 + 0.4) = 4.1
      const blocked = go([{ x: 0, z: 5, r: 0.5, h: 4 }], fwd);
      assert.ok(Math.abs(blocked[2] - 4.1) < 0.02 && Math.abs(blocked[0]) < 1e-6, JSON.stringify(blocked));
      // slightly off-centre: slides around it and keeps going (z ends past the tree)
      const slide = go([{ x: 0.2, z: 5, r: 0.5, h: 4 }], fwd);
      assert.ok(slide[2] > 8, JSON.stringify(slide));
      // low rock (h 0.6) jumped over: no block while the feet are above 0.6
      const jump = go([{ x: 0, z: 2.5, r: 0.5, h: 0.6 }], (k) => ({ move: [0, 1], jump: k === 10 }));
      assert.ok(jump[2] > 11, JSON.stringify(jump));
      const none = go([], fwd);
      assert.ok(Math.abs(none[2] - 12) < 1e-6);
      return `cây chặn ở z=${blocked[2].toFixed(2)} (tính tay 4.1); lệch 0.2 m thì trượt qua (z=${slide[2].toFixed(1)}); nhảy qua đá thấp (z=${jump[2].toFixed(1)}); không có vật cản → 12 m như contract`;
    },
  },
  {
    id: 'R9', req: 'Đẩy Bóng Mực ra mép vùng an toàn không thả nó xuống biển mây hay vào tháp chuông: chỗ mép thẳng hướng ra bị chặn thì lấy chỗ mép trống gần nhất (bước 15°); độ cao bám theo địa hình',
    run() {
      // Night 3, player far away on tier 0; the push starts on tick 1 and lasts safe_expel_ticks = 30 → snapshot at tick 30.
      // The shade is stunned (200 ticks, no push-back left): it does not walk after the push ends, so tick 30 = the edge point.
      const base = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], player: { pos: [0, 0, -20] } };
      const at30 = (lantern, shade) => {
        const r = runHeadless({ night: 3, ticks: 30, every: 30, scenario: { ...base, lanterns: [{ id: lantern, lit: true, fuel: 100 }], shades: [{ id: 'S1', pos: shade, state: 'stunned', state_ticks_left: 200 }] } });
        assert.equal(r.code, 0, r.stderr);
        return snapAt(r, 30).shades[0].pos;
      };
      const close = (got, want) => assert.ok(got.every((v, i) => Math.abs(v - want[i]) <= 0.002), `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
      // A. L6 (20,0,-35), shade at (21.49,1,-37.6): u = (1.49,−2.6)/2.9967, a0 = −60.18°. Radial edge (22.983,−40.206) has r 46.31 > 45 (sea).
      //    Edge point at angle a: r² = 40.311² + 36 + 12·40.311·cos(a − (−60.26°)) ≤ 45² ⇔ cos ≤ 0.7525 ⇔ |a − a0| ≳ 41.2° → first step 45°, + first:
      //    a = −15.18° → (20 + 6·0.96511, −35 − 6·0.26186) = (25.791, −36.571), r 44.75, ground 0 → y 1.
      const a = at30('L6', [21.49, 1, -37.6]);
      close(a, [25.791, 1, -36.571]);
      // B. L1 (0,6,6), shade on tier 2 at (0,7,3): radial edge (0,0) is the tower; ±15° → (±1.553, 0.204), r 1.57 ≤ 2 tower too;
      //    +30° → a = −60°: (6·0.5, 6 − 6·0.86603) = (3, 0.804), r 3.11 ≤ 8 → tier 2 ground 6 → y 7.
      const b = at30('L1', [0, 7, 3]);
      close(b, [3, 7, 0.804]);
      // C. L2 (18,3,10), shade on tier 1 at (19,4,12) (r 22.5, z > 0 → ground 3): radial edge 18 + 6/√5 = 20.683, 10 + 12/√5 = 15.367,
      //    r 25.77 > 24 → off tier 1; ramp 30°: along = 20.683·0.866 + 15.367·0.5 = 25.60, lateral = |20.683·0.5 − 15.367·0.866| = 2.97 > 1.5 → not
      //    on the ramp → ground 0 → y 1 (the old push kept y 4, floating 3 m up).
      const c = at30('L2', [19, 4, 12]);
      close(c, [20.683, 1, 15.367]);
      return `L6: (${a}) r=${Math.hypot(a[0], a[2]).toFixed(2)} ≤ 45 (trước đây 46.31, ngoài đảo); L1: (${b}) ngoài tháp; L2: (${c}) xuống tầng 0, y = 1`;
    },
  },
];
