// Phase 1 verification cases. Shared by `npm test` (tests/phase1.test.js) and `npm run proof`.
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

export function runHeadless({ seed = 1, ticks = 60, scenario, inputs, every, extraArgs = [], outFile } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
  const out = outFile || join(dir, 'out.jsonl');
  const args = ['src/headless.js', '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out];
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

const events = (r, name) => r.lines.filter((l) => l.type === 'event' && (!name || l.name === name));
const snaps = (r) => r.lines.filter((l) => l.type === 'snapshot');
const snapAt = (r, tick) => snaps(r).find((s) => s.tick === tick);
const end = (r) => r.lines[r.lines.length - 1];
const quiet = { random_motes: false, random_shades: false, motes: [], shades: [] };
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

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
      const r6 = spawnSync(process.execPath, ['src/headless.js', '--seed', '1', '--night', '2', '--ticks', '1', '--out', join(tmpdir(), 'x.jsonl')], { cwd: ROOT, encoding: 'utf8' });
      assert.notEqual(r6.status, 0);
      return `tick trùng=2, JSON hỏng=2, move ngoài [-1,1]=2, shade thiếu pos=2, thiếu tham số=${r5.status}, night 2=${r6.status}`;
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
    id: 'G1', req: 'Nhặt đom đóm trong pickup_radius (≤ r), cộng per_mote',
    run() {
      const r = runHeadless({ scenario: { ...quiet, motes: [[0, 0, T.pickup_radius], [0, 0, T.pickup_radius + 0.1]] }, ticks: 10 });
      assert.equal(events(r, 'mote_picked').length, 1);
      assert.equal(end(r).score, S.per_mote);
      assert.equal(snapAt(r, 10).motes_active, 1);
      return `mote ở ${T.pickup_radius} m được nhặt, ở ${T.pickup_radius + 0.1} m không; score=${end(r).score}`;
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
    id: 'G3', req: 'Interact trong interact_radius nạp đom đóm; đủ lantern_cost thì thắp (deposit + lantern_lit, +per_lantern)',
    run() {
      const sc = { ...quiet, player: { pos: [0, 0, 25 - T.interact_radius], carried: T.lantern_cost + 2 } };
      const r = runHeadless({ scenario: sc, inputs: [{ tick: 2, interact: true }, { tick: 3, interact: false }], ticks: 10 });
      const d = events(r, 'deposit'); const l = events(r, 'lantern_lit');
      assert.deepEqual(d.map((e) => e.data), [{ lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost }]);
      assert.equal(d[0].tick, 3);
      assert.deepEqual(l.map((e) => e.data), [{ lantern_id: 'L1' }]);
      assert.equal(snapAt(r, 10).player.carried, 2);
      assert.equal(end(r).score, S.per_lantern);
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
    id: 'G5', req: 'Tỏa sáng: tốn pulse_cost, choáng Bóng Mực trong pulse_radius pulse_stun_s giây, đẩy pulse_push_m, +per_stun',
    run() {
      const sc = { ...quiet, player: { carried: T.pulse_cost + 1 }, shades: [{ id: 'S1', pos: [T.pulse_radius, 1, 0] }, { id: 'S9', pos: [-(T.pulse_radius + 0.5), 1, 0] }] };
      const stunTicks = Math.round(T.pulse_stun_s * 60);
      const r = runHeadless({ scenario: sc, inputs: [{ tick: 0, pulse: true }], ticks: stunTicks + 2, every: 1 });
      const p = events(r, 'pulse');
      assert.deepEqual(p.map((e) => e.data), [{ stunned_ids: ['S1'] }]);
      const s1 = (tick) => snapAt(r, tick).shades.find((s) => s.id === 'S1');
      assert.equal(s1(1).state, 'stunned');
      assert.deepEqual(s1(1).pos, [T.pulse_radius + T.pulse_push_m, 1, 0]);
      assert.equal(s1(stunTicks - 1).state, 'stunned');
      assert.deepEqual(s1(stunTicks).pos, s1(1).pos, 'stunned shade must not move');
      assert.notEqual(s1(stunTicks + 2).state, 'stunned');
      assert.equal(snapAt(r, 1).player.carried, 1);
      assert.equal(end(r).score, S.per_stun);
      return `pulse stunned [S1] (S9 ngoài bán kính); S1 đẩy tới x=${s1(1).pos[0]}, đứng yên ${stunTicks} tick; carried ${T.pulse_cost + 1}→1`;
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
    id: 'G7', req: 'Bóng Mực chạm (≤ shade_hit_radius) → mất 1 lửa, rơi hit_drop_ratio đom đóm, bất tử invuln_s',
    run() {
      const sc = { ...quiet, player: { carried: 5 }, shades: [{ id: 'S1', pos: [T.shade_hit_radius, 1, 0] }] };
      const inv = Math.round(T.invuln_s * 60);
      const r = runHeadless({ scenario: sc, ticks: inv + 1 });
      const h = events(r, 'player_hit');
      const dropped = Math.floor(5 * T.hit_drop_ratio);
      assert.deepEqual(h.map((e) => [e.tick, e.data]), [[1, { by: 'shade', flames: T.flames - 1, dropped }], [inv + 1, { by: 'shade', flames: T.flames - 2, dropped: Math.floor((5 - dropped) * T.hit_drop_ratio) }]]);
      return `hit tick 1 (flames ${T.flames - 1}, dropped ${dropped}); hit tiếp theo đúng sau ${inv} tick bất tử`;
    },
  },
  {
    id: 'G8', req: 'Đom đóm đánh rơi nằm lại trên đảo và nhặt lại được',
    run() {
      const sc = { ...quiet, player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] };
      const r = runHeadless({ scenario: sc, ticks: 2, every: 1 });
      const s = snapAt(r, 1);
      assert.equal(s.motes_active, 2);
      for (const m of s.motes) near(Math.hypot(m.pos[0], m.pos[2]), 2.5, 2e-3);
      return `rơi 2 mote ở vòng 2.5 m quanh người chơi: ${JSON.stringify(s.motes.map((m) => m.pos))}`;
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
      const expected = S.per_lantern + S.per_second_left * Math.floor(100 - 1 / 60) + S.per_flame_left * T.flames;
      assert.deepEqual(events(r, 'game_over').map((e) => [e.tick, e.data]), [[1, { result: 'won', reason: 'all_lit' }]]);
      assert.deepEqual(end(r), { type: 'end', ticks: 1, state: 'won', score: expected });
      return `won ở tick 1, score=${end(r).score} (= ${S.per_lantern} + ${S.per_second_left}×99 + ${S.per_flame_left}×${T.flames})`;
    },
  },
  {
    id: 'G12', req: 'Bóng Mực sợ đèn: không vào trong safe_radius của đèn đã thắp',
    run() {
      const sc = { ...quiet, lanterns: [{ id: 'L1', lit: true }], player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [0, 1, 22] }, { id: 'S2', pos: [8, 1, 25] }] };
      const r = runHeadless({ scenario: sc, ticks: 600, every: 1 });
      let minD = Infinity;
      for (const s of snaps(r).slice(1)) for (const sh of s.shades) minD = Math.min(minD, Math.hypot(sh.pos[0], sh.pos[2] - 25));
      assert.ok(minD >= T.safe_radius - 1e-3, `min distance ${minD}`);
      assert.equal(events(r, 'player_hit').length, 0);
      return `600 tick đứng cạnh đèn đã thắp: khoảng cách nhỏ nhất Bóng Mực–đèn = ${minD.toFixed(3)} m ≥ ${T.safe_radius}; không bị chạm`;
    },
  },
  {
    id: 'G13', req: 'Bóng Mực đuổi người chơi với shade_speed',
    run() {
      const r = runHeadless({ scenario: { ...quiet, shades: [{ id: 'S1', pos: [20, 1, 0] }] }, ticks: 60 });
      const x = snapAt(r, 60).shades[0].pos[0];
      near(20 - x, T.shade_speed);
      assert.equal(snapAt(r, 60).shades[0].state, 'chase');
      return `sau 1 s Bóng Mực tiến ${(20 - x).toFixed(3)} m về phía người chơi`;
    },
  },
  {
    id: 'G14', req: 'Bóng Mực tự xuất hiện (shade_spawned, id tự sinh) và đom đóm rải rác khi không có scenario',
    run() {
      // Player hides next to a pre-lit lantern so shades cannot reach them; spawns every 20 s.
      const r = runHeadless({ seed: 5, ticks: 2800, scenario: { lanterns: [{ id: 'L1', lit: true }], player: { pos: [0, 0, 25] } } });
      const sp = events(r, 'shade_spawned');
      assert.deepEqual(sp.map((e) => [e.tick, e.data.id]), [[300, 'S1'], [1500, 'S2'], [2700, 'S3']]);
      assert.equal(snapAt(r, 0).motes_active, 30);
      assert.equal(snapAt(r, 0).shades.length, 0);
      return `30 mote lúc đầu; shade_spawned: ${sp.map((e) => `${e.data.id}@${e.tick}`).join(', ')}`;
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
    id: 'G16', req: 'Dựng scenario không phát sự kiện, không cộng điểm; ra khỏi đảo bị chặn (fall_enabled=false)',
    run() {
      const r = runHeadless({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }], motes: [[0, 0, 30]] }, ticks: 0 });
      assert.equal(events(r).length, 0); assert.equal(snapAt(r, 0).score, 0);
      const edge = runHeadless({ scenario: quiet, inputs: [{ tick: 0, move: [1, 0] }], ticks: 600 });
      near(Math.hypot(...snapAt(edge, 600).player.pos), 40);
      assert.equal(events(edge, 'player_hit').length, 0);
      return 'ticks 0: không event, score 0; chạy 10 s ra mép → dừng ở bán kính 40 m, không có player_hit fall';
    },
  },
];
