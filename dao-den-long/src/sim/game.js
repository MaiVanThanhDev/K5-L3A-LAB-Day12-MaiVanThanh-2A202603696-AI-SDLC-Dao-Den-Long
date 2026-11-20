// Đảo Đèn Lồng — deterministic simulation core (no DOM, no Three.js).
// Shared by the headless runner (src/headless.js) and the 3D client (web/main.js).
// Rules & numbers: see docs/notes/assumptions.md. Tuning comes from game.contract.json.
import { mulberry32 } from './rng.js';

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
export const ISLAND_RADIUS = 40;      // player is clamped inside (fall_enabled = false)
export const LANTERN_RING_R = 25;     // default lanterns on a circle of this radius
const GRAVITY = 20;                   // m/s^2
const JUMP_SPEED = 7;                 // m/s
const SHADE_Y = 1.0;                  // spawned shades float with centre at 1 m
const MAX_MOTES = 30;                 // random motes kept on the island
const MOTE_RESPAWN_S = 3;             // one new mote every 3 s while below MAX_MOTES
const MOTE_MIN_R = 3, MOTE_MAX_R = 38;
const FIRST_SHADE_S = 5;              // first random shade after 5 s
const SHADE_INTERVAL_S = 20;          // then one every 20 s
const MAX_SHADES = 6;
const SHADE_SPAWN_R = 36;
const DROP_SCATTER_R = 2.5;           // dropped motes land on a ring around the player

const ticks = (s) => Math.round(s * TICK_HZ);
export const r3 = (x) => {
  const v = Math.round(x * 1000) / 1000;
  return v === 0 ? 0 : v; // avoid -0
};
const r3v = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function clampToIsland(pos, r = ISLAND_RADIUS) {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > r) { pos[0] *= r / d; pos[2] *= r / d; }
}

export function defaultLanterns(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    out.push({ id: `L${i + 1}`, pos: [r3(LANTERN_RING_R * Math.sin(a)), 0, r3(LANTERN_RING_R * Math.cos(a))], lit: false, deposited: 0 });
  }
  return out;
}

export class Game {
  constructor({ tuning, seed = 0, scenario = null }) {
    this.t = tuning;
    this.rng = mulberry32(seed);
    this.steps = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.timeLeft0 = tuning.night1_duration_s;
    this.player = { pos: [0, 0, 0], vy: 0, grounded: true, flames: tuning.flames, carried: 0, invuln: 0, pulseCd: 0 };
    this.lanterns = defaultLanterns(tuning.lantern_count_night1);
    this.motes = [];
    this.shades = [];
    this.moteSeq = 0;
    this.shadeSeq = 0;
    this.randomMotes = true;
    this.randomShades = true;
    this.moteTimer = ticks(MOTE_RESPAWN_S);
    this.shadeTimer = ticks(FIRST_SHADE_S);
    this.prev = { jump: false, interact: false, pulse: false, dash: false };
    this.events = [];      // events of the last step (consumed by the caller)
    this.lastPulse = null; // for rendering only

    const sc = scenario || {};
    if (sc.random_motes === false) this.randomMotes = false;
    if (sc.random_shades === false) this.randomShades = false;

    if (Array.isArray(sc.motes)) for (const p of sc.motes) this.addMote(p);
    else if (this.randomMotes) for (let i = 0; i < MAX_MOTES; i++) this.addMote(this.randomMotePos());

    if (Array.isArray(sc.shades)) {
      const used = new Set(sc.shades.filter((s) => s.id != null).map((s) => String(s.id)));
      this.usedShadeIds = used;
      for (const s of sc.shades) this.addShade([...s.pos], s.id != null ? String(s.id) : null);
    }
    if (sc.player) {
      if (sc.player.pos) this.player.pos = [...sc.player.pos];
      if (sc.player.carried != null) this.player.carried = sc.player.carried;
      if (sc.player.flames != null) this.player.flames = sc.player.flames;
      this.player.grounded = this.player.pos[1] <= 0;
    }
    if (Array.isArray(sc.lanterns)) {
      for (const l of sc.lanterns) {
        const L = this.lanterns.find((x) => x.id === l.id);
        if (!L) throw new FormatError(`scenario: unknown lantern id ${l.id}`);
        if (l.pos) L.pos = [...l.pos];
        if (l.deposited != null) L.deposited = l.deposited;
        if (l.lit != null) L.lit = !!l.lit;
      }
    }
    if (sc.time_left_s != null) this.timeLeft0 = sc.time_left_s;
    this.dawnStep = ticks(this.timeLeft0);
  }

