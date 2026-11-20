// Phase 1 regression cases, re-run with the Ticket-02 standard numbers (Test Contract v1.1).
// Cases changed by Ticket-02 rules are marked `// v1.1:` (reasons: docs/notes/assumptions.md, section B).
// Shared by `npm test` (tests/phase1.test.js) and `npm run proof`.
// Every case runs the REAL headless CLI (same entry point the grader uses) and checks its JSONL.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TUNING = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')).tuning;
const T = TUNING, S = TUNING.score;

export function runHeadless({ seed = 1, night = 1, ticks = 60, scenario, inputs, every, extraArgs = [], outFile } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
  const out = outFile || join(dir, 'out.jsonl');
  const args = ['src/headless.js', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out];
  if (scenario !== undefined) { const f = join(dir, 'scenario.json'); writeFileSync(f, typeof scenario === 'string' ? scenario : JSON.stringify(scenario)); args.push('--scenario', f); }
  if (inputs !== undefined) { const f = join(dir, 'inputs.json'); writeFileSync(f, typeof inputs === 'string' ? inputs : JSON.stringify({ frames: inputs })); args.push('--inputs', f); }
  if (every !== undefined) args.push('--snapshot-every', String(every));
  args.push(...extraArgs);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  let text = '';
  try { text = readFileSync(out, 'utf8'); } catch { /* no output on error */ }
  const lines = text.trim() ? text.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, stderr: r.stderr, text, lines, out };
}

export const events = (r, name) => r.lines.filter((l) => l.type === 'event' && (!name || l.name === name));
export const snaps = (r) => r.lines.filter((l) => l.type === 'snapshot');
export const snapAt = (r, tick) => snaps(r).find((s) => s.tick === tick);
export const end = (r) => r.lines[r.lines.length - 1];
export const quiet = { random_motes: false, random_shades: false, motes: [], shades: [] };
export const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

