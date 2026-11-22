// Đảo Đèn Lồng — deterministic simulation core (no DOM, no Three.js), Test Contract v1.3.
// Shared by the headless runner (src/headless.js) and the 3D client (web/main.js).
// Numbers: game.contract.json (Ticket-02 standard values). Maps: ./maps.js. Assumptions: docs/notes/assumptions.md.
// The 12 phases of step() follow the mandatory per-tick order of Ticket-02 (+ Ticket-03: fuel in phase 2, lantern_out right after).
// Lantern fuel is kept in integer units of 1/60 (FU) — decay 1 FU/tick, drain 5 FU/tick — and only rounded on output.
// Extras (ADR 0002, off unless the client passes extras:true or a scenario sets "extras": true): the Diệt Bóng skill
// (button banish) and the boss Chúa Bóng Mực. With extras off nothing below reads them, so contract output is unchanged.
import { mulberry32 } from './rng.js';
import { NIGHTS, SHADE_HOVER, TOWER, padVelocity, r3 } from './maps.js';

export { r3, NIGHTS };
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
const STEP_UP = 0.35;          // max ledge the player can walk up (ramps rise 0.05 m/tick)
const STEP_DOWN = 0.35;        // grounded player snaps down to ground within this drop
const SHADE_CLIMB = 0.5;       // shades cannot climb a wall higher than this (they use ramps)
const PLAYER_RADIUS = 0.4;     // only used against client-side decorative obstacles
const EXPEL_STEP = Math.PI / 12; // safe-zone push: search the zone edge in 15° steps for open ground
const DRIFTER_HOVER = 1.5;
const SHADE_SPAWNING_TICKS = 30;
const WANDER_SPEED = 1.5, WANDER_TURN_TICKS = 120;

const ticks = (s) => Math.round(s * TICK_HZ);
const r3v = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => { const m = /(\d+)$/.exec(id); return m ? Number(m[1]) : 0; };
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause', 'banish'];
const BOSS_SKILLS = ['summon', 'eclipse'];
const FU = TICK_HZ; // fuel units per 1.0 fuel
const r1 = (x) => { const v = Math.round(x * 10) / 10; return v === 0 ? 0 : v; };

export class FormatError extends Error {}