  get timeLeft() { return this.timeLeft0 - this.steps / TICK_HZ; }

  randomMotePos() {
    const a = this.rng() * 2 * Math.PI;
    const r = Math.sqrt(MOTE_MIN_R ** 2 + this.rng() * (MOTE_MAX_R ** 2 - MOTE_MIN_R ** 2));
    return [r3(r * Math.sin(a)), 0, r3(r * Math.cos(a))];
  }

  addMote(pos) {
    this.moteSeq += 1;
    this.motes.push({ id: `M${this.moteSeq}`, pos: [...pos] });
  }

  newShadeId() {
    const used = this.usedShadeIds || new Set();
    let id;
    do { this.shadeSeq += 1; id = `S${this.shadeSeq}`; } while (used.has(id) || this.shades.some((s) => s.id === id));
    return id;
  }

  addShade(pos, id = null) {
    const s = { id: id ?? this.newShadeId(), pos, stun: 0 };
    this.shades.push(s);
    return s;
  }

  litLanterns() { return this.lanterns.filter((l) => l.lit); }

  // Shades cannot be within safe_radius of a LIT lantern: push them to the boundary.
  enforceSafe(s) {
    const R = this.t.safe_radius;
    if (!R) return;
    for (const L of this.lanterns) {
      if (!L.lit) continue;
      const dx = s.pos[0] - L.pos[0], dz = s.pos[2] - L.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < R) {
        let ux = dx, uz = dz, n = d;
        if (n < 1e-9) { ux = s.pos[0] - this.player.pos[0]; uz = s.pos[2] - this.player.pos[2]; n = Math.hypot(ux, uz); }
        if (n < 1e-9) { ux = 1; uz = 0; n = 1; }
        s.pos[0] = L.pos[0] + (ux / n) * R;
        s.pos[2] = L.pos[2] + (uz / n) * R;
      }
    }
  }

  emit(name, data) { this.events.push({ type: 'event', tick: this.steps + 1, name, data }); }

  // One fixed 1/60 s step. input = { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash }
  step(input) {
    this.events = [];
    this.lastPulse = null;
    if (this.state !== 'playing') return this.events;
    const t = this.t, p = this.player, sc = t.score;
    const pressed = (k) => !!input[k] && !this.prev[k];

    // 1. timers
    if (p.invuln > 0) p.invuln -= 1;
    if (p.pulseCd > 0) p.pulseCd -= 1;

    // 2. movement (camera-relative, contract formula)
    let [mx, mz] = input.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.pos[0] += wx * t.player_speed * DT;
    p.pos[2] += wz * t.player_speed * DT;
    clampToIsland(p.pos);

    // 3. jump + gravity
    if (pressed('jump') && p.grounded) { p.vy = JUMP_SPEED; p.grounded = false; }
    if (!p.grounded) {
      p.vy -= GRAVITY * DT;
      p.pos[1] += p.vy * DT;
      if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; p.grounded = true; }
    }

    // 4. pick up motes
    for (let i = 0; i < this.motes.length && p.carried < t.carry_capacity; ) {
      if (distXZ(p.pos, this.motes[i].pos) <= t.pickup_radius) {
        this.motes.splice(i, 1);
        p.carried += 1;
        this.score += sc.per_mote;
        this.emit('mote_picked', { carried: p.carried });
      } else i++;
    }

    // 5. interact: deposit into nearest unlit lantern in range
    if (pressed('interact') && p.carried > 0) {
      let best = null, bd = Infinity;
      for (const L of this.lanterns) {
        if (L.lit) continue;
        const d = distXZ(p.pos, L.pos);
        if (d <= t.interact_radius && d < bd) { best = L; bd = d; }
      }
      if (best) {
        const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= t.lantern_cost) {
            best.lit = true;
            this.score += sc.per_lantern;
            this.emit('lantern_lit', { lantern_id: best.id });
          }
        }
      }
    }

    // 6. pulse: costs light (carried motes), stuns + pushes shades in radius
    if (pressed('pulse') && p.pulseCd === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCd = ticks(t.pulse_cooldown_s);
      const ids = [];
      for (const s of this.shades) {
        const dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= t.pulse_radius) {
          s.stun = ticks(t.pulse_stun_s);
          const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
          s.pos[0] += ux * t.pulse_push_m;
          s.pos[2] += uz * t.pulse_push_m;
          clampToIsland(s.pos);
          this.enforceSafe(s);
          ids.push(s.id);
          this.score += sc.per_stun;
        }
      }
      this.lastPulse = { pos: [...p.pos] };
      this.emit('pulse', { stunned_ids: ids });
    }

    // 7. random shade spawns
    if (this.randomShades) {
      if (this.shadeTimer > 0) this.shadeTimer -= 1;
      if (this.shadeTimer === 0) {
        this.shadeTimer = ticks(SHADE_INTERVAL_S);
        if (this.shades.length < MAX_SHADES) {
          const a0 = this.rng() * 2 * Math.PI;
          let pos = null;
          for (let k = 0; k < 8 && !pos; k++) {
            const a = a0 + (k * Math.PI) / 4;
            const c = [SHADE_SPAWN_R * Math.sin(a), SHADE_Y, SHADE_SPAWN_R * Math.cos(a)];
            if (!this.litLanterns().some((L) => distXZ(c, L.pos) < t.safe_radius)) pos = c;
          }
          if (pos) {
            const s = this.addShade([r3(pos[0]), pos[1], r3(pos[2])]);
            this.emit('shade_spawned', { id: s.id });
          }
        }
      }
    }

    // 8. shades chase (or stay stunned)
    for (const s of this.shades) {
      if (s.stun > 0) { s.stun -= 1; continue; }
      const dx = p.pos[0] - s.pos[0], dz = p.pos[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      const stepLen = Math.min(d, t.shade_speed * DT);
      if (d > 1e-9) { s.pos[0] += (dx / d) * stepLen; s.pos[2] += (dz / d) * stepLen; }
      this.enforceSafe(s);
    }

    // 9. shade touches player
    if (p.invuln === 0) {
      const hitter = this.shades.find((s) => s.stun === 0 && distXZ(s.pos, p.pos) <= t.shade_hit_radius);
      if (hitter) {
        p.flames -= 1;
        const dropped = Math.floor(p.carried * t.hit_drop_ratio);
        p.carried -= dropped;
        const a0 = this.rng() * 2 * Math.PI;
        for (let i = 0; i < dropped; i++) {
          const a = a0 + (i * 2 * Math.PI) / dropped;
          const m = [p.pos[0] + DROP_SCATTER_R * Math.sin(a), 0, p.pos[2] + DROP_SCATTER_R * Math.cos(a)];
          clampToIsland(m);
          this.addMote([r3(m[0]), 0, r3(m[2])]);
        }
        p.invuln = ticks(t.invuln_s);
        this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      }
    }

    // 10. mote respawn
    if (this.randomMotes) {
      if (this.moteTimer > 0) this.moteTimer -= 1;
      if (this.moteTimer === 0) {
        this.moteTimer = ticks(MOTE_RESPAWN_S);
        if (this.motes.length < MAX_MOTES) this.addMote(this.randomMotePos());
      }
    }

    this.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash };
    this.steps += 1;

    // 11. end conditions
    if (this.lanterns.every((l) => l.lit)) {
      this.score += sc.per_second_left * Math.floor(Math.max(0, this.timeLeft) + 1e-9) + sc.per_flame_left * p.flames;
      this.finish('won', 'all_lit');
    } else if (p.flames <= 0) {
      this.finish('lost', 'no_flames');
    } else if (this.steps >= this.dawnStep) {
      this.finish('lost', 'dawn');
    }
    return this.events;
  }

  finish(result, reason) {
    this.state = result;
    this.result = reason;
    this.events.push({ type: 'event', tick: this.steps, name: 'game_over', data: { result, reason } });
  }

  snapshot() {
    return {
      type: 'snapshot',
      tick: this.steps,
      sim_tick: this.steps,
      state: this.state,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: this.score,
      player: { pos: r3v(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.stun > 0 ? 'stunned' : 'chase' })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: r3v(m.pos) })),
    };
  }
}

export class FormatError extends Error {}
