#!/usr/bin/env node
// Headless runner — Test Contract v1.3 (CLI and output format unchanged since v1.2).
// <headless_cmd> --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, FormatError } from './sim/game.js';
import { parseInputs, parseScenario, inputStream } from './sim/io.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(code, msg) {
  process.stderr.write(`headless: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(1, `unexpected argument ${k}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) fail(1, `missing value for ${k}`);
    a[k.slice(2)] = v;
    i++;
  }
  return a;
}

const int = (name, v, min) => {
  if (!/^-?\d+$/.test(String(v))) fail(1, `--${name} must be an integer`);
  const n = Number(v);
  if (n < min) fail(1, `--${name} must be >= ${min}`);
  return n;
};

function readJson(path, kind) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (e) { fail(2, `cannot read ${kind} file ${path}: ${e.message}`); }
  try { return JSON.parse(text); } catch (e) { fail(2, `${kind} file is not valid JSON: ${e.message}`); }
}

const args = parseArgs(process.argv.slice(2));
for (const req of ['seed', 'night', 'ticks', 'out']) if (args[req] === undefined) fail(1, `--${req} is required`);
const seed = int('seed', args.seed, -(2 ** 31));
const night = int('night', args.night, 1);
if (![1, 2, 3].includes(night)) fail(1, `night ${night} is not available (1, 2 or 3)`);
const N = int('ticks', args.ticks, 0);
const every = args['snapshot-every'] !== undefined ? int('snapshot-every', args['snapshot-every'], 1) : 10;

let contract;
try { contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')); } catch (e) { fail(1, `cannot load game.contract.json: ${e.message}`); }

let game, nextInput;
try {
  const scenario = args.scenario ? parseScenario(readJson(args.scenario, 'scenario')) : null;
  const frames = args.inputs ? parseInputs(readJson(args.inputs, 'inputs')) : [];
  nextInput = inputStream(frames);
  game = new Game({ tuning: contract.tuning, seed, scenario, night });
} catch (e) {
  if (e instanceof FormatError) fail(2, e.message);
  fail(1, e.stack || String(e));
}

const lines = [];
const out = (o) => lines.push(JSON.stringify(o));
out(game.snapshot());
for (let k = 0; k < N && game.state === 'playing'; k++) {
  for (const ev of game.step(nextInput(k))) out(ev);
  if (game.tick % every === 0) out(game.snapshot());
}
out({ type: 'end', ticks: game.tick, state: game.state, score: game.score });

try { writeFileSync(args.out, lines.join('\n') + '\n'); } catch (e) { fail(1, `cannot write ${args.out}: ${e.message}`); }
process.exit(0);