export class Game {
  // bench = true (Ticket-04 benchmark scene only, never used by the headless contract): no spawns, damage, pickup,
  // fuel burn/drain or end of night; shades still move by the normal wander rules.
  // obstacles = [{x, z, r, h}] (client only: decorative rocks/trees). The headless contract never passes any,
  // so contract output is unchanged; the player is pushed out of them and can jump over ones lower than its feet.
  constructor({ tuning, seed = 0, scenario = null, night = 1, bench = false, obstacles = [], extras = false }) {
    const t = (this.t = tuning);
    const map = (this.map = NIGHTS[night]);
    if (!map) throw new FormatError(`night ${night} does not exist`);
    this.night = night;
    this.bench = !!bench;
    this.obstacles = obstacles;
    this.rng = mulberry32(seed);
    this.tick = 0;          // contract tick: every step, paused or not
    this.simTick = 0;       // gameplay steps actually simulated
    this.state = 'playing';
    this.paused = false;
    this.result = null;
    this.score = 0;
    this.timeLeft0 = t[map.durationKey];
    this.groundAt = map.groundAt;
    this.shadeSpeed = t[map.shadeSpeedKey] ?? t.shade_speed;

    const sc = scenario || {};
    this.randomMotes = sc.random_motes !== false;
    this.randomShades = sc.random_shades !== false;
    this.randomDrifters = map.drifters && sc.random_drifters !== false;
    this.windEnabled = map.wind && sc.wind_enabled !== false;
    this.extras = !this.bench && (!!extras || sc.extras === true);
    this.boss = null;
    this.bossTimed = this.extras && sc.random_boss !== false && !sc.boss;

    this.player = {
      pos: [...map.start], vel: [0, 0, 0], vy: 0, grounded: true, facing: [...map.facing],
      flames: t.flames, carried: 0, invuln: 0, pulseCd: 0, dashCd: 0, dashLeft: 0, dashDir: null,
      charm: 0, launch: null, fallWait: 0, successfulLights: 0, banishCd: 0,
    };
    this.fuelMax = t.fuel_max * FU;
    this.lowFuel = t.low_fuel_threshold * FU;
    this.lanterns = map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0, fuel: 0, everLit: false, relitCount: 0 }));
    this.motes = []; this.moteSeq = 0;
    this.shades = []; this.shadeSeq = 0;
    this.drifters = []; this.drifterSeq = 0;
    this.charms = map.charms.map((pos, i) => ({ id: `C${i + 1}`, pos: [...pos], available: true, respawn: 0 }));
    this.wind = { active: false, warn: false, dir: null };
    this.prev = Object.fromEntries(BUTTONS.map((b) => [b, false]));
    this.events = [];
    this.lastPulse = null; // rendering only

    // ---- scenario (building it emits no events and scores nothing) ----
    if (Array.isArray(sc.motes)) {
      for (const m of sc.motes) {
        if (Array.isArray(m)) this.addMote(m, 'random', null);
        else this.addMote(m.pos, m.kind === 'dropped' ? 'dropped' : 'random', null, m.kind === 'dropped' ? (m.ttl_ticks ?? (m.ttl_s != null ? ticks(m.ttl_s) : t.dropped_ttl_ticks)) : null);
      }
    } else if (this.randomMotes) {
      const idx = this.shuffle(map.motePoints.map((_, i) => i)).slice(0, Math.min(t.motes_start, map.motePoints.length));
      for (const i of idx) this.addMote(map.motePoints[i], 'random', i);
    }
    const reserve = (arr) => new Set((arr || []).filter((x) => x && x.id != null).map((x) => String(x.id)));
    this.usedShadeIds = reserve(sc.shades);
    this.usedDrifterIds = reserve(sc.drifters);
    if (Array.isArray(sc.shades)) {
      for (const s of sc.shades) {
        const sh = this.addShade([...s.pos], s.id != null ? String(s.id) : null, s.state || 'chase');
        if (s.target_lantern_id != null) sh.targetId = String(s.target_lantern_id);
        if (sh.state === 'drain') sh.drainId = sh.targetId;
        if (s.state_ticks_left != null) {
          if (sh.state === 'stunned') sh.stun = s.state_ticks_left;
          else if (sh.state === 'recoil') sh.recoilLeft = s.state_ticks_left;
          else if (sh.state === 'spawning') sh.spawnLeft = s.state_ticks_left;
        }
      }
    }
    if (Array.isArray(sc.drifters)) {
      for (const d of sc.drifters) {
        const dr = this.addDrifter([...d.pos], d.id != null ? String(d.id) : null, d.state || 'idle');
        dr.stolen = d.stolen ?? 0;
        if (d.state_ticks_left != null) dr.fleeLeft = d.state_ticks_left;
      }
    }
    if (Array.isArray(sc.charms)) {
      this.charms = sc.charms.map((c, i) => {
        const respawn = c.respawn_ticks ?? (c.respawn_s != null ? ticks(c.respawn_s) : 0);
        const available = c.available ?? respawn === 0;
        return { id: c.id != null ? String(c.id) : `C${i + 1}`, pos: [...c.pos], available, respawn: available ? 0 : respawn || t.charm_respawn_ticks };
      });
    }
    if (sc.player) {
      const p = this.player, sp = sc.player;
      if (sp.pos) p.pos = [...sp.pos];
      if (sp.carried != null) p.carried = sp.carried;
      if (sp.flames != null) p.flames = sp.flames;
      if (sp.invuln_ticks != null) p.invuln = sp.invuln_ticks;
      if (sp.dash_cd_ticks != null) p.dashCd = sp.dash_cd_ticks;
      if (sp.pulse_cd_ticks != null) p.pulseCd = sp.pulse_cd_ticks;
      if (sp.charm_ticks != null) p.charm = sp.charm_ticks;
      if (sp.successful_lights != null) p.successfulLights = sp.successful_lights;
      if (sp.banish_cd_ticks != null) p.banishCd = sp.banish_cd_ticks;
      const g = this.groundAt(p.pos[0], p.pos[2]);
      p.grounded = g !== null && g !== TOWER && Math.abs(p.pos[1] - g) < 1e-6;
    }
    if (Array.isArray(sc.lanterns)) {
      for (const l of sc.lanterns) {
        const L = this.lanterns.find((x) => x.id === l.id);
        if (!L) throw new FormatError(`scenario: unknown lantern id ${l.id} for night ${night}`);
        if (l.pos) L.pos = [...l.pos];
        if (l.deposited != null) L.deposited = l.deposited;
        if (l.lit != null) L.lit = !!l.lit;
        if (l.ever_lit != null) L.everLit = !!l.ever_lit;
        else if (L.lit) L.everLit = true;
        if (l.fuel != null) L.fuel = Math.round(l.fuel * FU);
        else if (L.lit) L.fuel = this.fuelMax;
        L.fuel = Math.max(0, Math.min(this.fuelMax, L.fuel));
        if (!L.lit) L.fuel = 0;
        if (L.lit && L.deposited === 0) L.deposited = t.lantern_cost;
      }
    }
    for (const s of this.shades) if (s.targetId && !this.lanterns.some((L) => L.id === s.targetId)) throw new FormatError(`scenario: unknown target_lantern_id ${s.targetId}`);
    if (this.extras && sc.boss) {
      const b = sc.boss, B = this.addBoss([...b.pos], b.state || 'chase');
      if (b.hp != null) { B.hp = b.hp; B.hpMax = Math.max(B.hpMax, b.hp); }
      if (b.state_ticks_left != null) {
        if (B.state === 'spawning') B.spawnLeft = b.state_ticks_left;
        else if (B.state === 'stunned') B.stun = b.state_ticks_left;
        else if (B.state === 'recoil') B.recoilLeft = b.state_ticks_left;
        else if (B.state === 'cast') B.castLeft = b.state_ticks_left;
      }
      if (b.skill_ticks_left != null) B.skillLeft = b.skill_ticks_left;
      if (b.next_skill != null) B.nextSkill = b.next_skill;
      if (B.state === 'cast') B.castSkill = B.nextSkill;
    }
    if (sc.time_left_s != null) this.timeLeft0 = sc.time_left_s;
    this.dawnTick = ticks(this.timeLeft0);
  }

  get timeLeft() { return this.timeLeft0 - this.simTick / TICK_HZ; }
  get capacity() { return Math.min(this.t.capacity_max, this.t.carry_capacity + this.t.capacity_per_light * this.player.successfulLights); }
  get winNeed() { return Math.ceil(this.t.win_ratio * this.lanterns.length - 1e-9); }
  // A lit lantern keeps its safe zone only while fuel >= 30 (exactly 30 still counts).
  hasZone(L) { return L.lit && L.fuel >= this.lowFuel; }
  get displayState() { return this.state === 'playing' && this.paused ? 'paused' : this.state; }

  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  addMote(pos, kind, point, ttl = null) {
    this.moteSeq += 1;
    const m = { id: `M${this.moteSeq}`, pos: [...pos], kind, point, ttl, from: this.simTick + 1 };
    if (this.simTick === 0 && this.tick === 0) m.from = 0;
    this.motes.push(m);
    return m;
  }

  nextId(prefix, field, used, list) {
    let id;
    do { this[field] += 1; id = `${prefix}${this[field]}`; } while (used.has(id) || list.some((x) => x.id === id));
    return id;
  }

  addShade(pos, id = null, state = 'chase') {
    const s = { id: id ?? this.nextId('S', 'shadeSeq', this.usedShadeIds, this.shades), pos, state, stun: 0, spawnLeft: 0, recoilLeft: 0, pushLeft: 0, pushDir: null, expel: null, heading: null, turn: 0, targetId: null, drainId: null, drainTicks: 0 };
    if (state === 'spawning') s.spawnLeft = SHADE_SPAWNING_TICKS;
    if (state === 'stunned') s.stun = ticks(this.t.pulse_stun_s);
    if (state === 'recoil') s.recoilLeft = this.t.shade_recoil_ticks;
    this.shades.push(s);
    return s;
  }

  // Boss (extras): HP = boss_hp_base + night. States: spawning → chase ⇄ cast (telegraphed skill), stunned, recoil, defeated.
  addBoss(pos, state = 'spawning') {
    const t = this.t, hp = t.boss_hp_base + this.night;
    const b = { id: 'B1', pos, hp, hpMax: hp, state, spawnLeft: 0, stun: 0, recoilLeft: 0, castLeft: 0, castSkill: null,
      skillLeft: ticks(t.boss_skill_every_s), nextSkill: BOSS_SKILLS[0] };
    if (state === 'spawning') b.spawnLeft = t.boss_spawn_ticks;
    if (state === 'stunned') b.stun = ticks(t.boss_stun_s);
    if (state === 'recoil') b.recoilLeft = t.boss_recoil_ticks;
    if (state === 'cast') b.castLeft = t.boss_cast_ticks;
    this.boss = b;
    return b;
  }

  addDrifter(pos, id = null, state = 'idle') {
    const d = { id: id ?? this.nextId('D', 'drifterSeq', this.usedDrifterIds, this.drifters), pos, state, stolen: 0, fleeLeft: 0, heading: null, turn: 0 };
    if (state === 'flee') d.fleeLeft = this.t.drifter_flee_ticks;
    this.drifters.push(d);
    return d;
  }

  emit(name, data) { this.events.push({ type: 'event', tick: this.tick + 1, name, data }); }

  // Ground under (x,z): number, null (sea of clouds) or TOWER (solid).
  ground(x, z) { return this.groundAt(x, z); }

  playerCanEnter(x, z, y) {
    const h = this.ground(x, z);
    if (h === TOWER) return false;
    return h === null || h <= y + STEP_UP;
  }

  // Shades float over ground, cannot leave the island, climb walls or enter the tower; blocked at lit safe zones.
  shadeCanEnter(s, x, z) {
    const h = this.ground(x, z);
    if (h === null || h === TOWER) return false;
    const cur = this.ground(s.pos[0], s.pos[2]);
    if (cur !== null && cur !== TOWER && h > cur + SHADE_CLIMB) return false;
    return true;
  }

  insideSafe(x, z) {
    const R = this.t.safe_radius;
    return this.lanterns.some((L) => this.hasZone(L) && Math.hypot(x - L.pos[0], z - L.pos[2]) < R - 1e-9);
  }

  // Move a shade by (dx,dz) with wall sliding. Returns true if (partly) blocked.
  moveShade(s, dx, dz, slide = true) {
    const tries = slide ? [[dx, dz], [dx, 0], [0, dz]] : [[dx, dz]];
    for (const [ox, oz] of tries) {
      if (ox === 0 && oz === 0) continue;
      const nx = s.pos[0] + ox, nz = s.pos[2] + oz;
      if (!this.shadeCanEnter(s, nx, nz)) continue;
      const wasOutside = !this.insideSafe(s.pos[0], s.pos[2]);
      if (wasOutside && this.insideSafe(nx, nz)) {
        // blocked at the 6 m edge: project onto the boundary of the lantern zone it would enter
        const p = this.projectOutOfSafe([nx, s.pos[1], nz]);
        if (!this.shadeCanEnter(s, p[0], p[2]) || this.insideSafe(p[0], p[2])) continue;
        s.pos[0] = p[0]; s.pos[2] = p[2];
      } else { s.pos[0] = nx; s.pos[2] = nz; }
      s.pos[1] = this.ground(s.pos[0], s.pos[2]) + SHADE_HOVER;
      return !(ox === dx && oz === dz);
    }
    return true;
  }

  projectOutOfSafe(pos) {
    const R = this.t.safe_radius;
    const out = [...pos];
    for (let iter = 0; iter < 3; iter++) {
      for (const L of this.lanterns) {
        if (!this.hasZone(L)) continue;
        let ux = out[0] - L.pos[0], uz = out[2] - L.pos[2];
        const d = Math.hypot(ux, uz);
        if (d >= R - 1e-9) continue;
        if (d < 1e-9) { ux = 1; uz = 0; } else { ux /= d; uz /= d; }
        out[0] = L.pos[0] + ux * R; out[2] = L.pos[2] + uz * R;
      }
    }
    return out;
  }

  // One fixed 1/60 s step. input = { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash, pause }
  step(input) {
    this.events = [];
    this.lastPulse = null;
    this.lastBanish = null;
    if (this.state !== 'playing') return this.events;
    const pressed = (k) => !!input[k] && !this.prev[k];
    const end = () => {
      for (const b of BUTTONS) this.prev[b] = !!input[b];
      this.tick += 1;
      return this.events;
    };

    // 1. input: pause first; a tick that just paused stops here; paused ticks freeze gameplay
    if (pressed('pause')) {
      this.paused = !this.paused;
      this.emit(this.paused ? 'paused' : 'resumed', {});
      if (this.paused) return end();
    }
    if (this.paused) return end();

    const t = this.t, p = this.player, sc = t.score, map = this.map;
    this.simTick += 1;
    const st = this.simTick;

    // 2. timers: time (simTick), cooldowns, invulnerability, stun, charm, dropped-mote TTL, charm respawn, wind
    if (p.pulseCd > 0) p.pulseCd -= 1;
    if (p.dashCd > 0) p.dashCd -= 1;
    if (p.invuln > 0) p.invuln -= 1;
    for (const s of this.shades) {
      if (s.state === 'stunned' && --s.stun <= 0) { s.stun = 0; s.state = 'wander'; s.pushLeft = 0; }
      if (s.state === 'spawning' && --s.spawnLeft <= 0) { s.spawnLeft = 0; s.state = 'wander'; }
    }
    if (p.charm > 0) p.charm -= 1;
    const B = this.boss && this.boss.state !== 'defeated' ? this.boss : null;
    if (this.extras) {
      if (p.banishCd > 0) p.banishCd -= 1;
      if (B) {
        if (B.state === 'spawning' && --B.spawnLeft <= 0) { B.spawnLeft = 0; B.state = 'chase'; }
        if (B.state === 'stunned' && --B.stun <= 0) { B.stun = 0; B.state = 'chase'; }
        if ((B.state === 'chase' || B.state === 'recoil') && B.skillLeft > 0) B.skillLeft -= 1;
        if (B.state === 'chase' && B.skillLeft === 0) { // telegraph: stands still for boss_cast_ticks, then the skill fires
          B.state = 'cast'; B.castSkill = B.nextSkill; B.castLeft = t.boss_cast_ticks;
          this.emit('boss_cast', { boss_id: B.id, skill: B.castSkill, cast_s: r3(B.castLeft / TICK_HZ) });
        }
      }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.kind === 'dropped' && --m.ttl <= 0) this.motes.splice(i, 1);
    }
    for (const c of this.charms) if (!c.available && --c.respawn <= 0) { c.respawn = 0; c.available = true; }
    // fuel: lit lanterns burn 1 FU/tick; each draining shade (state at the start of the tick) sucks 5 FU/tick
    const decay = Math.round((t.fuel_decay_per_s * FU) / TICK_HZ), drain = Math.round((t.drain_per_s * FU) / TICK_HZ);
    if (!this.bench) for (const L of this.lanterns) if (L.lit) L.fuel -= decay;
    if (!this.bench) for (const s of [...this.shades].sort(byId)) {
      if (s.state !== 'drain') continue;
      const L = this.lanterns.find((l) => l.id === s.drainId);
      if (!L || !L.lit) continue;
      L.fuel -= drain;
      if (++s.drainTicks % t.fuel_drain_event_ticks === 0) this.emit('fuel_drain', { lantern_id: L.id, shade_id: s.id, fuel: r1(Math.max(0, L.fuel) / FU) });
    }
    // right after phase 2: a lantern with fuel <= 0 goes out (remembers ever_lit)
    for (const L of this.lanterns) {
      if (L.lit && L.fuel <= 0) { L.lit = false; L.fuel = 0; L.deposited = 0; this.emit('lantern_out', { lantern_id: L.id }); }
    }
    if (this.windEnabled) {
      const every = ticks(t.wind_every_s), ph = st % every;
      if (ph === every - ticks(t.wind_warn_s)) this.wind.dir = Math.floor(this.rng() * 360);
      this.wind.warn = st >= every - ticks(t.wind_warn_s) && ph >= every - ticks(t.wind_warn_s);
      this.wind.active = st >= every && ph < ticks(t.wind_duration_s);
      if (!this.wind.active && !this.wind.warn) this.wind.dir = null;
    }

    // 3. move the player (jump, dash, launch pad, wind), then check falling off the island
    const before = [...p.pos];
    const alive = p.fallWait === 0;
    if (!alive) {
      if (--p.fallWait === 0) {
        p.pos = [...map.start]; p.vy = 0; p.grounded = true; p.launch = null; p.dashLeft = 0;
        p.facing = [...map.facing];
        p.invuln = ticks(t.invuln_s);
      }
    } else {
      let [mx, mz] = input.move || [0, 0];
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
      const wx = mx * Math.cos(th) + mz * Math.sin(th);
      const wz = -mx * Math.sin(th) + mz * Math.cos(th);
      const wl = Math.hypot(wx, wz);
      if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

      if (pressed('dash') && p.dashLeft === 0 && (p.dashCd === 0 || p.charm > 0)) {
        p.dashDir = [...p.facing];
        p.dashLeft = ticks(t.dash_duration_s);
        p.dashCd = p.charm > 0 ? 0 : ticks(t.dash_cooldown_s);
        this.emit('dash', {});
      }
      const dashing = p.dashLeft > 0;
      let hx, hz;
      if (dashing) { hx = p.dashDir[0] * t.dash_speed; hz = p.dashDir[1] * t.dash_speed; p.dashLeft -= 1; }
      else if (p.launch) { [hx, hz] = p.launch; }
      else { const v = p.charm > 0 ? t.charm_speed : t.player_speed; hx = wx * v; hz = wz * v; }
      if (this.wind.active) {
        const a = (this.wind.dir * Math.PI) / 180;
        hx += Math.cos(a) * t.wind_speed; hz += Math.sin(a) * t.wind_speed;
      }
      if (pressed('jump') && p.grounded && !dashing) { p.vy = t.jump_speed; p.grounded = false; }

      // horizontal, sliding along walls
      const dx = hx * DT, dz = hz * DT;
      for (const [ox, oz] of [[dx, dz], [dx, 0], [0, dz]]) {
        if (ox === 0 && oz === 0) continue;
        if (this.playerCanEnter(p.pos[0] + ox, p.pos[2] + oz, p.pos[1])) { p.pos[0] += ox; p.pos[2] += oz; break; }
      }
      this.pushOutOfObstacles(p.pos);
      // vertical
      const h = this.ground(p.pos[0], p.pos[2]);
      if (p.grounded) {
        if (h !== null && h >= p.pos[1] - STEP_DOWN) p.pos[1] = h;
        else p.grounded = false; // walked/dashed off an edge
      }
      if (!p.grounded && !dashing) {
        p.vy -= t.gravity * DT;
        p.pos[1] += p.vy * DT;
      }
      if (!p.grounded && h !== null && p.pos[1] <= h) {
        if (p.vy <= 0 || dashing) { p.pos[1] = h; p.vy = 0; p.grounded = true; p.launch = null; }
        else p.pos[1] = h;
      }
      if (p.grounded) {
        for (const pad of map.pads) {
          if (distXZ(p.pos, pad.pos) <= pad.r && Math.abs(p.pos[1] - pad.pos[1]) < 1e-6) {
            p.vy = pad.vy; p.launch = padVelocity(pad); p.grounded = false; break;
          }
        }
      }
      if (t.fall_enabled && p.pos[1] < t.fall_y) {
        p.flames -= 1;
        const lost = p.carried;
        p.carried = 0;
        p.fallWait = t.respawn_wait_ticks;
        p.vy = 0; p.launch = null; p.dashLeft = 0;
        this.emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
      }
    }
    p.vel = p.pos.map((v, i) => (v - before[i]) / DT);
    if (p.fallWait > 0 || !alive) p.vel = [0, 0, 0];
    const active = p.fallWait === 0; // can pick up, interact, pulse, be touched

    // 4. pick up motes and charms
    if (active && !this.bench) {
      for (let i = 0; i < this.motes.length && p.carried < this.capacity; ) {
        const m = this.motes[i];
        if (m.from <= st && distXZ(p.pos, m.pos) <= t.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= t.pickup_height) {
          this.motes.splice(i, 1);
          p.carried += 1;
          this.emit('mote_picked', { carried: p.carried });
        } else i++;
      }
      for (const c of this.charms) {
        if (c.available && distXZ(p.pos, c.pos) <= t.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= t.pickup_height) {
          c.available = false;
          c.respawn = t.charm_respawn_ticks;
          p.charm = t.charm_ticks;
          this.emit('charm_picked', { charm_id: c.id, charm_ticks: p.charm });
        }
      }
    }

    // 5. lanterns: nearest lantern that can take light (unlit, or lit and not full; tie -> smaller id).
    //    Unlit: deposit toward 10 (first light) or 5 (relight). Lit: refuel used = min(carried, ceil(missing / 10)).
    const newlyLit = [];
    if (active && pressed('interact') && p.carried > 0) {
      let best = null, bd = Infinity;
      for (const L of [...this.lanterns].sort(byId)) {
        if (L.lit && L.fuel >= this.fuelMax) continue;
        const d = distXZ(p.pos, L.pos);
        if (d <= t.interact_radius && d < bd) { best = L; bd = d; }
      }
      if (best && !best.lit) {
        const cost = best.everLit ? t.relight_cost : t.lantern_cost;
        const amount = Math.min(p.carried, cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.score += sc.per_mote * amount;
          this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= cost) {
            const relight = best.everLit;
            best.lit = true; best.everLit = true; best.fuel = this.fuelMax;
            if (relight) { best.relitCount += 1; this.score += sc.per_relight; } else this.score += sc.per_lantern;
            p.successfulLights += 1;
            newlyLit.push(best);
            this.emit('lantern_lit', { lantern_id: best.id, relight });
          }
        }
      } else if (best) {
        const per = t.fuel_per_mote * FU;
        const used = Math.min(p.carried, Math.ceil((this.fuelMax - best.fuel) / per));
        if (used > 0) {
          best.fuel = Math.min(this.fuelMax, best.fuel + per * used);
          p.carried -= used;
          this.score += sc.per_mote * used;
          this.emit('refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuel / FU) });
          if (best.fuel >= this.lowFuel) newlyLit.push(best); // zone is back: shades inside are expelled as on lighting
        }
      }
    }

    // 6. safe zones: shades inside a just-lit zone are expelled to the edge within 30 ticks (harmless meanwhile)
    //    The edge point is fixed when the push starts (expelTarget): never over the sea of clouds or inside the tower.
    const R = t.safe_radius;
    const movers = B ? [...this.shades, B] : this.shades; // extras: the boss is pushed out like a shade
    for (const L of newlyLit) {
      for (const s of movers) if (distXZ(s.pos, L.pos) < R) s.expel = { to: this.expelTarget(s, L.pos), left: t.safe_expel_ticks };
    }
    // a shade found inside a lit zone any other way (e.g. placed there by a scenario) is expelled the same way
    for (const s of movers) {
      if (s.expel) continue;
      const L = this.lanterns.find((l) => this.hasZone(l) && distXZ(s.pos, l.pos) < R - 1e-9);
      if (L) s.expel = { to: this.expelTarget(s, L.pos), left: t.safe_expel_ticks };
    }
    for (const s of movers) if (s.expel && s.state === 'drain') { s.state = 'wander'; s.drainId = null; }
    for (const s of movers) {
      if (!s.expel) continue;
      const e = s.expel, k = 1 / e.left; // straight line, arrives exactly on the last push tick
      s.pos[0] += (e.to[0] - s.pos[0]) * k; s.pos[2] += (e.to[1] - s.pos[2]) * k;
      const g = this.ground(s.pos[0], s.pos[2]);
      if (g !== null && g !== TOWER) s.pos[1] = g + SHADE_HOVER; // follow the terrain (tiers on Night 3)
      if (--e.left <= 0) s.expel = null;
    }

    // 7. pulse (Tỏa Sáng): targets locked this tick, 3D distance from foot + 0.8 m to shade centre
    if (active && pressed('pulse') && p.pulseCd === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCd = ticks(t.pulse_cooldown_s);
      const c = [p.pos[0], p.pos[1] + t.pulse_center_height, p.pos[2]];
      const ids = [];
      for (const s of this.shades) {
        if (dist3(c, s.pos) > t.pulse_radius) continue;
        const wasDraining = s.state === 'drain';
        s.state = 'stunned'; s.drainId = null;
        s.stun = ticks(t.pulse_stun_s);
        s.recoilLeft = 0; s.spawnLeft = 0;
        s.pushLeft = t.pulse_push_ticks;
        const dx = s.pos[0] - c[0], dz = s.pos[2] - c[2], d = Math.hypot(dx, dz);
        s.pushDir = d > 1e-9 ? [dx / d, dz / d] : [1, 0];
        ids.push(s.id);
        this.score += wasDraining ? sc.per_stun_drain : sc.per_stun;
      }
      this.lastPulse = { pos: [...p.pos] };
      this.emit('pulse', { stunned_ids: ids });
      if (B && B.state !== 'spawning' && dist3(c, B.pos) <= t.pulse_radius) {
        const interrupted = B.state === 'cast';
        if (interrupted) { B.skillLeft = ticks(t.boss_skill_every_s); B.castLeft = 0; } // the skill is lost; next one a full cycle later
        B.state = 'stunned'; B.stun = ticks(t.boss_stun_s); B.recoilLeft = 0;
        this.score += sc.per_stun;
        this.emit('boss_stunned', { boss_id: B.id, interrupted, skill: interrupted ? B.castSkill : null });
        if (interrupted) B.castSkill = null;
      }
      for (const d of this.drifters) {
        if (d.state === 'removed' || dist3(c, d.pos) > t.pulse_radius) continue;
        if (d.state === 'chase') { d.state = 'flee'; d.fleeLeft = t.drifter_flee_ticks; }
        else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen;
          for (let i = 0; i < amount; i++) {
            const a = this.rng() * 2 * Math.PI, rr = 0.3 + this.rng() * 0.7;
            const x = d.pos[0] + rr * Math.cos(a), z = d.pos[2] + rr * Math.sin(a), g = this.ground(x, z);
            if (g !== null && g !== TOWER) this.addMote([r3(x), g, r3(z)], 'dropped', null, t.dropped_ttl_ticks);
          }
          d.stolen = 0;
          d.fleeLeft = t.drifter_vanish_ticks;
          this.emit('drifter_drop', { drifter_id: d.id, amount });
        }
      }
    }

    // 7b. Diệt Bóng (extras): destroys every STUNNED shade within banish_radius (same centre as the pulse);
    //     a stunned boss within boss_reach_m loses 1 HP (0 → defeated). Costs banish_cost motes even with no target.
    if (this.extras && active && pressed('banish') && p.banishCd === 0 && p.carried >= t.banish_cost) {
      const es = t.extras_score;
      p.carried -= t.banish_cost;
      p.banishCd = ticks(t.banish_cooldown_s);
      const c = [p.pos[0], p.pos[1] + t.pulse_center_height, p.pos[2]];
      const ids = [];
      for (let i = this.shades.length - 1; i >= 0; i--) {
        const s = this.shades[i];
        if (s.state !== 'stunned' || s.expel || dist3(c, s.pos) > t.banish_radius) continue;
        ids.unshift(s.id);
        this.shades.splice(i, 1);
      }
      this.score += es.per_banish * ids.length;
      let bossHit = false;
      if (B && B.state === 'stunned' && dist3(c, B.pos) <= t.boss_reach_m) {
        bossHit = true;
        B.hp -= 1;
        this.score += es.per_boss_hit;
        if (B.hp <= 0) {
          B.hp = 0; B.state = 'defeated'; B.stun = 0;
          this.score += es.per_boss_defeat;
        } else { B.state = 'recoil'; B.stun = 0; B.recoilLeft = t.boss_recoil_ticks; }
      }
      this.lastBanish = { pos: [...p.pos] };
      this.emit('banish', { banished_ids: ids, boss_hit: bossHit });
      if (bossHit) this.emit(B.state === 'defeated' ? 'boss_defeated' : 'boss_hit', { boss_id: B.id, hp: B.hp });
    }

    // 8. move shades and drifters
    const targetable = active;
    for (const s of this.shades) {
      if (s.expel || s.state === 'spawning') continue;
      if (s.state === 'stunned') {
        if (s.pushLeft > 0) {
          const k = t.pulse_push_m / t.pulse_push_ticks;
          if (this.moveShade(s, s.pushDir[0] * k, s.pushDir[1] * k, false)) s.pushLeft = 0; else s.pushLeft -= 1;
        }
        continue;
      }
      if (s.state === 'recoil') {
        let ux = s.pos[0] - p.pos[0], uz = s.pos[2] - p.pos[2];
        const n = Math.hypot(ux, uz);
        if (n < 1e-9) { ux = 1; uz = 0; } else { ux /= n; uz /= n; }
        const k = t.shade_recoil_m / t.shade_recoil_ticks;
        this.moveShade(s, ux * k, uz * k);
        if (--s.recoilLeft <= 0) { s.recoilLeft = 0; s.state = 'wander'; }
        continue;
      }
      const d = distXZ(s.pos, p.pos);
      if (s.state === 'drain') {
        const L = this.lanterns.find((l) => l.id === s.drainId);
        if (targetable && d <= t.drain_break_m) { s.state = 'chase'; s.drainId = null; }
        else if (!L || !L.lit || L.fuel >= this.lowFuel || distXZ(s.pos, L.pos) > t.drain_range_m) { s.state = 'wander'; s.drainId = null; }
        else continue; // stands still while draining
      }
      if (s.state === 'wander' && targetable && !this.bench && d <= t.shade_detect_m) s.state = 'chase'; // bench: shades keep wandering
      else if (s.state === 'chase' && (!targetable || d > t.shade_lose_m)) s.state = 'wander';
      const goal = s.state === 'wander' ? this.wanderTarget(s) : null;
      if (s.state === 'chase') {
        if (d > 1e-9) { const k = Math.min(d, this.shadeSpeed * DT) / d; this.moveShade(s, (p.pos[0] - s.pos[0]) * k, (p.pos[2] - s.pos[2]) * k); }
      } else if (goal) {
        // wander: head for the nearest weak lit lantern (fuel < 30), else the nearest unlit one; drain when within 2 m
        const gd = distXZ(s.pos, goal.pos);
        if (goal.lit && gd <= t.drain_range_m) { s.state = 'drain'; s.drainId = goal.id; s.drainTicks = 0; continue; }
        if (gd > t.drain_range_m * 0.5) { const k = Math.min(gd - t.drain_range_m * 0.5, this.shadeSpeed * DT) / gd; this.moveShade(s, (goal.pos[0] - s.pos[0]) * k, (goal.pos[2] - s.pos[2]) * k); }
        if (goal.lit && distXZ(s.pos, goal.pos) <= t.drain_range_m) { s.state = 'drain'; s.drainId = goal.id; s.drainTicks = 0; }
      } else {
        if (s.turn <= 0 || !s.heading) { const a = this.rng() * 2 * Math.PI; s.heading = [Math.cos(a), Math.sin(a)]; s.turn = WANDER_TURN_TICKS; }
        s.turn -= 1;
        if (this.moveShade(s, s.heading[0] * WANDER_SPEED * DT, s.heading[1] * WANDER_SPEED * DT, false)) s.turn = 0;
      }
    }
    if (B && B.state !== 'defeated') this.moveBoss(B, targetable);
    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      const dist = distXZ(d.pos, p.pos);
      const wants = targetable && p.carried >= t.drifter_min_carry && dist <= t.drifter_detect_m;
      if (d.state === 'idle' && wants) d.state = 'chase';
      else if (d.state === 'chase' && !wants) d.state = 'idle';
      let vx = 0, vz = 0;
      if (d.state === 'chase' && dist > 1e-9) {
        const k = Math.min(dist, t.drifter_speed * DT) / dist;
        vx = (p.pos[0] - d.pos[0]) * k; vz = (p.pos[2] - d.pos[2]) * k;
      } else if (d.state === 'flee') {
        let ux = d.pos[0] - p.pos[0], uz = d.pos[2] - p.pos[2];
        const n = Math.hypot(ux, uz);
        if (n < 1e-9) { ux = 1; uz = 0; } else { ux /= n; uz /= n; }
        vx = ux * t.drifter_speed * DT; vz = uz * t.drifter_speed * DT;
        if (--d.fleeLeft <= 0) { d.fleeLeft = 0; d.state = 'removed'; }
      } else if (d.state === 'idle') {
        const off = Math.hypot(d.pos[0] - map.center[0], d.pos[2] - map.center[1]);
        if (d.turn <= 0 || !d.heading || off > map.boundR) {
          let a = this.rng() * 2 * Math.PI;
          if (off > map.boundR) a = Math.atan2(map.center[1] - d.pos[2], map.center[0] - d.pos[0]);
          d.heading = [Math.cos(a), Math.sin(a)]; d.turn = WANDER_TURN_TICKS;
        }
        d.turn -= 1;
        vx = d.heading[0] * t.drifter_idle_speed * DT; vz = d.heading[1] * t.drifter_idle_speed * DT;
      }
      d.pos[0] += vx; d.pos[2] += vz;
      const g = this.ground(d.pos[0], d.pos[2]);
      d.pos[1] = (g === null ? 0 : g === TOWER ? map.tower.h : g) + DRIFTER_HOVER;
    }

    // 9. touches: drifters steal first, then at most one shade hit (ids ascending)
    if (active && !this.bench) {
      for (const d of [...this.drifters].sort(byId)) {
        if (d.state !== 'chase' || distXZ(d.pos, p.pos) > t.drifter_touch_m) continue;
        const amount = Math.min(t.drifter_steal, p.carried);
        if (amount <= 0) continue;
        p.carried -= amount;
        d.stolen = amount;
        d.state = 'flee';
        d.fleeLeft = t.drifter_flee_ticks;
        this.emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
      if (p.invuln === 0) {
        for (const s of [...this.shades].sort(byId)) {
          if ((s.state !== 'wander' && s.state !== 'chase') || s.expel) continue;
          if (distXZ(s.pos, p.pos) > t.shade_hit_radius) continue;
          if (Math.abs(p.pos[1] - (s.pos[1] - SHADE_HOVER)) > t.shade_hit_height) continue;
          p.flames -= 1;
          const dropped = Math.floor(p.carried * t.hit_drop_ratio);
          p.carried -= dropped;
          for (let i = 0; i < dropped; i++) this.dropMoteNear(p.pos);
          p.invuln = ticks(t.invuln_s);
          s.state = 'recoil';
          s.recoilLeft = t.shade_recoil_ticks;
          this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          break;
        }
      }
      if (B && !B.expel && p.invuln === 0 && (B.state === 'chase' || B.state === 'cast') && distXZ(B.pos, p.pos) <= t.boss_hit_radius
        && Math.abs(p.pos[1] - (B.pos[1] - SHADE_HOVER)) <= t.boss_hit_height) {
        this.hitPlayer('boss');
        if (B.state === 'chase') { B.state = 'recoil'; B.recoilLeft = t.boss_recoil_ticks; }
      }
    }

    // 10. scheduled spawns (new entities interact from the next tick)
    if (this.randomMotes && st % t.mote_spawn_ticks === 0 && this.motes.length < t.motes_max) {
      const taken = new Set(this.motes.filter((m) => m.point != null).map((m) => m.point));
      const free = map.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
      if (free.length) { const i = free[Math.floor(this.rng() * free.length)]; this.addMote(map.motePoints[i], 'random', i); }
    }
    if (this.randomShades) {
      const first = t.shade_first_spawn_tick;
      const n = st === first ? 2 : st > first && (st - first) % map.shadeInterval === 0 ? 1 : 0;
      for (let k = 0; k < n && this.shades.length < map.shadeMax; k++) {
        const valid = map.shadePoints.filter((q) => distXZ(q, p.pos) >= t.shade_spawn_min_dist && !this.insideSafe(q[0], q[2])
          && !this.shades.some((s) => distXZ(s.pos, q) < 0.5));
        if (!valid.length) break;
        const q = valid[Math.floor(this.rng() * valid.length)];
        const s = this.addShade([...q], null, 'spawning');
        this.emit('shade_spawned', { id: s.id });
      }
    }
    if (this.randomDrifters && st % t.drifter_spawn_ticks === 0 && this.drifters.filter((d) => d.state !== 'removed').length < t.drifter_max) {
      const q = map.shadePoints[Math.floor(this.rng() * map.shadePoints.length)];
      this.addDrifter([q[0], (this.ground(q[0], q[2]) ?? 0) + DRIFTER_HOVER, q[2]]);
    }

    if (this.bossTimed && !this.boss && st === ticks(t.boss_spawn_s)) {
      // farthest spawn point from Mây outside safe zones; ties (within 1e-6 m) → first in map order
      let q = null, qd = -1;
      for (const pt of map.shadePoints) {
        if (this.insideSafe(pt[0], pt[2])) continue;
        const d = distXZ(pt, p.pos);
        if (d > qd + 1e-6) { q = pt; qd = d; }
      }
      if (q) { const b = this.addBoss([...q], 'spawning'); this.emit('boss_spawned', { boss_id: b.id, hp: b.hp }); }
    }

    // 11. win / lose after every update of the tick: no flames always loses first; at dawn win if lit >= ceil(0.6 x total)
    if (this.bench) { /* benchmark scene never ends */ } else if (p.flames <= 0) this.finish('lost', 'no_flames');
    else if (st >= this.dawnTick) {
      const lit = this.lanterns.filter((l) => l.lit);
      if (lit.length >= this.winNeed) {
        for (const L of lit) this.score += sc.per_lit_at_dawn + Math.floor(L.fuel / FU);
        this.score += sc.per_flame_left * p.flames;
        this.finish('won', 'dawn_survived');
      } else this.finish('lost', 'dawn');
    }

    // 12. snapshot is written by the caller
    return end();
  }

  // Mây takes one hit (same rules as a shade touch): −1 flame, drops half the motes carried, becomes invulnerable.
  hitPlayer(by) {
    const t = this.t, p = this.player;
    p.flames -= 1;
    const dropped = Math.floor(p.carried * t.hit_drop_ratio);
    p.carried -= dropped;
    for (let i = 0; i < dropped; i++) this.dropMoteNear(p.pos);
    p.invuln = ticks(t.invuln_s);
    this.emit('player_hit', { by, flames: p.flames, dropped });
  }

  // Boss movement (extras), phase 8. Uses the shade mover: cannot enter safe zones, leave the island or climb walls.
  moveBoss(B, targetable) {
    const t = this.t, p = this.player;
    if (B.expel || B.state === 'spawning' || B.state === 'stunned') return;
    if (B.state === 'recoil') {
      let ux = B.pos[0] - p.pos[0], uz = B.pos[2] - p.pos[2];
      const n = Math.hypot(ux, uz);
      if (n < 1e-9) { ux = 1; uz = 0; } else { ux /= n; uz /= n; }
      const k = t.shade_recoil_m / t.boss_recoil_ticks;
      this.moveShade(B, ux * k, uz * k);
      if (--B.recoilLeft <= 0) { B.recoilLeft = 0; B.state = 'chase'; }
      return;
    }
    if (B.state === 'cast') {
      if (--B.castLeft > 0) return;
      this.bossSkill(B, B.castSkill);
      B.state = 'chase'; B.castSkill = null;
      B.skillLeft = ticks(t.boss_skill_every_s);
      B.nextSkill = BOSS_SKILLS[(BOSS_SKILLS.indexOf(B.nextSkill) + 1) % BOSS_SKILLS.length];
      return;
    }
    // chase Mây when targetable and within boss_detect_m, else drift toward the nearest lit lantern (to eclipse it)
    let goal = null;
    if (targetable && distXZ(B.pos, p.pos) <= t.boss_detect_m) goal = p.pos;
    else {
      let bd = Infinity;
      for (const L of this.lanterns) { if (!L.lit) continue; const d = distXZ(B.pos, L.pos); if (d < bd) { bd = d; goal = L.pos; } }
    }
    if (!goal) return;
    const d = distXZ(B.pos, goal);
    if (d > 1e-9) { const k = Math.min(d, t.boss_speed * DT) / d; this.moveShade(B, (goal[0] - B.pos[0]) * k, (goal[2] - B.pos[2]) * k); }
  }

  // summon: boss_summon_count shades (state spawning) on a circle of boss_summon_r around the boss at angles k·360°/count,
  //   skipping spots over the cloud sea, in the tower or in a safe zone; capped at shadeMax + boss_summon_cap_extra shades.
  // eclipse: every lit lantern within boss_eclipse_radius loses boss_eclipse_fuel (may go out right away); Mây within
  //   boss_shock_radius is hit unless invulnerable.
  bossSkill(B, skill) {
    const t = this.t, p = this.player;
    if (skill === 'summon') {
      const ids = [], n = t.boss_summon_count;
      for (let k = 0; k < n; k++) {
        if (this.shades.length >= this.map.shadeMax + t.boss_summon_cap_extra) break;
        const a = (2 * Math.PI * k) / n, x = r3(B.pos[0] + t.boss_summon_r * Math.cos(a)), z = r3(B.pos[2] + t.boss_summon_r * Math.sin(a));
        const g = this.ground(x, z);
        if (g === null || g === TOWER || this.insideSafe(x, z)) continue;
        ids.push(this.addShade([x, g + SHADE_HOVER, z], null, 'spawning').id);
      }
      this.emit('boss_skill', { boss_id: B.id, skill, spawned_ids: ids });
    } else {
      const dimmed = [];
      for (const L of this.lanterns) {
        if (!L.lit || distXZ(B.pos, L.pos) > t.boss_eclipse_radius) continue;
        L.fuel -= t.boss_eclipse_fuel * FU;
        dimmed.push(L.id);
      }
      this.emit('boss_skill', { boss_id: B.id, skill, lantern_ids: dimmed });
      for (const L of this.lanterns) {
        if (L.lit && L.fuel <= 0) { L.lit = false; L.fuel = 0; L.deposited = 0; this.emit('lantern_out', { lantern_id: L.id }); }
      }
      if (p.fallWait === 0 && p.invuln === 0 && distXZ(B.pos, p.pos) <= t.boss_shock_radius) this.hitPlayer('boss_shock');
    }
  }

  // Where a shade inside a lantern zone (centre c) is pushed to: the zone edge straight away from the lantern, as before,
  // unless that spot is over the sea of clouds, inside the bell tower or inside another zone. Then the nearest open spot
  // on the edge, trying ±15°, ±30°, … around the radial direction (+ before −). Nothing open → the radial spot.
  expelTarget(s, c) {
    const R = this.t.safe_radius, p = this.player.pos;
    let ux = s.pos[0] - c[0], uz = s.pos[2] - c[2];
    const d = Math.hypot(ux, uz);
    if (d < 1e-9) { ux = s.pos[0] - p[0]; uz = s.pos[2] - p[2]; const n = Math.hypot(ux, uz); if (n < 1e-9) { ux = 1; uz = 0; } else { ux /= n; uz /= n; } }
    else { ux /= d; uz /= d; }
    const open = (x, z) => { const h = this.ground(x, z); return h !== null && h !== TOWER && !this.insideSafe(x, z); };
    const radial = [c[0] + R * ux, c[2] + R * uz];
    if (open(radial[0], radial[1])) return radial;
    const a0 = Math.atan2(uz, ux);
    for (let k = 1; k <= 12; k++) {
      for (const sg of [1, -1]) {
        const a = a0 + sg * k * EXPEL_STEP, x = c[0] + R * Math.cos(a), z = c[2] + R * Math.sin(a);
        if (open(x, z)) return [x, z];
      }
    }
    return radial;
  }

  pushOutOfObstacles(pos) {
    for (const o of this.obstacles) {
      if (pos[1] >= o.h) continue; // high enough to pass over (e.g. jumping over a small rock)
      const dx = pos[0] - o.x, dz = pos[2] - o.z, d = Math.hypot(dx, dz), min = o.r + PLAYER_RADIUS;
      if (d >= min) continue;
      const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
      pos[0] = o.x + ux * min; pos[2] = o.z + uz * min;
    }
  }

  // Lantern a wandering shade walks to: scenario target first (if weak or unlit), else nearest weak lit lantern, else nearest unlit.
  wanderTarget(s) {
    const weak = (L) => L.lit && L.fuel < this.lowFuel;
    if (s.targetId) {
      const L = this.lanterns.find((l) => l.id === s.targetId);
      if (L && (weak(L) || !L.lit)) return L;
    }
    const nearest = (pred) => {
      let best = null, bd = Infinity;
      for (const L of this.lanterns) { if (!pred(L)) continue; const d = distXZ(s.pos, L.pos); if (d < bd) { best = L; bd = d; } } // lanterns are stored in id order
      return best;
    };
    return nearest(weak) || nearest((L) => !L.lit);
  }

  dropMoteNear(pos) {
    const t = this.t;
    for (let k = 0; k < 8; k++) {
      const a = this.rng() * 2 * Math.PI, r = 1.5 + this.rng() * 1.0;
      const x = pos[0] + r * Math.cos(a), z = pos[2] + r * Math.sin(a), g = this.ground(x, z);
      if (g !== null && g !== TOWER) return this.addMote([r3(x), g, r3(z)], 'dropped', null, t.dropped_ttl_ticks);
    }
    const g = this.ground(pos[0], pos[2]);
    if (g !== null && g !== TOWER) return this.addMote([r3(pos[0] + 1.5), g, r3(pos[2])], 'dropped', null, t.dropped_ttl_ticks);
    return null;
  }

  finish(result, reason) {
    this.state = result;
    this.result = reason;
    this.emit('game_over', { result, reason });
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.displayState,
      night: this.night,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.active ? this.wind.dir : null },
      player: {
        pos: r3v(p.pos), vel: r3v(p.vel), grounded: p.grounded, flames: p.flames, carried: p.carried,
        capacity: this.capacity, invuln: p.invuln > 0, dash_cd_s: r3(p.dashCd / TICK_HZ), pulse_cd_s: r3(p.pulseCd / TICK_HZ), charm_s: r3(p.charm / TICK_HZ),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited, fuel: r1(l.fuel / FU), ever_lit: l.everLit, relit_count: l.relitCount })),
      shades: this.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: r3v(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? r3(m.ttl / TICK_HZ) : null })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: r3v(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, pos: r3v(c.pos), available: c.available, respawn_s: r3(c.respawn / TICK_HZ) })),
      ...(this.extras ? this.extrasSnapshot() : {}),
    };
  }

  // Extra snapshot fields, only when extras are on (contract snapshots keep their v1.3 shape).
  extrasSnapshot() {
    const p = this.player, B = this.boss;
    return {
      banish_cd_s: r3(p.banishCd / TICK_HZ),
      boss: B ? { id: B.id, pos: r3v(B.pos), state: B.state, hp: B.hp, hp_max: B.hpMax, skill: B.state === 'cast' ? B.castSkill : null,
        next_skill: B.nextSkill, skill_in_s: r3(B.skillLeft / TICK_HZ), cast_left_s: r3(B.castLeft / TICK_HZ) } : null,
    };
  }
}