export const cases = [
  // ---------- Contract format ----------
  {
    id: 'C1', req: 'Contract E: snapshot tick 0, mỗi --snapshot-every tick, đủ trường; dòng cuối là end',
    run() {
      const r = runHeadless({ seed: 3, ticks: 25, every: 5 });
      assert.equal(r.code, 0);
      assert.deepEqual(snaps(r).map((s) => s.tick), [0, 5, 10, 15, 20, 25]);
      const s0 = snapAt(r, 0);
      for (const k of ['tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s0, `missing ${k}`);
      assert.equal(s0.state, 'playing'); assert.equal(s0.time_left_s, T.night1_duration_s);
      assert.deepEqual(s0.player.pos, [0, 0, 0]);
      assert.equal(s0.lanterns.length, 5);
      assert.deepEqual(end(r), { type: 'end', ticks: 25, state: 'playing', score: 0 });
      near(snapAt(r, 25).time_left_s, T.night1_duration_s - 25 / 60);
      return `snapshots ở tick ${snaps(r).map((s) => s.tick).join(',')}; end=${JSON.stringify(end(r))}`;
    },
  },
  {
    id: 'C2', req: 'Contract E: tất định — cùng seed/scenario/inputs cho output giống hệt (kể cả id tự sinh)',
    run() {
      const inputs = [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 400, pulse: true }, { tick: 401, pulse: false }, { tick: 900, move: [-1, 0] }];
      const a = runHeadless({ seed: 42, ticks: 3000, inputs });
      const b = runHeadless({ seed: 42, ticks: 3000, inputs });
      const c = runHeadless({ seed: 43, ticks: 3000, inputs });
      assert.equal(a.text, b.text);
      assert.notEqual(a.text, c.text);
      assert.ok(events(a, 'shade_spawned').length > 0);
      return `seed 42 ×2: ${a.text.length} byte giống hệt; seed 43 khác (đúng)`;
    },
  },
  {
    id: 'C3', req: 'Contract B: inputs/scenario sai định dạng → mã thoát 2 + stderr; thiếu tham số → mã ≠ 0',
    run() {
      const r1 = runHeadless({ inputs: '{"frames":[{"tick":5},{"tick":5}]}' });
      const r2 = runHeadless({ scenario: '{not json' });
      const r3 = runHeadless({ inputs: '{"frames":[{"tick":0,"move":[2,0]}]}' });
      const r4 = runHeadless({ scenario: { shades: [{ id: 'S1' }] } });
      assert.equal(r1.code, 2); assert.equal(r2.code, 2); assert.equal(r3.code, 2); assert.equal(r4.code, 2);
      assert.ok(r1.stderr.length > 0);
      const r5 = spawnSync(process.execPath, ['src/headless.js', '--seed', '1'], { cwd: ROOT, encoding: 'utf8' });
      assert.notEqual(r5.status, 0); assert.ok(r5.stderr.length > 0);
      const r6 = spawnSync(process.execPath, ['src/headless.js', '--seed', '1', '--night', '4', '--ticks', '1', '--out', join(tmpdir(), 'x.jsonl')], { cwd: ROOT, encoding: 'utf8' });
      assert.notEqual(r6.status, 0);
      return `tick trùng=2, JSON hỏng=2, move ngoài [-1,1]=2, shade thiếu pos=2, thiếu tham số=${r5.status}, night 4=${r6.status} (v1.1: night 2, 3 hợp lệ)`;
    },
  },
  {
    id: 'C4', req: 'Contract C: move theo camera (công thức x\',z\'), chuẩn hóa vector > 1, player_speed',
    run() {
      const fwd = runHeadless({ scenario: quiet, inputs: [{ tick: 0, move: [0, 1] }], ticks: 60 });
      assert.deepEqual(snapAt(fwd, 60).player.pos, [0, 0, T.player_speed]);
      const yaw = runHeadless({ scenario: quiet, inputs: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60 });
      assert.deepEqual(snapAt(yaw, 60).player.pos, [T.player_speed, 0, 0]);
      const diag = runHeadless({ scenario: quiet, inputs: [{ tick: 0, move: [1, 1] }], ticks: 60 });
      const [x, , z] = snapAt(diag, 60).player.pos;
      near(Math.hypot(x, z), T.player_speed, 2e-3);
      const hold = runHeadless({ scenario: quiet, inputs: [{ tick: 0, move: [1, 0] }, { tick: 30, cam_yaw_deg: 0 }], ticks: 60 });
      assert.deepEqual(snapAt(hold, 60).player.pos, [T.player_speed, 0, 0]);
      return `60 tick tiến → z=${T.player_speed}; yaw 90° → x=${T.player_speed}; chéo → |v|=${Math.hypot(x, z).toFixed(3)}; trường vắng giữ giá trị`;
    },
  },
  {
    id: 'C5', req: 'Contract B: tick model — sự kiện bước k ghi tick=k+1; --ticks N chạy đúng N bước',
    run() {
      const r = runHeadless({ scenario: { ...quiet, motes: [[0, 0, 0.5]] }, ticks: 7 });
      const e = events(r, 'mote_picked');
      assert.equal(e.length, 1); assert.equal(e[0].tick, 1);
      assert.equal(snapAt(r, 0).player.carried, 0);
      assert.equal(end(r).ticks, 7);
      return `mote nhặt ở bước 0 → event tick=${e[0].tick}; snapshot 0 chưa nhặt; end.ticks=7`;
    },
  },
  // ---------- Gameplay rules ----------
  {
    id: 'G1', req: 'Nhặt đom đóm trong pickup_radius (≤ r); v1.1: nhặt không cộng điểm',
    run() {
      const r = runHeadless({ scenario: { ...quiet, motes: [[0, 0, T.pickup_radius], [0, 0, T.pickup_radius + 0.1]] }, ticks: 10 });
      assert.equal(events(r, 'mote_picked').length, 1);
      assert.equal(end(r).score, 0); // v1.1: per_mote is paid on deposit, not on pickup
      assert.equal(snapAt(r, 10).motes_active, 1);
      return `mote ở ${T.pickup_radius} m được nhặt, ở ${T.pickup_radius + 0.1} m không; nhặt không cộng điểm (v1.1: điểm khi nạp)`;
    },
  },
  {
    id: 'G2', req: 'Mang tối đa carry_capacity đom đóm',
    run() {
      const motes = Array.from({ length: T.carry_capacity + 2 }, () => [0, 0, 0]);
      const r = runHeadless({ scenario: { ...quiet, motes }, ticks: 5, every: 1 });
      assert.equal(snapAt(r, 5).player.carried, T.carry_capacity);
      assert.equal(snapAt(r, 5).motes_active, 2);
      return `12 mote dưới chân → carried=${snapAt(r, 5).player.carried}, còn lại 2`;
    },
  },
  {
    id: 'G3', req: 'Interact trong interact_radius nạp đom đóm; đủ lantern_cost thì thắp (deposit + lantern_lit, +per_lantern, +per_mote mỗi con nạp)',
    run() {
      const sc = { ...quiet, player: { pos: [0, 0, 25 - T.interact_radius], carried: T.lantern_cost + 2 } };
      const r = runHeadless({ scenario: sc, inputs: [{ tick: 2, interact: true }, { tick: 3, interact: false }], ticks: 10 });
      const d = events(r, 'deposit'); const l = events(r, 'lantern_lit');
      assert.deepEqual(d.map((e) => e.data), [{ lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost }]);
      assert.equal(d[0].tick, 3);
      assert.deepEqual(l.map((e) => e.data), [{ lantern_id: 'L1' }]);
      assert.equal(snapAt(r, 10).player.carried, 2);
      assert.equal(end(r).score, S.per_lantern + S.per_mote * T.lantern_cost); // v1.1: +per_mote per deposited mote
      return `deposit ${JSON.stringify(d[0].data)} @tick ${d[0].tick}, lantern_lit L1, score=${end(r).score}`;
    },
  },
  {
    id: 'G4', req: 'Nạp một phần thì chưa thắp; ngoài interact_radius không nạp; giữ nút không nạp lặp (chỉ cạnh false→true)',
    run() {
      const sc = { ...quiet, player: { pos: [0, 0, 24], carried: 3 } };
      const r = runHeadless({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 30 });
      assert.deepEqual(events(r, 'deposit').map((e) => e.data), [{ lantern_id: 'L1', amount: 3, deposited: 3 }]);
      assert.equal(events(r, 'lantern_lit').length, 0);
      const far = runHeadless({ scenario: { ...quiet, player: { pos: [0, 0, 25 - T.interact_radius - 0.1], carried: 3 } }, inputs: [{ tick: 0, interact: true }], ticks: 5 });
      assert.equal(events(far, 'deposit').length, 0);
      return 'carried 3 → deposited 3, chưa thắp; đứng xa 0.1 m ngoài bán kính → không nạp';
    },
  },
  {
    // v1.1: target test is the 3D distance from foot+0.8 m; push is 4 m spread over 15 ticks (was instant)
    id: 'G5', req: 'Tỏa sáng: tốn pulse_cost, choáng Bóng Mực trong pulse_radius (3D từ chân+0.8 m) pulse_stun_s giây, đẩy pulse_push_m trong 15 tick, +per_stun',
    run() {
      const x0 = T.pulse_radius - 0.5;
      const sc = { ...quiet, player: { carried: T.pulse_cost + 1 }, shades: [{ id: 'S1', pos: [x0, 1, 0] }, { id: 'S9', pos: [-(T.pulse_radius + 0.5), 1, 0] }] };
      const stunTicks = Math.round(T.pulse_stun_s * 60);
      const r = runHeadless({ scenario: sc, inputs: [{ tick: 0, pulse: true }], ticks: stunTicks + 2, every: 1 });
      assert.deepEqual(events(r, 'pulse').map((e) => e.data), [{ stunned_ids: ['S1'] }]);
      const s1 = (tick) => snapAt(r, tick).shades.find((s) => s.id === 'S1');
      assert.equal(s1(1).state, 'stunned');
      near(s1(1).pos[0], x0 + T.pulse_push_m / 15);
      near(s1(15).pos[0], x0 + T.pulse_push_m);
      assert.deepEqual(s1(stunTicks).pos, s1(15).pos, 'stunned shade must not move after the push');
      assert.equal(s1(stunTicks).state, 'stunned');
      assert.notEqual(s1(stunTicks + 1).state, 'stunned');
      assert.equal(snapAt(r, 1).player.carried, 1);
      assert.equal(end(r).score, S.per_stun);
      return `pulse stunned [S1] (S9 ngoài bán kính); S1 x: ${x0} → ${s1(1).pos[0]} (tick 1) → ${s1(15).pos[0]} (tick 15), choáng ${stunTicks} tick; carried ${T.pulse_cost + 1}→1`;
    },
  },

  {
    id: 'G6', req: 'Tỏa sáng cần đủ ánh sáng và có hồi chiêu pulse_cooldown_s',
    run() {
      const none = runHeadless({ scenario: { ...quiet, player: { carried: T.pulse_cost - 1 } }, inputs: [{ tick: 0, pulse: true }], ticks: 5 });
      assert.equal(events(none, 'pulse').length, 0);
      const cd = Math.round(T.pulse_cooldown_s * 60);
      const inputs = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: cd - 1, pulse: true }, { tick: cd, pulse: false }, { tick: cd + 1, pulse: true }];
      const r = runHeadless({ scenario: { ...quiet, player: { carried: 3 * T.pulse_cost } }, inputs, ticks: cd + 5 });
      assert.deepEqual(events(r, 'pulse').map((e) => e.tick), [1, cd + 2]);
      return `thiếu ánh sáng → không pulse; bấm lại ở tick ${cd - 1} bị chặn, tick ${cd + 1} được (event tick ${cd + 2})`;
    },
  },
  {
    // v1.1: the hitting shade goes into recoil (2 m in 60 ticks), so the old "second hit right after invuln" no longer happens
    id: 'G7', req: 'Bóng Mực chạm (≤ shade_hit_radius) → mất 1 lửa, rơi hit_drop_ratio đom đóm, bất tử invuln_s, bóng chuyển recoil',
    run() {
      const sc = { ...quiet, player: { carried: 5 }, shades: [{ id: 'S1', pos: [T.shade_hit_radius, 1, 0] }] };
      const inv = Math.round(T.invuln_s * 60);
      const r = runHeadless({ scenario: sc, ticks: inv + 1, every: 1 });
      const h = events(r, 'player_hit');
      const dropped = Math.floor(5 * T.hit_drop_ratio);
      assert.deepEqual(h.filter((e) => e.tick <= inv).map((e) => [e.tick, e.data]), [[1, { by: 'shade', flames: T.flames - 1, dropped }]]);
      assert.equal(snapAt(r, 1).player.invuln, true);
      assert.equal(snapAt(r, inv).player.invuln, true); // hit at tick 1 → invulnerable for ticks 1..inv
      const iv = runHeadless({ scenario: { ...quiet, player: { invuln_ticks: inv } }, ticks: inv + 1, every: 1 });
      assert.equal(snapAt(iv, inv - 1).player.invuln, true);
      assert.equal(snapAt(iv, inv).player.invuln, false); // counter of inv ticks runs out after inv steps
      assert.equal(snapAt(r, 1).shades[0].state, 'recoil');
      return `hit tick 1 (flames ${T.flames - 1}, dropped ${dropped}); bất tử tick 1…${inv}; S1 recoil`;
    },
  },

  {
    // v1.1: dropped motes land on a 1.5–2.5 m ring (was exactly 2.5 m), kind "dropped", live 480 ticks
    id: 'G8', req: 'Đom đóm đánh rơi nằm lại trên đảo (vành 1.5–2.5 m, sống 480 tick) và nhặt lại được',
    run() {
      const sc = { ...quiet, player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] };
      const r = runHeadless({ scenario: sc, ticks: 2, every: 1 });
      const s = snapAt(r, 1);
      assert.equal(s.motes_active, 2);
      for (const m of s.motes) {
        const d = Math.hypot(m.pos[0], m.pos[2]);
        assert.ok(d >= 1.5 - 2e-3 && d <= 2.5 + 2e-3, `ring distance ${d}`);
        assert.equal(m.kind, 'dropped'); near(m.ttl_s, T.dropped_ttl_ticks / 60);
      }
      return `rơi 2 mote ở khoảng cách ${s.motes.map((m) => Math.hypot(m.pos[0], m.pos[2]).toFixed(2)).join(', ')} m, kind dropped, ttl ${s.motes[0].ttl_s} s`;
    },
  },

  {
    id: 'G9', req: 'Thua khi hết lửa: game_over lost/no_flames, dừng sớm, end.state=lost',
    run() {
      const r = runHeadless({ scenario: { ...quiet, player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] }, ticks: 100 });
      assert.deepEqual(events(r, 'game_over').map((e) => [e.tick, e.data]), [[1, { result: 'lost', reason: 'no_flames' }]]);
      assert.deepEqual(end(r), { type: 'end', ticks: 1, state: 'lost', score: 0 });
      return `game_over tick 1, end=${JSON.stringify(end(r))}`;
    },
  },
  {
    id: 'G10', req: 'Thua khi trời sáng (hết giờ): game_over lost/dawn',
    run() {
      const r = runHeadless({ scenario: { ...quiet, time_left_s: 1 }, ticks: 500 });
      assert.deepEqual(events(r, 'game_over').map((e) => [e.tick, e.data]), [[60, { result: 'lost', reason: 'dawn' }]]);
      assert.equal(end(r).ticks, 60);
      return 'time_left_s=1 → game_over dawn ở tick 60';
    },
  },
  {
    id: 'G11', req: 'Thắng khi thắp hết đèn (all_lit); điểm thưởng thời gian + lửa; đèn đặt sẵn không được điểm',
    run() {
      const lanterns = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
      const sc = { ...quiet, lanterns, player: { pos: [0, 0, 24], carried: T.lantern_cost }, time_left_s: 100 };
      const r = runHeadless({ scenario: sc, inputs: [{ tick: 0, interact: true }], ticks: 50 });
      assert.equal(snapAt(r, 0).score, 0);
      const expected = S.per_mote * T.lantern_cost + S.per_lantern + S.per_second_left * Math.floor(100 - 1 / 60) + S.per_flame_left * T.flames;
      assert.deepEqual(events(r, 'game_over').map((e) => [e.tick, e.data]), [[1, { result: 'won', reason: 'all_lit' }]]);
      assert.deepEqual(end(r), { type: 'end', ticks: 1, state: 'won', score: expected });
      return `won ở tick 1, score=${end(r).score} (= ${S.per_mote}×${T.lantern_cost} + ${S.per_lantern} + ${S.per_second_left}×99 + ${S.per_flame_left}×${T.flames})`;
    },
  },

  {
    id: 'G12', req: 'Bóng Mực sợ đèn: không vào trong safe_radius của đèn đã thắp',
    run() {
      const sc = { ...quiet, lanterns: [{ id: 'L1', lit: true }], player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [0, 1, 22] }, { id: 'S2', pos: [8, 1, 25] }] };
      const r = runHeadless({ scenario: sc, ticks: 600, every: 1 });
      let minD = Infinity;
      for (const s of snaps(r).filter((x) => x.tick >= T.safe_expel_ticks)) for (const sh of s.shades) minD = Math.min(minD, Math.hypot(sh.pos[0], sh.pos[2] - 25));
      assert.ok(minD >= T.safe_radius - 1e-3, `min distance ${minD}`);
      assert.equal(events(r, 'player_hit').length, 0);
      return `S1 đặt trong vùng sáng bị đẩy ra trong ${T.safe_expel_ticks} tick; từ đó tới tick 600 khoảng cách nhỏ nhất Bóng Mực–đèn = ${minD.toFixed(3)} m ≥ ${T.safe_radius}; không bị chạm`;
    },
  },
  {
    // v1.1: shades only chase within shade_lose_m (18 m) → start 10 m away instead of 20 m
    id: 'G13', req: 'Bóng Mực đuổi người chơi với shade_speed',
    run() {
      const r = runHeadless({ scenario: { ...quiet, shades: [{ id: 'S1', pos: [10, 1, 0] }] }, ticks: 60 });
      const x = snapAt(r, 60).shades[0].pos[0];
      near(10 - x, T.shade_speed);
      assert.equal(snapAt(r, 60).shades[0].state, 'chase');
      return `sau 1 s Bóng Mực tiến ${(10 - x).toFixed(3)} m về phía người chơi`;
    },
  },

  {
    // v1.1: standard schedule — 2 shades at tick 300, then one every 480 ticks, max 6; 20 starting motes
    id: 'G14', req: 'Bóng Mực tự xuất hiện (shade_spawned, id tự sinh) và đom đóm rải rác khi không có scenario',
    run() {
      // Player hides inside the safe zone of a pre-lit lantern so shades cannot reach them.
      const r = runHeadless({ seed: 5, ticks: 3000, scenario: { lanterns: [{ id: 'L1', lit: true }], player: { pos: [0, 0, 25] } } });
      const sp = events(r, 'shade_spawned');
      assert.deepEqual(sp.map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5'], [2220, 'S6']]);
      assert.equal(snapAt(r, 0).motes_active, T.motes_start);
      assert.equal(snapAt(r, 0).shades.length, 0);
      return `${T.motes_start} mote lúc đầu; shade_spawned: ${sp.map((e) => `${e.data.id}@${e.tick}`).join(', ')} (tối đa 6)`;
    },
  },

  {
    id: 'G15', req: 'Nhảy: rời mặt đất rồi rơi về Y=0; không ảnh hưởng đầu ra khác',
    run() {
      const r = runHeadless({ scenario: quiet, inputs: [{ tick: 0, jump: true }], ticks: 60, every: 5 });
      const ys = snaps(r).map((s) => s.player.pos[1]);
      assert.ok(Math.max(...ys) > 1, 'should rise above 1 m');
      assert.equal(snapAt(r, 60).player.pos[1], 0);
      return `độ cao theo snapshot: ${ys.join(', ')}`;
    },
  },
  {
    // v1.1: fall_enabled = true, walking off the edge is now a fall (tested in P-FALL); only the scenario part stays here
    id: 'G16', req: 'Dựng scenario không phát sự kiện, không cộng điểm',
    run() {
      const r = runHeadless({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }], motes: [[0, 0, 30]] }, ticks: 0 });
      assert.equal(events(r).length, 0); assert.equal(snapAt(r, 0).score, 0);
      return 'ticks 0: không event, score 0 (đèn đặt sẵn lit không được điểm)';
    },
  },

];
