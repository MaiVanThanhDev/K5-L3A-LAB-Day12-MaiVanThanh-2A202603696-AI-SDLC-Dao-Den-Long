// Greedy bot that plays a full night and records an inputs.json (contract format).
// The inputs file is then replayed through the real headless CLI as end-to-end proof.
//   node scripts/bot.js <seed> <out-inputs.json> [night=1]
// It only reads game state and produces inputs; all rules stay in src/sim/game.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Game } from '../src/sim/game.js';
import { ROOT } from '../tests/cases.js';

const seed = Number(process.argv[2] ?? 1);
const outFile = process.argv[3] ?? 'bot-inputs.json';
const night = Number(process.argv[4] ?? 1);
const T = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')).tuning;
const g = new Game({ tuning: T, seed, night });
const d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const deg = (a) => (a * Math.PI) / 180;
const level = (y) => (y > 4.5 ? 2 : y > 1.5 ? 1 : 0);

// ---- route planning: next point to walk toward on the way from p to target t ----
function waypoint(p, t) {
  if (night === 2) {
    const side = (x) => (x < 35 ? 0 : 1);
    if (side(p[0]) === side(t[0])) return t;
    const onBridge = p[0] >= 24 && p[0] <= 46 && Math.abs(p[2]) < 1.2;
    if (onBridge) return [side(t[0]) ? 47 : 23, 0, 0];
    const entry = side(p[0]) ? [46, 0, 0] : [24, 0, 0];
    return Math.abs(p[2]) < 0.6 && d(p, entry) < 0.8 ? [side(t[0]) ? 47 : 23, 0, 0] : entry;
  }
  if (night === 3) {
    const lp = level(p[1]), lt = level(t[1]);
    const ramps = [30, 150].map((a) => ({ foot: [31 * Math.cos(deg(a)), 0, 31 * Math.sin(deg(a))], top: [21.5 * Math.cos(deg(a)), 3, 21.5 * Math.sin(deg(a))], mid: [27 * Math.cos(deg(a)), 1.5, 27 * Math.sin(deg(a))] }));
    if (lt > lp) {
      if (lp === 0) {
        const r = ramps.sort((a, b) => d(p, a.foot) - d(p, b.foot))[0];
        const rp = Math.hypot(p[0], p[2]);
        const onRamp = d(p, r.mid) < 3.6 && rp < 31.5;
        if (onRamp) return r.top;
        return detour0(p, r.foot);
      }
      return lp === 1 ? arc1(p, [0, 3, 13]) : t; // tier 1 → launch pad → tier 2
    }
    if (lt < lp) {
      if (lp === 2) return [t[0], 6, t[2]]; // walk off the disc edge
      // tier 1 → tier 0: step off the outer edge toward the target side
      const a = Math.atan2(p[2], p[0]);
      return [26 * Math.cos(a), 0, 26 * Math.sin(a)];
    }
    if (lp === 1) return arc1(p, t);
    if (lp === 0) return detour0(p, t);
    return t;
  }
  return t;
}
// On tier 1 (half annulus 12–24, z > 0) keep to radius ~18 when the straight line would leave it.
function arc1(p, t) {
  const a1 = Math.atan2(p[2], p[0]), a2 = Math.atan2(t[2], t[0]);
  for (let k = 1; k < 10; k++) {
    const x = p[0] + ((t[0] - p[0]) * k) / 10, z = p[2] + ((t[2] - p[2]) * k) / 10, r = Math.hypot(x, z);
    if (r < 13 || r > 23.5 || z < 0.5) {
      const a = a1 + Math.sign(a2 - a1) * Math.min(Math.abs(a2 - a1), deg(25));
      return [18 * Math.cos(a), 3, 18 * Math.sin(a)];
    }
  }
  return t;
}
// On tier 0 avoid walking into the tier walls (tier 1 on z > 0 out to r 24, tier 2 r ≤ 8): go around at r ~30.
function detour0(p, t) {
  const blocked = (x, z) => { const r = Math.hypot(x, z); return r < 9 || (z > -0.5 && r > 11.5 && r < 25); };
  let hit = false;
  for (let k = 1; k <= 12; k++) { const x = p[0] + ((t[0] - p[0]) * k) / 12, z = p[2] + ((t[2] - p[2]) * k) / 12; if (blocked(x, z)) hit = true; }
  if (!hit) return t;
  const a1 = Math.atan2(p[2], p[0]), a2 = Math.atan2(t[2], t[0]);
  let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  // prefer going around through the south (z < 0) where tier 0 is open
  const viaSouth = Math.sin(a1 + da / 2) < 0 ? da : da - Math.sign(da) * 2 * Math.PI;
  const a = a1 + Math.sign(viaSouth) * Math.min(Math.abs(viaSouth), deg(30));
  const r = Math.max(28, Math.min(33, Math.hypot(p[0], p[2])));
  return [r * Math.cos(a), 0, r * Math.sin(a)];
}

