// Parsing/validation of contract input files. Any problem -> FormatError (headless exits 2).
import { FormatError } from './game.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash'];

export function parseInputs(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.frames)) throw new FormatError('inputs: "frames" must be an array');
  let last = -1;
  for (const [i, f] of obj.frames.entries()) {
    if (!f || typeof f !== 'object') throw new FormatError(`inputs: frame ${i} is not an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new FormatError(`inputs: frame ${i} has invalid tick`);
    if (f.tick <= last) throw new FormatError(`inputs: frame ${i} tick ${f.tick} is not strictly increasing`);
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every((v) => isNum(v) && v >= -1 && v <= 1))
        throw new FormatError(`inputs: frame ${i} move must be [x, z] with values in [-1, 1]`);
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) throw new FormatError(`inputs: frame ${i} cam_yaw_deg must be a number`);
    for (const b of BUTTONS) if (f[b] !== undefined && typeof f[b] !== 'boolean') throw new FormatError(`inputs: frame ${i} ${b} must be boolean`);
  }
  return obj.frames;
}

// Turns frames into a per-tick input source. Absent fields keep their previous value.
export function inputStream(frames) {
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  let i = 0;
  return (tick) => {
    while (i < frames.length && frames[i].tick <= tick) {
      const f = frames[i++];
      if (f.move !== undefined) cur.move = [...f.move];
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of BUTTONS) if (f[b] !== undefined) cur[b] = f[b];
    }
    return cur;
  };
}

export function parseScenario(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new FormatError('scenario: must be a JSON object');
  const { player, motes, shades, lanterns } = obj;
  if (player !== undefined) {
    if (!player || typeof player !== 'object') throw new FormatError('scenario: player must be an object');
    if (player.pos !== undefined && !isVec3(player.pos)) throw new FormatError('scenario: player.pos must be [x,y,z]');
    for (const k of ['carried', 'flames']) if (player[k] !== undefined && !(Number.isInteger(player[k]) && player[k] >= 0)) throw new FormatError(`scenario: player.${k} must be a non-negative integer`);
  }
  for (const k of ['random_motes', 'random_shades']) if (obj[k] !== undefined && typeof obj[k] !== 'boolean') throw new FormatError(`scenario: ${k} must be boolean`);
  if (motes !== undefined && !(Array.isArray(motes) && motes.every(isVec3))) throw new FormatError('scenario: motes must be an array of [x,y,z]');
  if (shades !== undefined) {
    if (!Array.isArray(shades)) throw new FormatError('scenario: shades must be an array');
    for (const s of shades) {
      if (!s || !isVec3(s.pos)) throw new FormatError('scenario: each shade needs pos [x,y,z]');
      if (s.id !== undefined && typeof s.id !== 'string') throw new FormatError('scenario: shade id must be a string');
    }
  }
  if (lanterns !== undefined) {
    if (!Array.isArray(lanterns)) throw new FormatError('scenario: lanterns must be an array');
    for (const l of lanterns) {
      if (!l || typeof l.id !== 'string') throw new FormatError('scenario: each lantern needs a string id');
      if (l.pos !== undefined && !isVec3(l.pos)) throw new FormatError('scenario: lantern pos must be [x,y,z]');
      if (l.deposited !== undefined && !(Number.isInteger(l.deposited) && l.deposited >= 0)) throw new FormatError('scenario: lantern deposited must be a non-negative integer');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') throw new FormatError('scenario: lantern lit must be boolean');
    }
  }
  if (obj.time_left_s !== undefined && !isNum(obj.time_left_s)) throw new FormatError('scenario: time_left_s must be a number');
  return obj;
}
