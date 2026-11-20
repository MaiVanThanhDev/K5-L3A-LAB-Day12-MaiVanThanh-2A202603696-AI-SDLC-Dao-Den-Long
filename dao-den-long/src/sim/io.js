// Parsing/validation of contract input files (Test Contract v1.1). Any problem -> FormatError (headless exits 2).
import { FormatError } from './game.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isNat = (v) => Number.isInteger(v) && v >= 0;
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export function parseInputs(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.frames)) throw new FormatError('inputs: "frames" must be an array');
  let last = -1;
  for (const [i, f] of obj.frames.entries()) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) throw new FormatError(`inputs: frame ${i} is not an object`);
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
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
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

const optNat = (o, k, where) => { if (o[k] !== undefined && !isNat(o[k])) throw new FormatError(`scenario: ${where}.${k} must be a non-negative integer`); };
const optBool = (o, k, where) => { if (o[k] !== undefined && typeof o[k] !== 'boolean') throw new FormatError(`scenario: ${where}${k} must be boolean`); };
const optId = (o, where) => { if (o.id !== undefined && typeof o.id !== 'string') throw new FormatError(`scenario: ${where} id must be a string`); };
const arr = (v, name) => { if (!Array.isArray(v)) throw new FormatError(`scenario: ${name} must be an array`); return v; };

export function parseScenario(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new FormatError('scenario: must be a JSON object');
  const { player, motes, shades, lanterns, drifters, charms } = obj;
  if (player !== undefined) {
    if (!player || typeof player !== 'object' || Array.isArray(player)) throw new FormatError('scenario: player must be an object');
    if (player.pos !== undefined && !isVec3(player.pos)) throw new FormatError('scenario: player.pos must be [x,y,z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) optNat(player, k, 'player');
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) optBool(obj, k, '');
  if (motes !== undefined) {
    for (const m of arr(motes, 'motes')) {
      if (isVec3(m)) continue;
      if (!m || typeof m !== 'object' || !isVec3(m.pos)) throw new FormatError('scenario: each mote must be [x,y,z] or {pos:[x,y,z]}');
      if (m.kind !== undefined && m.kind !== 'random' && m.kind !== 'dropped') throw new FormatError('scenario: mote kind must be random or dropped');
      optNat(m, 'ttl_ticks', 'mote');
      if (m.ttl_s !== undefined && !(isNum(m.ttl_s) && m.ttl_s > 0)) throw new FormatError('scenario: mote ttl_s must be a positive number');
    }
  }
  if (shades !== undefined) {
    for (const s of arr(shades, 'shades')) {
      if (!s || !isVec3(s.pos)) throw new FormatError('scenario: each shade needs pos [x,y,z]');
      optId(s, 'shade');
      if (s.state !== undefined && !SHADE_STATES.includes(s.state)) throw new FormatError(`scenario: shade state must be one of ${SHADE_STATES.join(', ')}`);
      optNat(s, 'state_ticks_left', 'shade');
    }
  }
  if (drifters !== undefined) {
    for (const d of arr(drifters, 'drifters')) {
      if (!d || !isVec3(d.pos)) throw new FormatError('scenario: each drifter needs pos [x,y,z]');
      optId(d, 'drifter');
      if (d.state !== undefined && !DRIFTER_STATES.includes(d.state)) throw new FormatError(`scenario: drifter state must be one of ${DRIFTER_STATES.join(', ')}`);
      optNat(d, 'stolen', 'drifter');
      optNat(d, 'state_ticks_left', 'drifter');
    }
  }
  if (charms !== undefined) {
    for (const c of arr(charms, 'charms')) {
      if (!c || !isVec3(c.pos)) throw new FormatError('scenario: each charm needs pos [x,y,z]');
      optId(c, 'charm');
      optBool(c, 'available', 'charm.');
      optNat(c, 'respawn_ticks', 'charm');
      if (c.respawn_s !== undefined && !(isNum(c.respawn_s) && c.respawn_s >= 0)) throw new FormatError('scenario: charm respawn_s must be a non-negative number');
    }
  }
  if (lanterns !== undefined) {
    for (const l of arr(lanterns, 'lanterns')) {
      if (!l || typeof l.id !== 'string') throw new FormatError('scenario: each lantern needs a string id');
      if (l.pos !== undefined && !isVec3(l.pos)) throw new FormatError('scenario: lantern pos must be [x,y,z]');
      optNat(l, 'deposited', 'lantern');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') throw new FormatError('scenario: lantern lit must be boolean');
    }
  }
  if (obj.time_left_s !== undefined && !(isNum(obj.time_left_s) && obj.time_left_s >= 0)) throw new FormatError('scenario: time_left_s must be a non-negative number');
  return obj;
}