const frames = [];
let prev = null, stuck = 0, lastPos = [...g.player.pos], jitter = 0;
const limit = g.dawnTick;
for (let k = 0; k < limit && g.state === 'playing'; k++) {
  const p = g.player.pos;
  // Ticket-03: keep enough lanterns burning until dawn. Work on unlit lanterns or lit ones under 60 fuel;
  // a lit lantern under 40 fuel is urgent (refuel it first). Night 3: stay on ground-level lanterns.
  const FU = 60;
  const reachable = (l) => night !== 3 || level(l.pos[1]) === 0;
  const need = (l) => (l.lit ? Math.ceil((T.fuel_max * FU - l.fuel) / (T.fuel_per_mote * FU)) : (l.everLit ? T.relight_cost : T.lantern_cost) - l.deposited);
  let pool = g.lanterns.filter((l) => reachable(l) && (!l.lit || l.fuel < 60 * FU));
  if (!pool.length) pool = g.lanterns.filter(reachable);
  const urgent = pool.filter((l) => l.lit && l.fuel < 40 * FU).sort((a, b) => a.fuel - b.fuel);
  const lantern = urgent[0] || [...pool].sort((a, b) => d(p, a.pos) - d(p, b.pos))[0];
  const needL = Math.max(1, need(lantern));
  const want = Math.min(g.capacity, needL + T.pulse_cost);
  let target, interact = false, pulse = false, dash = false;
  let motes = g.motes.filter((m) => m.from <= g.simTick + 1);
  if (night === 3 && motes.some((m) => level(m.pos[1]) === 0)) motes = motes.filter((m) => level(m.pos[1]) === 0);
  if (g.player.carried >= want || (urgent.length && g.player.carried >= Math.min(needL, 3)) || motes.length === 0) {
    target = lantern.pos;
    interact = d(p, lantern.pos) <= T.interact_radius - 0.2 && Math.abs(level(p[1]) - level(lantern.pos[1])) === 0 && k % 2 === 0;
  } else {
    const cost = (m) => d(p, m.pos) + 15 * Math.abs(level(m.pos[1]) - level(p[1]));
    target = motes.reduce((best, m) => (cost(m) < cost(best) ? m : best)).pos;
  }
  const danger = g.shades.filter((s) => (s.state === 'chase' || s.state === 'wander') && !s.expel && d(p, s.pos) < 7 && Math.abs(s.pos[1] - 1 - p[1]) < 2);
  const threat = danger.some((s) => d(p, s.pos) < 4.2);
  const thief = g.drifters.some((dr) => dr.state === 'chase' && d(p, dr.pos) < 4);
  if ((threat || thief) && g.player.carried >= T.pulse_cost && g.player.pulseCd === 0 && k % 2 === 0) pulse = true;
  const wp = waypoint(p, target);
  let dx = wp[0] - p[0], dz = wp[2] - p[2];
  let n = Math.hypot(dx, dz) || 1;
  // steer away from nearby active shades (stronger when closer), unless already safe in a lit zone
  const inSafe = g.lanterns.some((l) => g.hasZone(l) && d(p, l.pos) < T.safe_radius - 0.5);
  if (!inSafe && danger.length && !(pulse)) {
    let rx = 0, rz = 0;
    for (const sh of danger) { const q = d(p, sh.pos) || 0.01, w = (7 - q) / q; rx += ((p[0] - sh.pos[0]) / q) * w; rz += ((p[2] - sh.pos[2]) / q) * w; }
    dx = dx / n + rx * 0.9; dz = dz / n + rz * 0.9; n = Math.hypot(dx, dz) || 1;
    if (night !== 3 && danger.some((sh) => d(p, sh.pos) < 2.2) && g.player.dashCd === 0 && g.player.grounded) dash = true;
  }
  if (d(p, lastPos) < 0.02 && !g.player.launch && g.player.fallWait === 0) stuck++; else stuck = 0;
  lastPos = [...p];
  if (stuck > 20) jitter = 30;
  let move = [Math.round((dx / n) * 1000) / 1000, Math.round((dz / n) * 1000) / 1000];
  if (jitter > 0) { jitter--; move = [Math.round(-move[1] * 1000) / 1000, Math.round(move[0] * 1000) / 1000]; }
  if (n < 0.15) move = [0, 0];
  if (!dash && d(p, target) > 12 && g.player.dashCd === 0 && g.player.grounded && k % 2 === 0 && night !== 3) dash = true;
  const input = { move, cam_yaw_deg: 0, interact, pulse, dash };
  const f = { tick: k };
  if (!prev || prev.move[0] !== move[0] || prev.move[1] !== move[1]) f.move = move;
  for (const b of ['interact', 'pulse', 'dash']) if (!prev || prev[b] !== input[b]) f[b] = input[b];
  if (Object.keys(f).length > 1) frames.push(f);
  prev = input;
  g.step(input);
}
writeFileSync(outFile, JSON.stringify({ frames }));
console.log(`bot night ${night} seed ${seed}: ${g.state} after ${g.tick} ticks, score ${g.score}, lit ${g.lanterns.filter((l) => l.lit).length}/${g.lanterns.length}, flames ${g.player.flames}, ${frames.length} frames → ${outFile}`);
