// Greedy bot that plays a full Night 1 and records an inputs.json (contract format).
// The inputs file is then replayed through the real headless CLI as end-to-end proof.
//   node scripts/bot.js <seed> <out-inputs.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Game } from '../src/sim/game.js';
import { ROOT } from '../tests/cases.js';

const seed = Number(process.argv[2] ?? 1);
const outFile = process.argv[3] ?? 'bot-inputs.json';
const T = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')).tuning;
const g = new Game({ tuning: T, seed });
const d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

const frames = [];
let prev = null;
for (let k = 0; k < 60 * T.night1_duration_s && g.state === 'playing'; k++) {
  const p = g.player.pos;
  const unlit = g.lanterns.filter((l) => !l.lit);
  const needed = Math.min(T.carry_capacity, unlit.reduce((s, l) => s + T.lantern_cost - l.deposited, 0));
  let target, interact = false, pulse = false;
  const lantern = unlit.sort((a, b) => d(p, a.pos) - d(p, b.pos))[0];
  if (g.player.carried >= Math.min(needed, T.lantern_cost) || g.motes.length === 0) {
    target = lantern.pos;
    interact = d(p, lantern.pos) <= T.interact_radius - 0.2 && k % 2 === 0;
  } else {
    target = g.motes.reduce((best, m) => (d(p, m.pos) < d(p, best.pos) ? m : best)).pos;
  }
  const threat = g.shades.some((s) => s.stun === 0 && d(p, s.pos) < 2.5);
  if (threat && g.player.carried >= T.pulse_cost && k % 2 === 0) pulse = true;
  const dx = target[0] - p[0], dz = target[2] - p[2], n = Math.hypot(dx, dz) || 1;
  const move = [Math.round((dx / n) * 1000) / 1000, Math.round((dz / n) * 1000) / 1000];
  const input = { move, cam_yaw_deg: 0, interact, pulse };
  const f = { tick: k };
  if (!prev || prev.move[0] !== move[0] || prev.move[1] !== move[1]) f.move = move;
  if (!prev || prev.interact !== interact) f.interact = interact;
  if (!prev || prev.pulse !== pulse) f.pulse = pulse;
  if (Object.keys(f).length > 1) frames.push(f);
  prev = input;
  g.step(input);
}
writeFileSync(outFile, JSON.stringify({ frames }));
console.log(`bot seed ${seed}: ${g.state} after ${g.steps} ticks, score ${g.score}, ${frames.length} frames → ${outFile}`);
