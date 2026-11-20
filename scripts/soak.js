// Soak test (Ticket-04 §2): N nights in ONE process, Night 1 → 2 → 3 rotating, night i uses seed + i.
//   node scripts/soak.js --seed 7 --nights 10 --out soak.json      (soak_cmd in game.contract.json)
// Random inputs from the seed: new move direction every 30 ticks; each tick 5 % jump, 3 % dash, 2 % pulse, 10 % interact.
// Every 10 ticks a snapshot is serialised (like the headless runner) so the output path is exercised too.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { Game } from '../src/sim/game.js';
import { mulberry32 } from '../src/sim/rng.js';

// Re-run in a child with a fixed V8 memory profile: exposed gc, 1 MB young generation, no optimising JIT tiers.
// Without this, V8 warm-up (young-gen growth + compiler zones) adds ~10–16 MB of RSS that is not game memory
// (JS heap stays ~5 MB, see heap_used_*). Flags unknown to an older Node are dropped one by one.
if (!process.env.DDL_SOAK_CHILD) {
  const flags = ['--expose-gc', '--max-semi-space-size=1', '--no-opt', '--no-maglev'];
  for (let n = flags.length; n >= 0; n--) {
    const r = spawnSync(process.execPath, [...flags.slice(0, n), fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, DDL_SOAK_CHILD: flags.slice(0, n).join(' ') || 'none' } });
    if (r.status !== 9) process.exit(r.status ?? 1); // 9 = invalid V8 option → retry with fewer flags
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const seed = Number(args.seed ?? 7), nights = Number(args.nights ?? 10), out = args.out ?? 'soak.json';
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { process.stderr.write('usage: --seed <int> --nights <int> --out <file>\n'); process.exit(1); }

const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const T = contract.tuning;
const gc = typeof globalThis.gc === 'function' ? () => { globalThis.gc(); globalThis.gc(); } : () => {};
const rssMb = () => Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10;
const heapMb = () => Math.round((process.memoryUsage().heapUsed / 2 ** 20) * 10) / 10;

const t0 = process.hrtime.bigint();
const results = [], perNight = [];
let crashes = 0, memStart = null, heapStart = null;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1, s = seed + i;
  let game = null;
  try {
    game = new Game({ tuning: T, seed: s, night });
    if (i === 0) { gc(); memStart = rssMb(); heapStart = heapMb(); } // after the first night is loaded
    const rng = mulberry32((s * 2654435761) >>> 0);
    let move = [0, 0], bytes = 0;
    const limit = game.dawnTick + 60; // the night ends itself at dawn; this is only a safety stop
    for (let k = 0; game.state === 'playing' && k < limit; k++) {
      if (k % 30 === 0) { const a = rng() * 2 * Math.PI; move = [Math.cos(a), Math.sin(a)]; }
      const input = { move, cam_yaw_deg: 0, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1, pause: false };
      for (const ev of game.step(input)) bytes += JSON.stringify(ev).length;
      if (game.tick % 10 === 0) bytes += JSON.stringify(game.snapshot()).length;
    }
    results.push(game.state === 'playing' ? 'unfinished' : game.state);
    perNight.push({ night, seed: s, result: results.at(-1), reason: game.result, ticks: game.tick, score: game.score, output_bytes: bytes });
  } catch (e) {
    crashes += 1;
    results.push('crash');
    perNight.push({ night, seed: s, result: 'crash', error: String(e && e.stack || e).split('\n')[0] });
  }
  game = null; // reset before the next night
}
gc();
const memEnd = rssMb(); // after resetting the last night
const report = {
  contract_version: contract.contract_version,
  nights, crashes, results,
  mem_start_mb: memStart, mem_end_mb: memEnd,
  duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10,
  heap_used_start_mb: heapStart, heap_used_end_mb: heapMb(),
  seed, gc_exposed: typeof globalThis.gc === 'function', v8_flags: process.env.DDL_SOAK_CHILD || 'none',
  node: process.version, os: `${os.type()} ${os.release()} ${os.arch()}`,
  per_night: perNight,
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`soak: ${nights} nights, ${crashes} crashes, results ${results.join(',')}, mem ${memStart} → ${memEnd} MB (limit ${Math.round(memStart * 1.2 * 10) / 10}), ${report.duration_s} s → ${out}`);
process.exit(0);
