// Phase 3 cases (Ticket-03 "Đèn cạn dầu", Test Contract v1.2). Every case runs the REAL headless CLI.
// Fuel is reasoned about in units of 1/60 (FU): a lit lantern burns 1 FU/tick, each draining shade 5 FU/tick, one mote refuels 600 FU.
import assert from 'node:assert/strict';
import { runHeadless, TUNING, events, snaps, snapAt, end, quiet, near } from './cases.js';

const T = TUNING, S = TUNING.score;
const Q = { ...quiet, random_drifters: false, wind_enabled: false, drifters: [], charms: [] };
const L2 = [23.8, 0, 7.7];
const far = [-30, 0, 0]; // player position far from everything (> 12 m from shades near L2)
const lanternAt = (r, tick, id) => snapAt(r, tick).lanterns.find((l) => l.id === id);
const shadeAt = (r, tick, id) => snapAt(r, tick).shades.find((s) => s.id === id);
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export const cases3 = [
  {
    id: 'F1', req: 'Contract v1.2: contract_version 1.2, tuning fuel_max 100, fuel_decay_per_s 1, fuel_per_mote 10, relight_cost 5, win_ratio 0.6, drain_per_s 5, low_fuel_threshold 30, capacity_max 20; thời lượng 240/270/300',
    run() {
      const want = { fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300 };
      for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
      const s = snapAt(runHeadless({ ticks: 0, scenario: { ...Q, lanterns: [{ id: 'L1', lit: true }] } }), 0);
      assert.equal(s.player.capacity, 10);
      assert.deepEqual(s.lanterns[0], { id: 'L1', pos: [0, 0, 25], lit: true, deposited: 10, fuel: 100, ever_lit: true, relit_count: 0 });
      assert.deepEqual(s.lanterns[1].fuel, 0); assert.equal(s.lanterns[1].ever_lit, false);
      return `${Object.keys(want).length} khóa đúng; đèn lit không ghi fuel → 100; đèn tắt fuel 0; player.capacity 10`;
    },
  },
  {
    id: 'F2', req: 'Hao dầu 1.0/giây khi sáng, tính bằng đơn vị nguyên 1/60 (100 → 0 đúng ở tick 6000); snapshot fuel 1 chữ số thập phân',
    run() {
      const r = runHeadless({ scenario: { ...Q, lanterns: [{ id: 'L1', lit: true }] }, ticks: 6001, every: 30 });
      assert.deepEqual([60, 600, 3000, 5970].map((t) => lanternAt(r, t, 'L1').fuel), [99, 90, 50, 0.5]);
      assert.deepEqual(events(r, 'lantern_out').map((e) => [e.tick, e.data]), [[6000, { lantern_id: 'L1' }]]);
      return 'fuel ở tick 60/600/3000/5970 = 99/90/50/0.5; lantern_out đúng tick 6000 (6000 FU × 1 FU/tick, không trôi số thực)';
    },
  },
  {
    id: 'F3', req: 'Hết dầu: đèn tắt, deposited = 0, lantern_out, ever_lit vẫn true; ánh sáng/đếm đèn giảm',
    run() {
      const r = runHeadless({ scenario: { ...Q, lanterns: [{ id: 'L1', lit: true, fuel: 0.5 }] }, ticks: 31, every: 1 });
      // 0.5 fuel = 30 FU → 0 after step 29 → lantern_out at tick 30
      assert.deepEqual(events(r, 'lantern_out').map((e) => e.tick), [30]);
      assert.equal(lanternAt(r, 29, 'L1').lit, true);
      assert.deepEqual(lanternAt(r, 30, 'L1'), { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
      return 'fuel 0.5 → tắt ở tick 30 (tính tay), deposited 0, ever_lit true';
    },
  },
  {
    id: 'F4', req: 'Thắp lại: đèn ever_lit chỉ cần 5 đom đóm; lantern_lit {relight:true}; +5/đom đóm +40; relit_count +1; fuel = 100',
    run() {
      const sc = { ...Q, player: { pos: [0, 0, 24], carried: 7 }, lanterns: [{ id: 'L1', lit: false, ever_lit: true }] };
      const r = runHeadless({ scenario: sc, ticks: 2, every: 1, inputs: [{ tick: 0, interact: true }] });
      assert.deepEqual(events(r, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
      assert.deepEqual(events(r, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
      const l = lanternAt(r, 1, 'L1');
      assert.equal(l.fuel, 100); assert.equal(l.relit_count, 1); assert.equal(snapAt(r, 1).player.carried, 2);
      assert.equal(snapAt(r, 1).score, 5 * S.per_mote + S.per_relight);
      return `nạp 5 → thắp lại, fuel 100, relit_count 1, carried 7→2, điểm ${snapAt(r, 1).score} (= 5×5 + 40)`;
    },
  },
  {
    id: 'F5', req: 'Châm dầu: used = min(mang, ceil((100 − fuel)/10)), fuel = min(100, fuel + 10·used); event refuel {lantern_id, amount, fuel}; +5/đom đóm',
    run() {
      const run = (fuel, carried) => runHeadless({ scenario: { ...Q, player: { pos: [0, 0, 24], carried }, lanterns: [{ id: 'L1', lit: true, fuel }] }, ticks: 1, every: 1, inputs: [{ tick: 0, interact: true }] });
      // fuel 25 → 24.983 after phase 2; missing 75.017 → ceil(7.5017) = 8 used → fuel min(100, 104.98) = 100
      const a = run(25, 10);
      assert.deepEqual(events(a, 'refuel')[0].data, { lantern_id: 'L1', amount: 8, fuel: 100 });
      assert.equal(snapAt(a, 1).player.carried, 2); assert.equal(snapAt(a, 1).score, 8 * S.per_mote);
      // fuel 40, only 3 carried → used 3 → 39.983 + 30 = 69.983 → 70.0
      const b = run(40, 3);
      assert.deepEqual(events(b, 'refuel')[0].data, { lantern_id: 'L1', amount: 3, fuel: 70 });
      assert.equal(events(b, 'deposit').length + events(b, 'lantern_lit').length, 0);
      return 'fuel 25 + mang 10 → dùng 8, fuel 100, +40 điểm; fuel 40 + mang 3 → dùng 3, fuel 70.0';
    },
  },
  {
    id: 'F6', req: 'Đèn fuel < 30 mất vùng an toàn; đúng 30 vẫn còn',
    run() {
      // fuel 30.5 = 1830 FU → exactly 1800 (30.0) after step 29 (tick 30); 29.98 from tick 31
      const sc = { ...Q, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true, fuel: 30.5 }], shades: [{ id: 'S1', pos: [0, 1, 31] }] };
      const r = runHeadless({ scenario: sc, ticks: 200, every: 1 });
      assert.equal(lanternAt(r, 30, 'L1').fuel, 30);
      for (let t = 1; t <= 30; t++) assert.ok(dxz(shadeAt(r, t, 'S1').pos, [0, 0, 25]) >= 6 - 1e-3, `tick ${t}`);
      assert.ok(dxz(shadeAt(r, 40, 'S1').pos, [0, 0, 25]) < 6 - 0.3, 'zone lost below 30');
      const hit = events(r, 'player_hit');
      assert.ok(hit.length >= 1 && hit[0].tick > 31);
      return `tick 1–30 (fuel ≥ 30) Bóng Mực bị chặn ở 6 m; từ tick 31 (29.98) đi vào, chạm Mây ở tick ${hit[0].tick}`;
    },
  },
  {
    id: 'F7', req: 'Bóng Mực wander đi tới đèn sáng fuel < 30 gần nhất (ưu tiên hơn đèn tắt); không có thì về đèn tắt gần nhất',
    run() {
      // S1 at (10,1,25): unlit L1 is 10 m away, weak L2 is 22.1 m away → goes for L2 at 4 m/s
      const sc = { ...Q, player: { pos: far }, lanterns: [{ id: 'L2', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [10, 1, 25], state: 'wander' }] };
      const r = runHeadless({ scenario: sc, ticks: 30, every: 30 });
      near(dxz([10, 0, 25], L2) - dxz(shadeAt(r, 30, 'S1').pos, L2), 2, 2e-3);
      const u = runHeadless({ scenario: { ...Q, player: { pos: far }, shades: [{ id: 'S1', pos: [5, 1, 25], state: 'wander' }] }, ticks: 90, every: 90 });
      const s = shadeAt(u, 90, 'S1');
      near(dxz(s.pos, [0, 0, 25]), 1, 2e-3); assert.equal(s.state, 'wander');
      return 'S1 bỏ qua L1 tắt (10 m), tiến 2 m/0.5 s về L2 yếu (22 m); không có đèn yếu → về đèn tắt L1 và đứng chờ cách 1 m, vẫn wander';
    },
  },
  {
    id: 'F8', req: 'drain: cách đèn yếu ≤ 2 m thì đứng yên hút 5 fuel/giây (cộng dồn nhiều con, đèn vẫn tự hao 1/giây); fuel_drain mỗi 60 tick',
    run() {
      const sc = { ...Q, player: { pos: far }, lanterns: [{ id: 'L2', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [23.8, 1, 12.7], state: 'wander' }] };
      const r = runHeadless({ scenario: sc, ticks: 200, every: 1 });
      const t0 = snaps(r).find((x) => x.shades[0].state === 'drain').tick;
      assert.ok(t0 <= 50, `drain at ${t0}`);
      const p0 = shadeAt(r, t0 + 10, 'S1').pos;
      assert.deepEqual(shadeAt(r, t0 + 70, 'S1').pos, p0, 'draining shade stands still');
      near(lanternAt(r, t0 + 10, 'L2').fuel - lanternAt(r, t0 + 70, 'L2').fuel, 6, 0.05); // (1 + 5) per second
      const fd = events(r, 'fuel_drain');
      assert.ok(fd.length >= 2 && fd[1].tick - fd[0].tick === 60 && fd[0].data.shade_id === 'S1' && fd[0].data.lantern_id === 'L2');
      // two shades already draining L2 (fuel 25 = 1500 FU): 1 + 5 + 5 = 11 FU/tick → 1500 − 660 = 840 FU = 14.0 after 60 ticks
      const two = runHeadless({ scenario: { ...Q, player: { pos: far }, lanterns: [{ id: 'L2', lit: true, fuel: 25 }],
        shades: [{ id: 'S1', pos: [23.8, 1, 9.2], state: 'drain', target_lantern_id: 'L2' }, { id: 'S2', pos: [25.3, 1, 7.7], state: 'drain', target_lantern_id: 'L2' }] }, ticks: 60, every: 60 });
      assert.equal(lanternAt(two, 60, 'L2').fuel, 14);
      // S1's event is written before S2's drain of that tick: (1500 − 59×11 − 6) / 60 = 14.083 → 14.1; S2 → 14.0
      assert.deepEqual(events(two, 'fuel_drain').map((e) => [e.tick, e.data]), [[60, { lantern_id: 'L2', shade_id: 'S1', fuel: 14.1 }], [60, { lantern_id: 'L2', shade_id: 'S2', fuel: 14 }]]);
      return `S1 vào drain ở tick ${t0}, đứng yên; đèn mất 6.0/giây; fuel_drain cách nhau 60 tick; 2 con hút: 25 → 14.0 sau 60 tick (11 FU/tick)`;
    },
  },
  {
    id: 'F9', req: 'Rời drain: Mây vào trong 6 m → chase; trúng Tỏa Sáng → stunned (+15 điểm); đèn tắt → wander',
    run() {
      const base = { ...Q, lanterns: [{ id: 'L2', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [23.8, 1, 9.2], state: 'drain', target_lantern_id: 'L2' }] };
      const near6 = runHeadless({ scenario: { ...base, player: { pos: [23.8, 0, 14.7] } }, ticks: 1, every: 1 }); // 5.5 m
      assert.equal(shadeAt(near6, 1, 'S1').state, 'chase');
      const out6 = runHeadless({ scenario: { ...base, player: { pos: [23.8, 0, 15.3] } }, ticks: 1, every: 1 }); // 6.1 m
      assert.equal(shadeAt(out6, 1, 'S1').state, 'drain');
      const pz = runHeadless({ scenario: { ...base, player: { pos: [23.8, 0, 13.2], carried: 3 } }, ticks: 1, every: 1, inputs: [{ tick: 0, pulse: true }] });
      assert.equal(shadeAt(pz, 1, 'S1').state, 'stunned'); assert.equal(snapAt(pz, 1).score, S.per_stun_drain);
      const dead = runHeadless({ scenario: { ...base, player: { pos: far }, lanterns: [{ id: 'L2', lit: true, fuel: 0.2 }] }, ticks: 3, every: 1 });
      // 0.2 = 12 FU, 6 FU/tick → 0 after step 1 → lantern_out tick 2; S1 back to wander
      assert.deepEqual(events(dead, 'lantern_out').map((e) => e.tick), [2]);
      assert.equal(shadeAt(dead, 2, 'S1').state, 'wander');
      return 'Mây 5.5 m → chase (6.1 m → vẫn drain); pulse → stunned, +15; đèn tắt ở tick 2 → wander';
    },
  },
  {
    id: 'F10', req: 'Châm dầu lên ≥ 30 khi có Bóng Mực trong 6 m: con đó về wander, bị đẩy ra mép trong ≤ 30 tick, không gây sát thương',
    run() {
      const sc = { ...Q, player: { pos: [22.3, 0, 7.7], carried: 2 }, lanterns: [{ id: 'L2', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [25.3, 1, 7.7], state: 'drain', target_lantern_id: 'L2' }] };
      const r = runHeadless({ scenario: sc, ticks: 120, every: 1, inputs: [{ tick: 0, interact: true }] });
      // fuel 20 − 6/60 (step 0 drain + decay) = 19.9 → +20 = 39.9 ≥ 30
      assert.deepEqual(events(r, 'refuel')[0].data, { lantern_id: 'L2', amount: 2, fuel: 39.9 });
      assert.equal(shadeAt(r, 1, 'S1').state, 'wander');
      near(dxz(shadeAt(r, 30, 'S1').pos, L2), 6);
      assert.equal(events(r, 'player_hit').length, 0);
      return 'refuel 2 → 39.9; S1 (đang drain, cách Mây 3 m) về wander, ra mép 6 m ở tick 30, không chạm Mây trong 120 tick';
    },
  },
  {
    id: 'F11', req: 'Luật thắng mới theo Đêm: bình minh cần ceil(0.6 × tổng đèn) đang sáng — Đêm 2 cần 4/6, Đêm 3 cần 5/7',
    run() {
      const res = (night, n) => {
        const lanterns = Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
        return events(runHeadless({ night, scenario: { ...Q, lanterns, time_left_s: 1 / 60 }, ticks: 2 }), 'game_over')[0].data.reason;
      };
      assert.deepEqual([res(1, 3), res(1, 2), res(2, 4), res(2, 3), res(3, 5), res(3, 4)], ['dawn_survived', 'dawn', 'dawn_survived', 'dawn', 'dawn_survived', 'dawn']);
      return 'Đêm 1: 3/5 thắng, 2/5 thua; Đêm 2: 4/6 thắng, 3/6 thua; Đêm 3: 5/7 thắng, 4/7 thua';
    },
  },
  {
    id: 'F12', req: 'Sức chứa = 10 + 2 × successful_lights (tối đa 20); thắp lại cũng tính; đèn đặt sẵn không tính',
    run() {
      const lit = runHeadless({ scenario: { ...Q, player: { pos: [0, 0, 24], carried: 10 } }, ticks: 1, every: 1, inputs: [{ tick: 0, interact: true }] });
      assert.equal(snapAt(lit, 0).player.capacity, 10); assert.equal(snapAt(lit, 1).player.capacity, 12);
      const max = snapAt(runHeadless({ scenario: { ...Q, player: { successful_lights: 6 } }, ticks: 0 }), 0);
      assert.equal(max.player.capacity, 20);
      const pre = snapAt(runHeadless({ scenario: { ...Q, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }, ticks: 0 }), 0);
      assert.equal(pre.player.capacity, 10);
      const pick = runHeadless({ scenario: { ...Q, player: { successful_lights: 1 }, motes: Array.from({ length: 14 }, () => [0, 0, 0]) }, ticks: 3, every: 1 });
      assert.equal(snapAt(pick, 3).player.carried, 12);
      const re = runHeadless({ scenario: { ...Q, player: { pos: [0, 0, 24], carried: 5 }, lanterns: [{ id: 'L1', ever_lit: true }] }, ticks: 1, every: 1, inputs: [{ tick: 0, interact: true }] });
      assert.equal(snapAt(re, 1).player.capacity, 12);
      return 'thắp 1 đèn → 12; successful_lights 6 → 20 (trần); 2 đèn đặt sẵn → 10; sức chứa 12 → nhặt 12/14; thắp lại → 12';
    },
  },
  {
    id: 'F13', req: 'Contract v1.2 scenario: fuel ngoài [0,100], drain thiếu target_lantern_id, target_lantern_id lạ, successful_lights âm → mã 2',
    run() {
      const bad = [
        runHeadless({ scenario: { lanterns: [{ id: 'L1', lit: true, fuel: 120 }] } }),
        runHeadless({ scenario: { shades: [{ pos: [1, 1, 1], state: 'drain' }] } }),
        runHeadless({ scenario: { shades: [{ pos: [1, 1, 1], target_lantern_id: 'L9' }] } }),
        runHeadless({ scenario: { player: { successful_lights: -1 } } }),
        runHeadless({ scenario: { lanterns: [{ id: 'L1', ever_lit: 'yes' }] } }),
      ];
      assert.deepEqual(bad.map((r) => r.code), [2, 2, 2, 2, 2]);
      return '5 scenario sai kiểu v1.2 → mã thoát 2';
    },
  },
];
