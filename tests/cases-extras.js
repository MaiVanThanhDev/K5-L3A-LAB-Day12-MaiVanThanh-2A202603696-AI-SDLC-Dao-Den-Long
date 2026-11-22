// Extras cases (ADR 0002, branch feature/boss-android): Diệt Bóng skill + boss Chúa Bóng Mực.
// Every case runs the REAL headless CLI. Extras are switched on only by the scenario key "extras": true.
// Expected values come from game.contract.json and hand arithmetic written in the comments, never from a run.
import assert from 'node:assert/strict';
import { TUNING, runHeadless, events, snapAt, snaps, end, quiet, near } from './cases.js';

const T = TUNING, ES = TUNING.extras_score;
const X = (extra = {}) => ({ ...quiet, extras: true, random_boss: false, ...extra });
const ev = (r, name) => events(r, name).map((e) => ({ tick: e.tick, ...e.data }));
const press = (button, ...ticksOn) => ticksOn.flatMap((t) => [{ tick: t, [button]: true }, { tick: t + 1, [button]: false }]);
// merge frame lists: frames with the same tick are combined (inputs need strictly increasing ticks)
const frames = (...lists) => {
  const by = new Map();
  for (const f of lists.flat()) by.set(f.tick, { ...(by.get(f.tick) || {}), ...f });
  return [...by.values()].sort((a, b) => a.tick - b.tick);
};

