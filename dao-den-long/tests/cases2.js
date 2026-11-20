// Phase 2 cases (Ticket-02, Test Contract v1.1). Every case runs the REAL headless CLI.
// Expected values come from the ticket text or hand calculation (shown in comments), never copied from output.
import assert from 'node:assert/strict';
import { runHeadless, TUNING, events, snaps, snapAt, end, quiet, near } from './cases.js';

const T = TUNING, S = TUNING.score;
// No randomness at all: no random motes/shades/drifters, no wind, no default charms.
const Q = { ...quiet, random_drifters: false, wind_enabled: false, drifters: [], charms: [] };
const rad = (d) => (d * Math.PI) / 180;
const pt = (r, a, y = 0, cx = 0) => [cx + r * Math.cos(rad(a)), y, r * Math.sin(rad(a))];
const ring = (n, r, a0, step, y = 0, cx = 0) => Array.from({ length: n }, (_, i) => pt(r, a0 + i * step, y, cx));
const sameXZ = (a, b, eps = 2e-3) => Math.abs(a[0] - b[0]) <= eps && Math.abs(a[2] - b[2]) <= eps;
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// Standard maps, written again from the ticket text (independent of src/sim/maps.js).
const STD = {
  1: { dur: 300, lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motes: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)] },
  2: { dur: 330, lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motes: [0, 70].flatMap((cx) => [...ring(4, 10, 0, 90, 0, cx), ...ring(8, 22, 0, 45, 0, cx)]) },
  3: { dur: 360, lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motes: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)] },
};

