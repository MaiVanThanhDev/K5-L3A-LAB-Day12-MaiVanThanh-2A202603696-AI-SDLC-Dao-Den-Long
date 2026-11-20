// Phase 4 cases (Ticket-04, Test Contract v1.3): leaderboard rules + storage + export, bench scene, soak, contract keys.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, TUNING, runHeadless, end } from './cases.js';
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
      const file = join(dir, 'lb.json'), port = 6100 + Math.floor(Math.random() * 800);
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
];