export const casesExtras = [
  {
    id: 'X1', req: 'Không có "extras": nút banish bị bỏ qua, snapshot giữ đúng dạng v1.3 (không có boss, banish_cd_s); đầu ra giống hệt khi không gửi banish',
    run() {
      const sc = { ...quiet, player: { carried: 5 } };
      const a = runHeadless({ ticks: 130, scenario: sc, inputs: press('banish', 0, 60) });
      const b = runHeadless({ ticks: 130, scenario: sc, inputs: [{ tick: 0, move: [0, 0] }] });
      assert.equal(a.code, 0);
      assert.equal(events(a, 'banish').length, 0);
      assert.equal(end(a).ticks, 130);
      for (const s of snaps(a)) { assert.ok(!('boss' in s)); assert.ok(!('banish_cd_s' in s)); }
      assert.equal(a.text, b.text);
      // timed boss spawn is extras-only too: 3600 ticks of a normal Night 1 → no boss_spawned
      const c = runHeadless({ ticks: 3600, every: 3600, scenario: quiet });
      assert.equal(events(c, 'boss_spawned').length, 0);
      return 'banish bị bỏ qua, JSONL giống hệt từng byte; 3600 tick không có boss';
    },
  },
  {
    id: 'X2', req: 'Diệt Bóng: xóa mọi Bóng Mực ĐANG CHOÁNG trong 3 m (tâm = chân + 0.8 m), tốn 2 đom đóm, +20 điểm/con; con không choáng hoặc xa hơn 3 m còn nguyên',
    run() {
      // centre c = [0, 0.8, 0]. S1 [2,1,0]: √(4 + 0.04) = 2.01 ≤ 3 → removed. S2 [0,1,4]: √(0.04 + 16) = 4.005 > 3 → stays.
      // S3 chase at [-2,1,0]: not stunned → stays (Mây is invulnerable so S3 cannot hit her and change the counts).
      const sc = X({ player: { carried: 5, invuln_ticks: 600 }, shades: [
        { id: 'S1', pos: [2, 1, 0], state: 'stunned', state_ticks_left: 120 },
        { id: 'S2', pos: [0, 1, 4], state: 'stunned', state_ticks_left: 120 },
        { id: 'S3', pos: [-2, 1, 0], state: 'chase' }] });
      const r = runHeadless({ ticks: 10, every: 1, scenario: sc, inputs: press('banish', 0) });
      assert.deepEqual(ev(r, 'banish'), [{ tick: 1, banished_ids: ['S1'], boss_hit: false }]);
      const s1 = snapAt(r, 1);
      assert.equal(s1.player.carried, 5 - T.banish_cost); // 3
      assert.equal(s1.score, ES.per_banish); // 20
      assert.deepEqual(s1.shades.map((s) => s.id), ['S2', 'S3']);
      assert.equal(s1.banish_cd_s, T.banish_cooldown_s); // set to 60 ticks in step 0 → 1 s
      assert.equal(snapAt(r, 10).banish_cd_s, 0.85); // (60 − 9) / 60
      return 'S1 (2.01 m) bị xóa; S2 (4.005 m) và S3 (không choáng) còn; đom đóm 5→3, điểm 20';
    },
  },
  {
    id: 'X3', req: 'Diệt Bóng: hồi chiêu 1 s (60 tick); bấm khi đang hồi hoặc khi mang < 2 đom đóm thì không có gì xảy ra; bấm hụt vẫn tốn 2',
    run() {
      // cd = 60 after step 0, 60 − k after step k → 30 at step 30 (refused), 0 at step 60 (fires).
      // carried 5 → 3 (step 0) → 1 (step 60) → step 120: 1 < 2 → refused.
      const r = runHeadless({ ticks: 130, scenario: X({ player: { carried: 5 } }), inputs: press('banish', 0, 30, 60, 120) });
      assert.deepEqual(ev(r, 'banish').map((e) => e.tick), [1, 61]);
      assert.equal(end(r).ticks, 130);
      assert.equal(snapAt(r, 130).player.carried, 1);
      assert.equal(snapAt(r, 130).score, 0); // no target, no score
      return 'chỉ tick 1 và 61 kích hoạt; tick 31 (đang hồi) và 121 (còn 1 đom đóm) bị từ chối; còn 1 đom đóm';
    },
  },
  {
    id: 'X4', req: 'Boss: Tỏa Sáng làm boss choáng 1.5 s (+5); Diệt Bóng lên boss đang choáng (≤ 4 m) trừ 1 HP (+50), boss lùi 2 m trong 60 tick rồi đuổi tiếp',
    run() {
      // c = [0,0.8,0], boss [3,1,0]: √(9 + 0.04) = 3.007 ≤ 5 (pulse) and ≤ 4 (reach).
      // step 0 pulse → stunned (+5); step 1 banish → hp 2 → 1 (+50) → score 55. Banish is phase 7b, so the recoil already moves
      // in phase 8 of that same step: steps 1..60 = 60 × 2/60 m → x = 5, back to chase at tick 61.
      const sc = X({ player: { carried: 10, invuln_ticks: 600 }, boss: { pos: [3, 1, 0], state: 'chase', hp: 2 } });
      const r = runHeadless({ ticks: 70, every: 1, scenario: sc, inputs: frames(press('pulse', 0), press('banish', 1)) });
      assert.deepEqual(ev(r, 'boss_stunned'), [{ tick: 1, boss_id: 'B1', interrupted: false, skill: null }]);
      assert.deepEqual(ev(r, 'banish'), [{ tick: 2, banished_ids: [], boss_hit: true }]);
      assert.deepEqual(ev(r, 'boss_hit'), [{ tick: 2, boss_id: 'B1', hp: 1 }]);
      assert.equal(snapAt(r, 2).score, T.score.per_stun + ES.per_boss_hit);
      assert.equal(snapAt(r, 2).player.carried, 10 - T.pulse_cost - T.banish_cost); // 5
      assert.equal(snapAt(r, 2).boss.state, 'recoil');
      assert.equal(snapAt(r, 60).boss.state, 'recoil');
      const b61 = snapAt(r, 61).boss;
      assert.equal(b61.state, 'chase'); near(b61.pos[0], 5); assert.equal(b61.pos[2], 0);
      return `choáng tick 1 (+5), trúng tick 2 → HP 1, điểm 55; tick 61 boss ở x = ${b61.pos[0]} và đuổi tiếp`;
    },
  },
  {
    id: 'X5', req: 'Boss: HP về 0 → boss_defeated, +50 +300 điểm, boss đứng yên ở trạng thái defeated (không di chuyển, không gây sát thương)',
    run() {
      const sc = X({ player: { carried: 2 }, boss: { pos: [2, 1, 0], state: 'stunned', hp: 1 } });
      const r = runHeadless({ ticks: 120, every: 1, scenario: sc, inputs: press('banish', 0) });
      assert.deepEqual(ev(r, 'boss_defeated'), [{ tick: 1, boss_id: 'B1', hp: 0 }]);
      assert.equal(snapAt(r, 1).score, ES.per_boss_hit + ES.per_boss_defeat); // 350
      assert.equal(snapAt(r, 1).boss.state, 'defeated');
      assert.deepEqual(snapAt(r, 120).boss.pos, [2, 1, 0]);
      assert.equal(events(r, 'player_hit').length, 0); // 2 m away but defeated → never touches
      return 'boss_defeated tick 1, điểm 350; 120 tick sau vẫn ở [2,1,0], không đánh Mây';
    },
  },
  {
    id: 'X6', req: 'Skill Triệu Hồi: báo trước 1.5 s (boss đứng yên), rồi gọi 2 Bóng Mực (spawning) cách boss 2.5 m ở góc 0° và 180°; skill kế tiếp là eclipse sau 12 s',
    run() {
      // step 0: skill timer 1 → 0 → cast (event tick 1), castLeft 90 → 89 in phase 8; fires when it reaches 0 at step 89 → tick 90.
      // spots: [10 + 2.5, 1, 0] = [12.5, 1, 0] and [10 − 2.5, 1, 0] = [7.5, 1, 0].
      const sc = X({ player: { invuln_ticks: 600 }, boss: { pos: [10, 1, 0], state: 'chase', skill_ticks_left: 1, next_skill: 'summon' } });
      const r = runHeadless({ ticks: 95, every: 1, scenario: sc });
      assert.deepEqual(ev(r, 'boss_cast'), [{ tick: 1, boss_id: 'B1', skill: 'summon', cast_s: T.boss_cast_ticks / 60 }]);
      assert.deepEqual(ev(r, 'boss_skill'), [{ tick: 90, boss_id: 'B1', skill: 'summon', spawned_ids: ['S1', 'S2'] }]);
      assert.equal(snapAt(r, 89).boss.state, 'cast'); assert.deepEqual(snapAt(r, 89).boss.pos, [10, 1, 0]);
      const s = snapAt(r, 90);
      assert.deepEqual(s.shades, [{ id: 'S1', pos: [12.5, 1, 0], state: 'spawning' }, { id: 'S2', pos: [7.5, 1, 0], state: 'spawning' }]);
      assert.equal(s.boss.state, 'chase'); assert.equal(s.boss.next_skill, 'eclipse'); assert.equal(s.boss.skill_in_s, T.boss_skill_every_s);
      assert.equal(s.boss.hp_max, T.boss_hp_base + 1); // Night 1 → 3
      return 'boss_cast tick 1, boss_skill tick 90 → S1 [12.5,1,0], S2 [7.5,1,0]; tiếp theo eclipse sau 12 s';
    },
  },
  {
    id: 'X7', req: 'Skill Nhật Thực: đèn sáng trong 14 m mất 25 dầu (có thể tắt ngay), đèn xa không bị; Mây trong 5 m bị đánh (−1 lửa, rơi nửa đom đóm)',
    run() {
      // boss [20,1,0]: L2 [23.8,0,7.7] √(3.8² + 7.7²) = 8.59 ≤ 14; L3 [14.7,0,−20.2] √(5.3² + 20.2²) = 20.88 > 14.
      // fires at tick 90 (as X6): L2 6000 − 90 − 1500 = 4410 FU = 73.5; L3 6000 − 90 = 5910 FU = 98.5.
      // Mây at [17,0,0]: 3 m ≤ 5 → hit, carried 4 → drops ⌊4 × 0.5⌋ = 2, flames 3 → 2.
      const boss = { pos: [20, 1, 0], state: 'chase', skill_ticks_left: 1, next_skill: 'eclipse' };
      const lanterns = (f2) => [{ id: 'L2', lit: true, fuel: f2 }, { id: 'L3', lit: true, fuel: 100 }];
      const r = runHeadless({ ticks: 92, every: 1, scenario: X({ player: { pos: [17, 0, 0], carried: 4 }, boss, lanterns: lanterns(100) }) });
      assert.deepEqual(ev(r, 'boss_skill'), [{ tick: 90, boss_id: 'B1', skill: 'eclipse', lantern_ids: ['L2'] }]);
      assert.deepEqual(ev(r, 'player_hit'), [{ tick: 90, by: 'boss_shock', flames: 2, dropped: 2 }]);
      const s = snapAt(r, 90);
      assert.equal(s.lanterns.find((l) => l.id === 'L2').fuel, 73.5);
      assert.equal(s.lanterns.find((l) => l.id === 'L3').fuel, 98.5);
      assert.equal(s.player.carried, 2); assert.equal(s.boss.next_skill, 'summon');
      // L2 with 20 fuel: 1200 − 90 − 1500 < 0 → goes out on the same tick
      const r2 = runHeadless({ ticks: 92, every: 1, scenario: X({ player: { pos: [17, 0, 0], invuln_ticks: 600 }, boss, lanterns: lanterns(20) }) });
      assert.deepEqual(ev(r2, 'lantern_out'), [{ tick: 90, lantern_id: 'L2' }]);
      assert.equal(snapAt(r2, 90).lanterns.find((l) => l.id === 'L2').lit, false);
      assert.equal(events(r2, 'player_hit').length, 0); // invulnerable → no shock damage
      return 'L2 100→73.5, L3 98.5 (xa); Mây trúng sóng xung kích tick 90; L2 còn 20 dầu thì tắt ngay tick 90';
    },
  },
  {
    id: 'X8', req: 'Ngắt skill: Tỏa Sáng trúng boss đang niệm → skill bị hủy (boss_stunned interrupted), không có boss_skill, chu kỳ skill đếm lại 12 s',
    run() {
      // pulse at step 0 → stunned 90 ticks: still stunned at tick 90, chase at tick 91; skill timer 720 → no skill before tick 200.
      const sc = X({ player: { carried: 3, invuln_ticks: 600 }, boss: { pos: [3, 1, 0], state: 'cast', state_ticks_left: 50, next_skill: 'summon' } });
      const r = runHeadless({ ticks: 200, every: 1, scenario: sc, inputs: press('pulse', 0) });
      assert.deepEqual(ev(r, 'boss_stunned'), [{ tick: 1, boss_id: 'B1', interrupted: true, skill: 'summon' }]);
      assert.equal(events(r, 'boss_skill').length, 0);
      assert.equal(snapAt(r, 1).boss.skill, null); assert.equal(snapAt(r, 1).boss.skill_in_s, T.boss_skill_every_s);
      assert.equal(snapAt(r, 90).boss.state, 'stunned'); assert.equal(snapAt(r, 91).boss.state, 'chase');
      assert.equal(snapAt(r, 1).score, T.score.per_stun);
      return 'skill summon bị ngắt ở tick 1; 200 tick không có boss_skill; hết choáng ở tick 91';
    },
  },
  {
    id: 'X9', req: 'Boss xuất hiện ở giây 60 (tick 3600) tại điểm sinh xa Mây nhất (hòa → điểm đầu), HP = 2 + số Đêm',
    run() {
      // Night 1 points ring(12, 37 m, from 15°, step 30°). Mây at [−10,0,0] → farthest are 15° and 345° (mirror images, tie) → 15°:
      // [37·cos15°, 1, 37·sin15°] = [35.739, 1, 9.576].
      const r = runHeadless({ ticks: 3600, every: 3600, scenario: { ...quiet, extras: true, player: { pos: [-10, 0, 0] } } });
      assert.deepEqual(ev(r, 'boss_spawned'), [{ tick: 3600, boss_id: 'B1', hp: T.boss_hp_base + 1 }]);
      const b = snapAt(r, 3600).boss;
      assert.deepEqual(b.pos, [35.739, 1, 9.576]); assert.equal(b.state, 'spawning'); assert.equal(snapAt(r, 0).boss, null);
      const hp = [2, 3].map((n) => snapAt(runHeadless({ night: n, ticks: 1, scenario: X({ boss: { pos: [30, 1, 0] } }) }), 0).boss.hp_max);
      assert.deepEqual(hp, [T.boss_hp_base + 2, T.boss_hp_base + 3]); // 4, 5
      return `boss_spawned tick 3600 tại [35.739, 1, 9.576], HP 3; Đêm 2/3: HP ${hp.join('/')}`;
    },
  },
  {
    id: 'X10', req: 'Boss chạm Mây (≤ 1.6 m): −1 lửa, rơi nửa đom đóm, boss lùi 2 m trong 60 tick',
    run() {
      // step 0: boss moves 3.2/60 toward Mây: 1.5 − 0.05333 = 1.44667 ≤ 1.6 → hit (tick 1). Recoil 60 × 2/60 → x = 3.44667 → 3.447.
      const sc = X({ player: { carried: 4 }, boss: { pos: [1.5, 1, 0], state: 'chase' } });
      const r = runHeadless({ ticks: 65, every: 1, scenario: sc });
      assert.deepEqual(ev(r, 'player_hit'), [{ tick: 1, by: 'boss', flames: 2, dropped: 2 }]);
      assert.equal(snapAt(r, 1).boss.state, 'recoil');
      const b = snapAt(r, 61).boss;
      assert.equal(b.state, 'chase'); assert.deepEqual(b.pos, [3.447, 1, 0]);
      return 'trúng tick 1 (lửa 3→2, rơi 2); tick 61 boss ở [3.447, 1, 0] và đuổi tiếp';
    },
  },
  {
    id: 'X11', req: 'Định dạng: extras/random_boss không phải boolean, boss thiếu pos, hp < 1, state hay next_skill lạ, banish không phải boolean → mã thoát 2',
    run() {
      const bad = [{ extras: 'yes' }, { random_boss: 1 }, { boss: {} }, { boss: { pos: [0, 1, 0], hp: 0 } }, { boss: { pos: [0, 1, 0], state: 'dance' } },
        { boss: { pos: [0, 1, 0], next_skill: 'fire' } }, { boss: { pos: [0, 1, 0], skill_ticks_left: -1 } }];
      for (const sc of bad) assert.equal(runHeadless({ ticks: 1, scenario: sc }).code, 2, JSON.stringify(sc));
      assert.equal(runHeadless({ ticks: 1, inputs: [{ tick: 0, banish: 1 }] }).code, 2);
      assert.equal(runHeadless({ ticks: 1, scenario: X({ boss: { pos: [0, 1, 30], state: 'cast', next_skill: 'eclipse', hp: 9 } }) }).code, 0);
      return `${bad.length} scenario sai + 1 inputs sai → mã 2; scenario boss hợp lệ → mã 0`;
    },
  },
  {
    id: 'X12', req: 'Tất định: cùng seed + extras chạy hai lần cho JSONL giống hệt (có boss xuất hiện, Bóng Mực ngẫu nhiên)',
    run() {
      // short walk only (a long one leaves the island and loses all 3 flames before the boss appears at tick 3600)
      const inputs = frames([{ tick: 0, move: [0, 1] }, { tick: 120, move: [1, 0] }, { tick: 200, move: [0, 0] }], press('pulse', 3700), press('banish', 3701));
      const a = runHeadless({ seed: 5, ticks: 4000, every: 50, scenario: { extras: true }, inputs });
      const b = runHeadless({ seed: 5, ticks: 4000, every: 50, scenario: { extras: true }, inputs });
      assert.equal(a.code, 0); assert.equal(a.text, b.text);
      assert.equal(events(a, 'boss_spawned').length, 1);
      return `2 lần chạy giống hệt (${a.lines.length} dòng), có boss_spawned`;
    },
  },
];