export const cases2 = [
  {
    id: 'P1', req: 'Phần 1/4: tuning khớp số chuẩn của ticket, contract_version 1.1, có khóa dash_* và night2/3_duration_s',
    run() {
      const want = { player_speed: 6, jump_speed: 7, gravity: 20, carry_capacity: 10, pickup_radius: 1, lantern_cost: 10, interact_radius: 2,
        safe_radius: 6, pulse_cost: 3, pulse_radius: 5, pulse_cooldown_s: 3, pulse_stun_s: 2, pulse_push_m: 4, shade_speed: 4, shade_speed_night3: 4.5,
        shade_hit_radius: 1, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360,
        dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true, lantern_count_night1: 5 };
      for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, `tuning.${k}`);
      assert.deepEqual(S, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
      return `${Object.keys(want).length} khóa tuning + score khớp bảng số chuẩn`;
    },
  },
  {
    id: 'P2', req: 'Phần 2/4: --night 1|2|3; snapshot có night, wind, player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}, motes/drifters/charms; đèn, thời lượng, 20 đom đóm ở 20 điểm chuẩn khác nhau',
    run() {
      const out = [];
      for (const n of [1, 2, 3]) {
        const r = runHeadless({ night: n, seed: 7, ticks: 0 });
        assert.equal(r.code, 0);
        const s = snapAt(r, 0);
        assert.equal(s.night, n);
        assert.equal(s.time_left_s, STD[n].dur);
        assert.deepEqual(s.wind, { active: false, dir_deg: null });
        for (const k of ['pos', 'vel', 'grounded', 'flames', 'carried', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, `player.${k}`);
        assert.deepEqual(s.lanterns.map((l) => l.id), STD[n].lanterns.map((_, i) => `L${i + 1}`));
        s.lanterns.forEach((l, i) => assert.deepEqual(l.pos, STD[n].lanterns[i]));
        assert.equal(s.motes.length, 20);
        const used = new Set();
        for (const m of s.motes) {
          const i = STD[n].motes.findIndex((q) => sameXZ(q, m.pos) && Math.abs(q[1] - m.pos[1]) < 1e-9);
          assert.ok(i >= 0, `mote ${JSON.stringify(m.pos)} is not a standard point`);
          assert.ok(!used.has(i), 'two motes on one point'); used.add(i);
          assert.equal(m.kind, 'random'); assert.equal(m.ttl_s, null);
        }
        assert.ok(Array.isArray(s.drifters) && Array.isArray(s.charms));
        out.push(`Đêm ${n}: ${s.lanterns.length} đèn, ${s.time_left_s} s, ${s.charms.length} bùa`);
      }
      const n3 = snapAt(runHeadless({ night: 3, ticks: 0 }), 0);
      assert.deepEqual(n3.charms.map((c) => c.pos), [[30, 0, 25], [-30, 0, 25]]);
      assert.deepEqual(snapAt(runHeadless({ night: 2, ticks: 0 }), 0).charms.map((c) => [c.id, c.pos, c.available]), [['C1', [35, 0, 0], true]]);
      return out.join('; ');
    },
  },
  {
    id: 'P3', req: 'Phần 1: đom đóm sinh thêm 1 tại tick 240, 480… ở điểm trống; hết điểm trống thì bỏ lượt',
    run() {
      const r = runHeadless({ night: 1, seed: 11, ticks: 1500, scenario: { random_shades: false }, every: 10 });
      const count = (t) => snapAt(r, t).motes_active;
      // 20 at start, +1 at 240, 480, 720, 960 → all 24 standard points of night 1 used; 1200, 1440 skipped
      assert.deepEqual([0, 230, 240, 470, 480, 960, 1200, 1440].map(count), [20, 20, 21, 21, 22, 24, 24, 24]);
      const before = new Set(snapAt(r, 230).motes.map((m) => m.pos.join()));
      const added = snapAt(r, 240).motes.filter((m) => !before.has(m.pos.join()));
      assert.equal(added.length, 1);
      assert.ok(STD[1].motes.some((q) => sameXZ(q, added[0].pos)));
      return `số đom đóm theo tick 0/240/480/960/1200: ${[0, 240, 480, 960, 1200].map(count).join('/')}; mote mới ${added[0].id} ở ${JSON.stringify(added[0].pos)} (điểm chuẩn, trước đó trống)`;
    },
  },
  {
    id: 'P4', req: 'Phần 1: chạy 6 m/s đạt tốc độ ngay (≤ 0.1 s) và dừng ngay; nhảy 7 m/s, g −20, chỉ nhảy khi chạm đất',
    run() {
      const r = runHeadless({ scenario: Q, ticks: 70, every: 1, inputs: [{ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] }] });
      assert.deepEqual(snapAt(r, 1).player.vel, [0, 0, 6]);
      assert.deepEqual(snapAt(r, 31).player.vel, [0, 0, 0]);
      near(snapAt(r, 31).player.pos[2], 3);
      // jump at tick 0, try again mid-air at tick 10: semi-implicit Euler, y_n = (7n − n(n+1)/6)/60 → apex 1.167 m at n = 20/21, lands n = 41
      const j = runHeadless({ scenario: Q, ticks: 60, every: 1, inputs: [{ tick: 0, jump: true }, { tick: 5, jump: false }, { tick: 10, jump: true }] });
      const ys = snaps(j).map((s) => s.player.pos[1]);
      near(Math.max(...ys), (7 * 20 - (20 * 21) / 6) / 60);
      assert.equal(snapAt(j, 40).player.grounded, false);
      assert.equal(snapAt(j, 43).player.grounded, true);
      assert.equal(snapAt(j, 43).player.pos[1], 0);
      return `vel tick 1 = [0,0,6], thả phím → [0,0,0]; nhảy: đỉnh ${Math.max(...ys)} m, bấm nhảy giữa không trung bị bỏ qua, chạm đất trước tick 43`;
    },
  },
  {
    id: 'P5', req: 'Lướt: 14 m/s trong 0.2 s (12 tick) theo hướng nhân vật quay mặt khi đứng yên; hồi chiêu 1.5 s từ lúc bắt đầu; event dash',
    run() {
      const r = runHeadless({ scenario: Q, ticks: 20, every: 1, inputs: [{ tick: 0, dash: true }] });
      assert.deepEqual(events(r, 'dash').map((e) => [e.tick, e.data]), [[1, {}]]);
      assert.deepEqual(snapAt(r, 1).player.vel, [0, 0, 14]); // night 1 start faces +Z
      near(snapAt(r, 12).player.pos[2], (14 * 12) / 60);
      near(snapAt(r, 20).player.pos[2], 2.8);
      assert.equal(snapAt(r, 1).player.dash_cd_s, 1.5);
      const cd = Math.round(T.dash_cooldown_s * 60); // 90
      const early = runHeadless({ scenario: Q, ticks: cd + 5, inputs: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: cd - 1, dash: true }] });
      const ok = runHeadless({ scenario: Q, ticks: cd + 5, inputs: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: cd, dash: true }] });
      assert.equal(events(early, 'dash').length, 1);
      assert.deepEqual(events(ok, 'dash').map((e) => e.tick), [1, cd + 1]);
      // moving: dash follows the movement direction (+X here)
      const mv = runHeadless({ scenario: Q, ticks: 12, inputs: [{ tick: 0, move: [1, 0], dash: true }] });
      near(snapAt(mv, 10).player.pos[0], 14 * 10 / 60); near(snapAt(mv, 10).player.pos[2], 0);
      return `dash event tick 1, vel 14, 12 tick → z=${snapAt(r, 20).player.pos[2]}; bấm lại ở tick ${cd - 1} bị chặn, tick ${cd} được; khi đang chạy lướt theo hướng chạy`;
    },
  },
  {
    id: 'P6', req: 'Lướt trên không giữ nguyên độ cao; không bất tử khi lướt',
    run() {
      const r = runHeadless({ scenario: Q, ticks: 30, every: 1, inputs: [{ tick: 0, jump: true }, { tick: 10, dash: true }] });
      const y = (t) => snapAt(r, t).player.pos[1];
      for (let t = 11; t <= 22; t++) assert.equal(y(t), y(10), `tick ${t}`);
      assert.notEqual(y(23), y(22)); // vertical motion resumes after the dash (vy was frozen, not reset)
      const hit = runHeadless({ scenario: { ...Q, shades: [{ id: 'S1', pos: [0, 1, 2] }] }, ticks: 6, inputs: [{ tick: 0, dash: true }] });
      assert.equal(events(hit, 'player_hit').length, 1);
      return `độ cao giữ ${y(10)} m từ tick 10 tới 22; lướt xuyên Bóng Mực vẫn bị chạm (tick ${events(hit, 'player_hit')[0].tick})`;
    },
  },
  {
    id: 'P7', req: 'Bùa Gió: nhặt như đom đóm → charm_picked {charm_id, charm_ticks:600}; chạy 7.2 m/s; xuất hiện lại sau 2700 tick',
    run() {
      // Night 2 default charm C1 at (35,0,0) on the bridge; the player stands on it.
      const sc = { ...Q, charms: undefined, player: { pos: [35, 0, 0] } };
      delete sc.charms;
      const r = runHeadless({ night: 2, scenario: sc, ticks: 61, every: 1, inputs: [{ tick: 1, move: [1, 0] }] });
      assert.deepEqual(events(r, 'charm_picked').map((e) => [e.tick, e.data]), [[1, { charm_id: 'C1', charm_ticks: 600 }]]);
      const c1 = snapAt(r, 1);
      assert.equal(c1.charms[0].available, false); assert.equal(c1.charms[0].respawn_s, 45); assert.equal(c1.player.charm_s, 10);
      near(snapAt(r, 61).player.pos[0], 35 + 7.2); // 60 steps at 7.2 m/s
      const back = runHeadless({ night: 2, scenario: { ...Q, charms: [{ id: 'C1', pos: [10, 0, 0], available: false, respawn_ticks: 3 }] }, ticks: 3, every: 1 });
      assert.deepEqual([1, 2, 3].map((t) => snapAt(back, t).charms[0].available), [false, false, true]);
      const exp = runHeadless({ scenario: { ...Q, player: { charm_ticks: 30 } }, ticks: 60, every: 1, inputs: [{ tick: 0, move: [1, 0] }] });
      near(snapAt(exp, 60).player.pos[0], (29 * 7.2 + 31 * 6) / 60); // charm counts 30→0: steps 0–28 at 7.2, then 6
      return `nhặt C1 tick 1, respawn_s 45, charm_s 10; 60 tick chạy được ${(snapAt(r, 61).player.pos[0] - 35).toFixed(3)} m; bùa hết hiệu lực thì về 6 m/s`;
    },
  },
  {
    id: 'P8', req: 'Bùa Gió: Lướt không hồi chiêu nhưng vẫn phải nhấn lại; nhấn khi đang lướt bị bỏ qua; vẫn 14 m/s trong 12 tick',
    run() {
      const inputs = [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 12, dash: true }, { tick: 13, dash: false }, { tick: 30, dash: true }];
      const r = runHeadless({ scenario: { ...Q, player: { charm_ticks: 600 } }, ticks: 42, every: 1, inputs });
      // dash #1 covers steps 0–11; press at 5 ignored (dashing); press at 12 → dash #2 (no cooldown); press at 30 → dash #3
      assert.deepEqual(events(r, 'dash').map((e) => e.tick), [1, 13, 31]);
      near(snapAt(r, 42).player.pos[2], 3 * 2.8);
      assert.equal(snapAt(r, 13).player.dash_cd_s, 0);
      return `dash ở tick ${events(r, 'dash').map((e) => e.tick).join(', ')} (bấm lúc đang lướt ở tick 5 bị bỏ qua); 3 lần × 2.8 m`;
    },
  },
  {
    id: 'P9', req: 'Phần 1: nhặt khi XZ ≤ 1.0 m VÀ chênh cao chân Mây – mặt đất đặt đom đóm ≤ 1.5 m',
    run() {
      const r = runHeadless({ scenario: { ...Q, motes: [[0, 1.5, 0.5], [0.3, 1.6, 0]] }, ticks: 3, every: 1 });
      assert.equal(events(r, 'mote_picked').length, 1);
      assert.deepEqual(snapAt(r, 3).motes.map((m) => m.pos), [[0.3, 1.6, 0]]);
      return 'mote cao 1.5 m được nhặt, mote cao 1.6 m không';
    },
  },
  {
    id: 'P10', req: 'Phần 1: nạp vào đèn chưa sáng gần nhất trong 2.0 m; bằng nhau thì id nhỏ hơn; bỏ qua đèn đã sáng',
    run() {
      const tie = runHeadless({ scenario: { ...Q, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [1.5, 0, 0] }, { id: 'L2', pos: [-1.5, 0, 0] }] }, ticks: 2, inputs: [{ tick: 0, interact: true }] });
      assert.equal(events(tie, 'deposit')[0].data.lantern_id, 'L1');
      const tie2 = runHeadless({ scenario: { ...Q, player: { carried: 3 }, lanterns: [{ id: 'L5', pos: [1.5, 0, 0] }, { id: 'L2', pos: [-1.5, 0, 0] }] }, ticks: 2, inputs: [{ tick: 0, interact: true }] });
      assert.equal(events(tie2, 'deposit')[0].data.lantern_id, 'L2');
      const lit = runHeadless({ scenario: { ...Q, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0.5, 0, 0], lit: true }, { id: 'L3', pos: [1.9, 0, 0] }] }, ticks: 2, inputs: [{ tick: 0, interact: true }] });
      assert.equal(events(lit, 'deposit')[0].data.lantern_id, 'L3');
      return 'L1/L2 cách đều → L1; L5/L2 cách đều → L2; L1 đã sáng ở 0.5 m bị bỏ qua → L3 ở 1.9 m';
    },
  },
  {
    id: 'P11', req: 'Vùng an toàn 6 m: bóng đang ở trong lúc đèn vừa thắp bị đẩy ra mép trong ≤ 30 tick, không gây sát thương lúc đó; sau đó bị chặn ở mép',
    run() {
      const sc = { ...Q, player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ id: 'S1', pos: [0, 1, 24.3] }] };
      const r = runHeadless({ scenario: sc, ticks: 300, every: 1, inputs: [{ tick: 0, interact: true }] });
      assert.equal(events(r, 'lantern_lit')[0].tick, 1);
      const d = (t) => Math.hypot(snapAt(r, t).shades[0].pos[0], snapAt(r, t).shades[0].pos[2] - 25);
      assert.ok(d(15) < 6 - 1e-3, 'expel is gradual');
      near(d(30), 6);
      for (const s of snaps(r).filter((x) => x.tick >= 30)) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 25) >= 6 - 1e-3);
      assert.equal(events(r, 'player_hit').length, 0);
      return `S1 cách đèn 0.7 m lúc thắp → ${d(15).toFixed(2)} m (tick 15) → ${d(30).toFixed(3)} m (tick 30); 300 tick không bị chạm dù lúc đầu cách Mây 0.8 m`;
    },
  },
  {
    id: 'P12', req: 'Tỏa Sáng: đo 3D từ chân+0.8 m (≤ 5 m); +5 mỗi bóng trúng kể cả đang choáng; pulse lại làm mới choáng; trùng vị trí đẩy +X; thiếu 3 đom đóm không kích hoạt',
    run() {
      const sc = { ...Q, player: { carried: 5 }, shades: [{ id: 'S1', pos: [3, 4.8, 0] }, { id: 'S2', pos: [0, 5.81, 0] }, { id: 'S3', pos: [0, 1, 0], state: 'stunned', state_ticks_left: 500 }] };
      const r = runHeadless({ scenario: sc, ticks: 122, every: 1, inputs: [{ tick: 0, pulse: true }] });
      // S1: √(3² + 4²) = 5 → hit; S2: 5.81 − 0.8 = 5.01 → miss; S3 stunned → hit again, stun reset 500 → 120
      assert.deepEqual(events(r, 'pulse')[0].data, { stunned_ids: ['S1', 'S3'] });
      assert.equal(snapAt(r, 1).score, 2 * S.per_stun);
      assert.equal(snapAt(r, 1).player.carried, 2); assert.equal(snapAt(r, 1).player.pulse_cd_s, 3);
      const s3 = (t) => snapAt(r, t).shades.find((s) => s.id === 'S3');
      near(s3(15).pos[0], 4); near(s3(15).pos[2], 0);
      assert.equal(s3(120).state, 'stunned'); assert.notEqual(s3(121).state, 'stunned');
      const none = runHeadless({ scenario: { ...Q, player: { carried: 2 } }, ticks: 2, every: 1, inputs: [{ tick: 0, pulse: true }] });
      assert.equal(events(none, 'pulse').length, 0); assert.equal(snapAt(none, 1).player.pulse_cd_s, 0);
      return 'trúng [S1 (đúng 5 m 3D), S3 (đang choáng)], trượt S2 (5.01 m); +10 điểm; S3 trùng XZ bị đẩy +X 4 m, choáng làm mới còn 120 tick; carried 2 → không pulse';
    },
  },
  {
    id: 'P13', req: 'Tỏa Sáng: đẩy lùi dừng khi gặp vật cản (mép đảo)',
    run() {
      const r = runHeadless({ scenario: { ...Q, player: { pos: [36, 0, 0], carried: 3 }, shades: [{ id: 'S1', pos: [38.5, 1, 0] }] }, ticks: 20, every: 1, inputs: [{ tick: 0, pulse: true }] });
      const x = snapAt(r, 20).shades[0].pos[0];
      assert.ok(x <= 40 && x > 38.5, `x=${x}`);
      assert.equal(snapAt(r, 20).shades[0].pos[1], 1);
      return `Bóng Mực ở x=38.5 bị đẩy tới x=${x} (mép đảo 40 m) thay vì 42.5`;
    },
  },
  {
    id: 'P14', req: 'Bóng Mực: phát hiện 12 m / bỏ đuổi 18 m; tên trạng thái spawning, wander, chase, recoil, stunned',
    run() {
      const st = (pos, state) => snapAt(runHeadless({ scenario: { ...Q, shades: [{ id: 'S1', pos, state }] }, ticks: 1, every: 1 }), 1).shades[0].state;
      assert.equal(st([12.5, 1, 0], 'wander'), 'wander');
      assert.equal(st([11.9, 1, 0], 'wander'), 'chase');
      assert.equal(st([17.9, 1, 0], 'chase'), 'chase');
      assert.equal(st([18.1, 1, 0], 'chase'), 'wander');
      const g = runHeadless({ seed: 5, ticks: 340, every: 10, scenario: { lanterns: [{ id: 'L1', lit: true }], player: { pos: [0, 0, 25] }, random_drifters: false } });
      assert.deepEqual(snapAt(g, 300).shades.map((s) => s.state), ['spawning', 'spawning']);
      const allowed = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned']);
      for (const s of snaps(g)) for (const sh of s.shades) assert.ok(allowed.has(sh.state));
      return 'wander 12.5 m → wander, 11.9 m → chase; chase 17.9 m → chase, 18.1 m → wander; bóng mới sinh ở trạng thái spawning';
    },
  },
  {
    id: 'P15', req: 'Chạm: XZ ≤ 1 m và chênh cao ≤ 1.5 m; tối đa 1 lần mất lửa mỗi tick (xét id tăng dần); bóng gây hit lùi 2 m trong 60 tick',
    run() {
      const r = runHeadless({ scenario: { ...Q, shades: [{ id: 'S2', pos: [0.5, 1, 0] }, { id: 'S1', pos: [-0.5, 1, 0] }] }, ticks: 61, every: 1 });
      assert.deepEqual(events(r, 'player_hit').map((e) => [e.tick, e.data.flames]), [[1, T.flames - 1]]);
      const s1 = (t) => snapAt(r, t).shades.find((s) => s.id === 'S1');
      assert.equal(s1(1).state, 'recoil');
      assert.equal(snapAt(r, 1).shades.find((s) => s.id === 'S2').state, 'chase');
      // step 0: S1 chases 4/60 → x = −0.4333; steps 1–60 recoil 2/60 each → −2.4333; recoil ends after step 60
      near(s1(61).pos[0], -0.5 + 4 / 60 - 2, 2e-3);
      assert.equal(s1(60).state, 'recoil'); assert.equal(s1(61).state, 'wander');
      // Night 3: player on tier 1 (y 3), shade below the wall on tier 0 → XZ 0.9 m but 3 m apart vertically
      const h = runHeadless({ night: 3, scenario: { ...Q, player: { pos: [0, 3, 12.5] }, shades: [{ id: 'S1', pos: [0, 1, 11.6] }] }, ticks: 60 });
      assert.equal(events(h, 'player_hit').length, 0);
      return `2 bóng chạm cùng tick → 1 hit do S1 (id nhỏ hơn); S1 recoil tới x=${s1(61).pos[0]} sau 60 tick; bóng dưới vách (chênh 3 m) không gây hit`;
    },
  },
  {
    id: 'P16', req: 'Bị đánh: rơi floor(mang/2) đom đóm ra vành 1.5–2.5 m, tồn tại 480 tick; bất tử 90 tick',
    run() {
      const r = runHeadless({ scenario: { ...Q, player: { carried: 7 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }, ticks: 1, every: 1 });
      assert.deepEqual(events(r, 'player_hit')[0].data, { by: 'shade', flames: 2, dropped: 3 });
      assert.equal(snapAt(r, 1).player.carried, 4);
      const ttl = runHeadless({ scenario: { ...Q, motes: [{ pos: [5, 0, 0], kind: 'dropped', ttl_ticks: 3 }] }, ticks: 3, every: 1 });
      assert.deepEqual([0, 1, 2, 3].map((t) => snapAt(ttl, t).motes_active), [1, 1, 1, 0]);
      // default TTL: a dropped mote that exists at tick 0 lives 480 ticks → gone at tick 480
      const full = runHeadless({ scenario: { ...Q, motes: [{ pos: [5, 0, 0], kind: 'dropped' }] }, ticks: 480, every: 1 });
      assert.equal(snapAt(full, 479).motes_active, 1); assert.equal(snapAt(full, 480).motes_active, 0);
      return 'mang 7 → rơi 3, còn 4; ttl_ticks 3 → mất ở tick 3; TTL mặc định 480 tick (còn ở tick 479, mất ở tick 480)';
    },
  },
  {
    id: 'P17', req: 'Rơi khỏi đảo (Y < −10): 1 lần, −1 lửa, mất hết đom đóm (player_hit by fall + lost); chờ 60 tick rồi hồi sinh ở điểm xuất phát, bất tử 90 tick',
    run() {
      const r = runHeadless({ scenario: { ...Q, player: { pos: [39.55, 0, 0], carried: 4 } }, ticks: 130, every: 1, inputs: [{ tick: 0, move: [1, 0] }] });
      // off the edge at step 4 (x = 40.05); after k falling steps y = −k(k+1)/360 < −10 first at k = 60 → step 63 → tick 64
      const f = events(r, 'player_hit');
      assert.deepEqual(f.map((e) => [e.tick, e.data]), [[64, { by: 'fall', flames: 2, dropped: 0, lost: 4 }]]);
      assert.equal(snapAt(r, 64).player.carried, 0);
      assert.ok(snapAt(r, 123).player.pos[1] < -10);
      assert.deepEqual(snapAt(r, 124).player.pos, [0, 0, 0]);
      assert.deepEqual(snapAt(r, 124).player.vel, [0, 0, 0]);
      assert.equal(snapAt(r, 124).player.invuln, true);
      const last = runHeadless({ scenario: { ...Q, player: { pos: [39.55, 0, 0], flames: 1 } }, ticks: 200, inputs: [{ tick: 0, move: [1, 0] }] });
      assert.deepEqual(end(last), { type: 'end', ticks: 64, state: 'lost', score: 0 });
      return 'rơi ở tick 64 (tính tay), lost 4; tick 124 hồi sinh tại (0,0,0), vel 0, bất tử; còn 1 lửa thì thua ngay (no_flames), không hồi sinh';
    },
  },
  {
    id: 'P18', req: 'Đêm 2: cầu tre x∈[26,44], z∈[−2,2] không lan can; bục nhảy bắn lên vy 14, 24 m/s về tâm đảo kia, giữ tới khi chạm đất (~1.4 s), phím di chuyển không ghi đè',
    run() {
      const walk = runHeadless({ night: 2, scenario: { ...Q, player: { pos: [20, 0, 0] } }, ticks: 600, inputs: [{ tick: 0, move: [1, 0] }] });
      assert.equal(events(walk, 'player_hit').length, 0);
      near(snapAt(walk, 600).player.pos[0], 80); assert.equal(snapAt(walk, 600).player.pos[1], 0);
      const off = runHeadless({ night: 2, scenario: { ...Q, player: { pos: [35, 0, 1.5] } }, ticks: 120, inputs: [{ tick: 0, move: [0, 1] }] });
      assert.equal(events(off, 'player_hit')[0].data.by, 'fall');
      const pad = runHeadless({ night: 2, scenario: { ...Q, player: { pos: [20, 0, 18] } }, ticks: 100, every: 1 });
      const steer = runHeadless({ night: 2, scenario: { ...Q, player: { pos: [20, 0, 18] } }, ticks: 100, every: 1, inputs: [{ tick: 1, move: [1, 0] }] });
      // launched at the end of step 0; y_k = (14k − k(k+1)/6)/60 hits 0 at k = 83 → lands at tick 84 after 83 × 0.4 m = 33.2 m
      const dir = [50 / Math.hypot(50, 18), -18 / Math.hypot(50, 18)];
      assert.equal(snapAt(pad, 83).player.grounded, false);
      assert.equal(snapAt(pad, 84).player.grounded, true);
      const land = snapAt(pad, 84).player.pos;
      near(land[0], 20 + dir[0] * 33.2, 0.01); near(land[2], 18 + dir[1] * 33.2, 0.01);
      assert.ok(Math.hypot(land[0] - 70, land[2]) < 28);
      assert.deepEqual(snapAt(steer, 84).player.pos, land);
      return `đi bộ qua cầu 600 tick không rơi; bước ra mép cầu → rơi; bục (20,0,18) → đáp tick 84 tại ${JSON.stringify(land)} (đảo B), phím di chuyển không đổi quỹ đạo`;
    },
  },
  {
    id: 'P19', req: 'Đêm 3: vách tầng không đi lên được; dốc 30°/150° lên tầng 1 (Y=3); bục (0,3,13) đáp lên tầng 2 (Y=6); tháp chuông r 2 m chặn',
    run() {
      const wall = runHeadless({ night: 3, scenario: { ...Q, player: { pos: [0, 0, 9] } }, ticks: 120, inputs: [{ tick: 0, move: [0, 1] }] });
      const w = snapAt(wall, 120).player.pos;
      assert.ok(w[2] <= 12 && w[2] > 11.8 && w[1] === 0, JSON.stringify(w));
      const c = Math.cos(rad(30)), s = Math.sin(rad(30));
      const ramp = runHeadless({ night: 3, scenario: { ...Q, player: { pos: [30 * c, 0, 30 * s] } }, ticks: 90, every: 1, inputs: [{ tick: 0, move: [-c, -s] }] });
      near(snapAt(ramp, 30).player.pos[1], 1.5); // 3 m along the 6 m ramp
      assert.equal(snapAt(ramp, 90).player.pos[1], 3); assert.equal(snapAt(ramp, 90).player.grounded, true);
      const pad = runHeadless({ night: 3, scenario: { ...Q, player: { pos: [0, 3, 13] } }, ticks: 80, every: 1 });
      const p = snapAt(pad, 80).player;
      assert.equal(p.pos[1], 6); assert.equal(p.grounded, true); assert.ok(Math.hypot(p.pos[0], p.pos[2]) <= 8);
      const tower = runHeadless({ night: 3, scenario: { ...Q, player: { pos: [0, 6, 5] } }, ticks: 60, inputs: [{ tick: 0, move: [0, -1] }] });
      const tp = snapAt(tower, 60).player.pos;
      assert.ok(tp[2] >= 2 && tp[2] < 2.2 && tp[1] === 6, JSON.stringify(tp));
      return `đi vào vách tầng 1 dừng ở z=${w[2]}; dốc: Y=1.5 giữa dốc, Y=3 trên tầng 1; bục → ${JSON.stringify(p.pos)} (tầng 2); tháp chặn ở z=${tp[2]}`;
    },
  },
  {
    id: 'P20', req: 'Đêm 3 gió mạnh: mỗi 30 s một cơn 5 s, hướng ngẫu nhiên, đẩy 2 m/s; snapshot wind {active, dir_deg}; wind_enabled:false tắt',
    run() {
      const sc = { ...Q, time_left_s: 360 };
      delete sc.wind_enabled;
      const r = runHeadless({ night: 3, seed: 4, scenario: sc, ticks: 2110, every: 1 });
      assert.equal(snapAt(r, 1799).wind.active, false);
      const w = snapAt(r, 1800).wind;
      assert.equal(w.active, true); assert.ok(Number.isInteger(w.dir_deg) && w.dir_deg >= 0 && w.dir_deg < 360);
      assert.equal(snapAt(r, 2099).wind.active, true); assert.equal(snapAt(r, 2100).wind.active, false);
      const a = snapAt(r, 1799).player.pos, b = snapAt(r, 2099).player.pos;
      near(Math.hypot(b[0] - a[0], b[2] - a[2]), 10, 2e-3); // 300 steps × 2/60 m
      near(b[0] - a[0], 10 * Math.cos(rad(w.dir_deg)), 2e-3); near(b[2] - a[2], 10 * Math.sin(rad(w.dir_deg)), 2e-3);
      const off = runHeadless({ night: 3, scenario: { ...Q, time_left_s: 360 }, ticks: 1900, every: 100 });
      assert.deepEqual(snapAt(off, 1900).player.pos, [0, 0, -20]);
      assert.equal(snapAt(runHeadless({ night: 1, scenario: { ...Q, wind_enabled: true }, ticks: 1800, every: 1800 }), 1800).wind.active, false);
      return `gió bật tick 1800–2099, hướng ${w.dir_deg}°, đẩy Mây đứng yên đúng 10 m theo hướng đó; wind_enabled:false đứng yên; Đêm 1 không có gió`;
    },
  },
  {
    id: 'P21', req: 'Gió Lạc: idle → chase khi mang ≥ 5 và cách ≤ 15 m; chạm XZ ≤ 1.2 m cướp min(3, mang) (drifter_steal); flee 240 tick rồi removed; bất tử không ngăn bị cướp',
    run() {
      const sc = { ...Q, player: { carried: 6, invuln_ticks: 600 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] };
      const r = runHeadless({ night: 2, scenario: sc, ticks: 400, every: 1 });
      assert.equal(snapAt(r, 1).drifters[0].state, 'chase');
      const st = events(r, 'drifter_steal');
      assert.equal(st.length, 1);
      assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
      // gap 10 m closes at 7/60 m per step; touch when ≤ 1.2 m → after ceil(8.8 / (7/60)) = 76 steps → tick 76
      assert.equal(st[0].tick, 76);
      const k = st[0].tick;
      assert.equal(snapAt(r, k).drifters[0].stolen, 3);
      assert.equal(snapAt(r, k + 239).drifters[0].state, 'flee'); assert.equal(snapAt(r, k + 240).drifters[0].state, 'removed');
      const few = runHeadless({ night: 2, scenario: { ...Q, player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }, ticks: 1, every: 1 });
      assert.equal(snapAt(few, 1).drifters[0].state, 'idle');
      assert.equal(snapAt(r, 1).player.flames, T.flames);
      return `mang 6 → chase; cướp 3 ở tick ${k} (tính tay 76), dù đang bất tử, không mất lửa; flee tới tick ${k + 239}, removed tick ${k + 240}; mang 4 → vẫn idle`;
    },
  },
  {
    id: 'P22', req: 'Gió Lạc + Tỏa Sáng: trúng lúc chase → flee không cướp; trúng lúc flee có mang đồ → thả lại toàn bộ (drifter_drop), biến mất sau 120 tick',
    run() {
      const a = runHeadless({ night: 2, scenario: { ...Q, player: { carried: 9 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] }, ticks: 300, every: 1, inputs: [{ tick: 0, pulse: true }] });
      assert.equal(snapAt(a, 1).drifters[0].state, 'flee');
      assert.equal(events(a, 'drifter_steal').length, 0);
      assert.equal(snapAt(a, 300).player.carried, 6);
      const b = runHeadless({ night: 2, scenario: { ...Q, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3, state_ticks_left: 240 }] }, ticks: 130, every: 1, inputs: [{ tick: 0, pulse: true }] });
      assert.deepEqual(events(b, 'drifter_drop').map((e) => [e.tick, e.data]), [[1, { drifter_id: 'D1', amount: 3 }]]);
      assert.equal(snapAt(b, 1).drifters[0].stolen, 0);
      assert.equal(snapAt(b, 1).motes.filter((m) => m.kind === 'dropped').length, 3);
      assert.equal(snapAt(b, 119).drifters[0].state, 'flee'); assert.equal(snapAt(b, 120).drifters[0].state, 'removed');
      return 'chase + pulse → flee, không cướp (carried 9−3 = 6); flee mang 3 + pulse → drifter_drop 3, 3 đom đóm rơi, removed ở tick 120';
    },
  },
  {
    id: 'P23', req: 'Gió Lạc chỉ ở Đêm 2, 3: sinh tại tick 1200, 2400… (id D1, D2…), tối đa 2',
    run() {
      const sc = { random_shades: false, shades: [], time_left_s: 330 };
      const r2 = runHeadless({ night: 2, seed: 3, scenario: sc, ticks: 3700, every: 100 });
      assert.equal(snapAt(r2, 1100).drifters.length, 0);
      assert.deepEqual(snapAt(r2, 1200).drifters.map((d) => d.id), ['D1']);
      assert.deepEqual(snapAt(r2, 2400).drifters.map((d) => d.id), ['D1', 'D2']);
      assert.equal(snapAt(r2, 3600).drifters.filter((d) => d.state !== 'removed').length, 2); // max 2 alive → no D3
      const r1 = runHeadless({ night: 1, seed: 3, scenario: sc, ticks: 1200, every: 1200 });
      assert.equal(snapAt(r1, 1200).drifters.length, 0);
      return 'Đêm 2: D1 ở tick 1200, D2 ở tick 2400, tick 3600 không có D3 (đã đủ 2); Đêm 1 không có Gió Lạc';
    },
  },
  {
    id: 'P24', req: 'Tạm dừng: tick vẫn tăng nhưng sim_tick, thời gian, hồi chiêu, spawn đứng yên; snapshot state "paused"; event paused/resumed; nút khác bị bỏ qua',
    run() {
      const inputs = [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 15, jump: true }, { tick: 30, pause: true }];
      const r = runHeadless({ scenario: { ...Q, player: { pulse_cd_ticks: 100 } }, ticks: 40, every: 1, inputs });
      assert.deepEqual(events(r).map((e) => [e.tick, e.name]), [[11, 'paused'], [31, 'resumed']]);
      const s20 = snapAt(r, 20);
      assert.equal(s20.state, 'paused'); assert.equal(s20.sim_tick, 10);
      near(s20.time_left_s, 300 - 10 / 60); near(s20.player.pos[2], 1);
      assert.equal(s20.player.pulse_cd_s, snapAt(r, 10).player.pulse_cd_s);
      assert.equal(snapAt(r, 31).sim_tick, 11); near(snapAt(r, 31).player.pos[2], 1.1);
      assert.ok(snaps(r).every((s) => s.player.pos[1] === 0), 'jump pressed while paused must be ignored');
      const sp = runHeadless({ seed: 5, ticks: 500, scenario: { lanterns: [{ id: 'L1', lit: true }], player: { pos: [0, 0, 25] } }, inputs: [{ tick: 50, pause: true }, { tick: 51, pause: false }, { tick: 150, pause: true }] });
      assert.deepEqual(events(sp, 'shade_spawned').map((e) => e.tick), [400, 400]); // sim tick 300 = tick 300 + 100 paused ticks
      const still = runHeadless({ scenario: Q, ticks: 25, inputs: [{ tick: 10, pause: true }] });
      assert.equal(end(still).state, 'playing');
      return 'paused tick 11, resumed tick 31; tick 20: state paused, sim_tick 10, giờ và hồi chiêu đứng yên; Bóng Mực sinh ở tick 400 (= sim_tick 300 + 100 tick dừng); nhảy lúc dừng bị bỏ qua';
    },
  },
  {
    id: 'P25', req: 'Thắng/thua sau mỗi tick: hết lửa luôn thua (kể cả đèn đã sáng hết); thắng đúng tick hết giờ vẫn là thắng',
    run() {
      const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
      const a = runHeadless({ scenario: { ...Q, lanterns: all, player: { flames: 0 } }, ticks: 5 });
      assert.deepEqual(events(a, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
      const four = all.slice(1);
      const b = runHeadless({ scenario: { ...Q, lanterns: four, time_left_s: 1 / 60, player: { pos: [0, 0, 24], carried: 10 } }, ticks: 5, inputs: [{ tick: 0, interact: true }] });
      assert.deepEqual(events(b, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
      assert.equal(end(b).score, 10 * S.per_mote + S.per_lantern + 0 * S.per_second_left + 3 * S.per_flame_left);
      return `lửa 0 + đèn sáng hết → lost/no_flames; thắp đèn cuối đúng tick hết giờ → won, điểm ${end(b).score} (= 100 + 100 + 0 + 150)`;
    },
  },
  {
    id: 'P26', req: 'Lịch sinh Bóng Mực Đêm 2 (mỗi 7 s, tối đa 8) và Đêm 3 (mỗi 6 s, tối đa 10), cách người chơi ≥ 15 m, tại điểm chuẩn; Đêm 3 tốc độ 4.5 m/s',
    run() {
      const out = [];
      for (const [n, hide, times, onPoint] of [
        [2, { lanterns: [{ id: 'L2', lit: true }], player: { pos: [17, 0, -10] } }, [300, 300, 720, 1140], (p) => [0, 70].some((cx) => Math.abs(Math.hypot(p[0] - cx, p[2]) - 26) < 2e-3)],
        [3, { lanterns: [{ id: 'L4', lit: true }], player: { pos: [35, 0, -10] } }, [300, 300, 660, 1020], (p) => Math.abs(Math.hypot(p[0], p[2]) - 43) < 2e-3],
      ]) {
        const r = runHeadless({ night: n, seed: 2, ticks: times.at(-1), every: 10, scenario: { ...hide, random_drifters: false, wind_enabled: false } });
        const sp = events(r, 'shade_spawned');
        assert.deepEqual(sp.map((e) => e.tick), times);
        for (const e of sp) {
          const sh = snapAt(r, e.tick).shades.find((s) => s.id === e.data.id);
          assert.ok(onPoint(sh.pos), `${sh.id} at ${sh.pos}`);
          assert.ok(dxz(sh.pos, hide.player.pos) >= 15);
        }
        out.push(`Đêm ${n}: ${sp.map((e) => e.tick).join(',')}`);
      }
      const v = runHeadless({ night: 3, scenario: { ...Q, shades: [{ id: 'S1', pos: [10, 1, -20] }] }, ticks: 60 });
      near(10 - snapAt(v, 60).shades[0].pos[0], 4.5);
      return `${out.join('; ')}; mọi bóng mới ở điểm chuẩn, cách Mây ≥ 15 m; Đêm 3 bóng đi 4.5 m/s`;
    },
  },
  {
    id: 'P27', req: 'Contract v1.1: tất định ở Đêm 2, 3; input dash/pause là boolean; scenario sai (state lạ, drifters không phải mảng) → mã 2',
    run() {
      const inputs = [{ tick: 0, move: [0.4, 1] }, { tick: 200, dash: true }, { tick: 201, dash: false }, { tick: 400, pulse: true }];
      for (const n of [2, 3]) {
        const a = runHeadless({ night: n, seed: 9, ticks: 3000, inputs }), b = runHeadless({ night: n, seed: 9, ticks: 3000, inputs });
        assert.equal(a.text, b.text);
      }
      const bad = [
        runHeadless({ inputs: '{"frames":[{"tick":0,"dash":1}]}' }),
        runHeadless({ inputs: '{"frames":[{"tick":0,"pause":"yes"}]}' }),
        runHeadless({ scenario: { shades: [{ pos: [1, 1, 1], state: 'angry' }] } }),
        runHeadless({ scenario: { drifters: {} } }),
        runHeadless({ night: 1, scenario: { lanterns: [{ id: 'L6', lit: true }] } }),
      ];
      assert.deepEqual(bad.map((r) => r.code), [2, 2, 2, 2, 2]);
      return 'Đêm 2, 3: 2 lần chạy giống hệt từng byte; 5 input/scenario sai → mã 2';
    },
  },
  {
    id: 'P28', req: 'Chạy headless một Đêm đầy đủ (21.600 tick) xong trong ≤ 30 giây',
    run() {
      const out = [];
      for (const n of [1, 2, 3]) {
        const t0 = process.hrtime.bigint();
        const r = runHeadless({ night: n, seed: 1, ticks: 21600, scenario: { player: { flames: 100000 }, time_left_s: 400 } });
        const sec = Number(process.hrtime.bigint() - t0) / 1e9;
        assert.equal(end(r).ticks, 21600);
        assert.ok(sec <= 30, `night ${n}: ${sec}s`);
        out.push(`Đêm ${n}: ${sec.toFixed(2)} s`);
      }
      return `21.600 tick (đủ Bóng Mực, Gió Lạc, gió): ${out.join(', ')}`;
    },
  },
];
