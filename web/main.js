// 3D client: renders the shared deterministic sim (src/sim/game.js). No gameplay rules live here.
// Flow: menu → night intro → play → result → next night … → Bình Minh. Pause / settings / audio / HUD.
import * as THREE from 'three';
import { Game, DT, NIGHTS } from '/src/sim/game.js';
import { sfx, unlock, setVolume, startMusic, stopMusic } from '/web/audio.js';
import { benchScenario, benchCamera } from '/src/sim/bench.js';
import { createSky, createCloudSea, islandMesh, decorations, grass, ambientFireflies, radialTexture, shadowTexture } from '/web/scenery.js';
import { createMay } from '/web/may.js';
import { validate as validateEntry, insert as insertEntry } from '/src/leaderboard-rules.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const params = new URLSearchParams(location.search);
// Benchmark scene (Ticket-04 §1): ?bench&seed=42&duration=30&warmup=3 — standard scene, no creative extras, scripted camera.
const BENCH = params.has('bench');
const benchCfg = { seed: Number(params.get('seed') ?? 42), duration: Number(params.get('duration') ?? 30), warmup: Number(params.get('warmup') ?? 3) };

// ---------- standard palette (Ticket-02) ----------
const C = {
  sky: 0x0e1430, mist: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450, robe: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8, danger: 0xff5a5f, ui: 0xf5f1e6, stone: 0x4b5160,
  shadeEdgeCB: 0x00b3ff, // colour-blind mode (Ticket-03): shade outline + eyes
};
const shadeEdgeColor = () => (settings.colorblind ? C.shadeEdgeCB : C.shadeEdge);
function applyColorblind() {
  document.body.classList.toggle('cb', !!settings.colorblind);
  if (typeof shadeEyes !== 'undefined') shadeEyes.material.color.setHex(shadeEdgeColor());
}

// ---------- settings (persisted) ----------
// Key bindings (Ticket-04 accessibility): every action can be rebound; duplicates are reported; Esc always pauses too.
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyQ', pause: 'KeyP' };
const ACTIONS = [['up', 'Tiến (theo camera)'], ['down', 'Lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'], ['jump', 'Nhảy'], ['dash', 'Lướt'],
  ['interact', 'Tương tác: nạp / thắp lại / châm dầu'], ['pulse', 'Tỏa Sáng'], ['pause', 'Tạm dừng']];
const settings = { volume: 0.7, sens: 1, colorblind: false, captions: true, reducedMotion: false, largeText: false, keys: { ...DEFAULT_KEYS } };
try {
  const saved = JSON.parse(localStorage.getItem('ddl-settings') || '{}');
  Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } });
} catch { /* storage unavailable */ }
const keyLabel = (code) => {
  if (!code) return '—';
  const named = { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', AltRight: 'Alt phải',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', CapsLock: 'Caps' };
  return named[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
};
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } };
setVolume(settings.volume);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.Fog(C.mist, 30, 130);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// Ambient light grows with progress: intensity = 0.15 + 0.55 × lit / total (Ticket-02).
const ambient = new THREE.AmbientLight(0xb8c4ff, 0.15);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xaab4ff, 1.1); // moonlight (not the ambient term)
moon.position.set(-30, 60, -20);
scene.add(moon);
const OFF = new Set((params.get('x') || '').split(',')); // A/B switches for bench experiments only
const sky = OFF.has('sky') ? { update() {} } : createSky(scene, C);
const cloudSea = OFF.has('sea') ? { update() {} } : createCloudSea(scene, C);
const glowTex = radialTexture('rgba(255,200,120,1)', 'rgba(255,200,120,0)');
const shadowTex = shadowTexture();

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = { grass: mat(C.grass), sand: mat(C.sand), wood: mat(C.wood), stone: mat(C.stone), cliff: mat(0x3d4a52, { flatShading: true }) };

// ---------- world building per night ----------
let world = null; // THREE.Group of static geometry for the current night
const island = (r, cx = 0, cz = 0) => { const g = islandMesh(r, C); g.position.set(cx, 0, cz); return g; };
// Decorations are creative scenery: off in the bench scene; their colliders become client-only sim obstacles.
function decorate(g, spots, avoid, areas) {
  if (BENCH) return;
  const map = NIGHTS[night];
  const clear = (x, z) => avoid(x, z) || map.motePoints.some((q) => Math.hypot(x - q[0], z - q[2]) < 2.2)
    || map.shadePoints.some((q) => Math.hypot(x - q[0], z - q[2]) < 2.2) || Math.hypot(x - map.start[0], z - map.start[2]) < 4;
  const d = decorations(C, spots, clear);
  g.add(d.group);
  g.userData.colliders.push(...d.colliders);
  g.add(grass(C, areas, (x, z) => clear(x, z) || d.colliders.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.3)));
  if (fireflies) scene.remove(fireflies.obj);
  fireflies = ambientFireflies(scene, areas);
}
let fireflies = null;
function pad(g, pos, toward) {
  const p = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.25, 24), mat(C.stone));
  base.position.y = 0.12; p.add(base);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, opacity: 0.8 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.26; p.add(glow);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 3), new THREE.MeshBasicMaterial({ color: C.gold }));
  arrow.rotation.z = -Math.PI / 2; arrow.position.y = 0.6; const holder = new THREE.Group(); holder.add(arrow);
  holder.rotation.y = Math.atan2(-(toward[1]), toward[0]); p.add(holder);
  p.position.set(pos[0], pos[1], pos[2]); p.userData.glow = glow; g.add(p);
  return p;
}
function buildWorld(n) {
  if (world) scene.remove(world);
  world = new THREE.Group();
  const map = NIGHTS[n];
  world.userData.pads = []; world.userData.colliders = [];
  if (fireflies) { scene.remove(fireflies.obj); fireflies = null; }
  if (n === 1) {
    world.add(island(40));
    decorate(world, [[0, 0, 70, 26, 37], [0, 0, 18, 6, 18]], (x, z) => map.lanterns.some((l) => Math.hypot(x - l[0], z - l[2]) < 4.5), [[0, 0, 40]]);
  } else if (n === 2) {
    world.add(island(28, 0, 0)); world.add(island(28, 70, 0));
    const bridge = new THREE.Group();
    for (let x = 26; x < 44; x += 0.6) { const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 4), M.wood); plank.position.set(x + 0.3, -0.08, 0); bridge.add(plank); }
    for (const z of [-2.1, 2.1]) { const rope = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 0.08), mat(0xc9b48a)); rope.position.set(35, -0.05, z); bridge.add(rope); }
    world.add(bridge);
    decorate(world, [[0, 0, 34, 14, 26], [70, 0, 34, 14, 26]], (x, z) => map.lanterns.some((l) => Math.hypot(x - l[0], z - l[2]) < 4.5) || map.pads.some((p) => Math.hypot(x - p.pos[0], z - p.pos[2]) < 3.5) || map.charms.some((c) => Math.hypot(x - c[0], z - c[2]) < 3) || (Math.abs(z) < 5 && x > 18 && x < 52) || Math.hypot(x - 20, z - 18) < 4 || Math.hypot(x - 50, z + 18) < 4, [[0, 0, 28], [70, 0, 28]]);
    for (const p of map.pads) world.userData.pads.push(pad(world, p.pos, [p.toward[0] - p.pos[0], p.toward[1] - p.pos[2]]));
  } else {
    world.add(island(45));
    // tier 1: half annulus 12–24 m on z > 0, height 3 (shape v = −z so that rotateX(−90°) lands it on z > 0)
    const pts = [];
    for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI; pts.push(new THREE.Vector2(24 * Math.cos(a), -24 * Math.sin(a))); }
    for (let i = 32; i >= 0; i--) { const a = (i / 32) * Math.PI; pts.push(new THREE.Vector2(12 * Math.cos(a), -12 * Math.sin(a))); }
    const t1 = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 3, bevelEnabled: false, curveSegments: 32, steps: 3 });
    t1.rotateX(-Math.PI / 2);
    world.add(new THREE.Mesh(t1, [M.grass, M.cliff]));
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 40, 4), [M.cliff, M.grass, M.cliff]);
    // tier rims: thin sand edges so the walkable edge reads clearly
    const rim2 = new THREE.Mesh(new THREE.RingGeometry(7.6, 8, 48), M.sand); rim2.rotation.x = -Math.PI / 2; rim2.position.y = 6.01; world.add(rim2);
    t2.position.y = 3; world.add(t2);
    for (const a of map.ramps) {
      const wedge = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(6, 0), new THREE.Vector2(6, 3)]), { depth: 3, bevelEnabled: false });
      wedge.translate(0, 0, -1.5);
      const r = new THREE.Mesh(wedge, M.wood);
      const ar = (a * Math.PI) / 180;
      r.position.set(30 * Math.cos(ar), 0, 30 * Math.sin(ar));
      r.rotation.y = Math.PI - ar;
      world.add(r);
    }
    const tower = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2, 8, 16), mat(0x8a6a4a)); body.position.y = 4; tower.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 4), mat(0x7a2a24)); roof.position.y = 9.1; roof.rotation.y = Math.PI / 4; tower.add(roof);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 1.2, 16, 1, true), mat(C.gold, { side: THREE.DoubleSide })); bell.position.y = 6.8; tower.add(bell);
    world.userData.bell = bell;
    tower.position.y = 6; world.add(tower);
    decorate(world, [[0, 0, 60, 27, 43]], (x, z) => map.lanterns.some((l) => Math.hypot(x - l[0], z - l[2]) < 4.5) || map.ramps.some((a) => Math.hypot(x - 27 * Math.cos(a * Math.PI / 180), z - 27 * Math.sin(a * Math.PI / 180)) < 5.5) || map.charms.some((c) => Math.hypot(x - c[0], z - c[2]) < 3) || (z > -1 && Math.hypot(x, z) < 25.5), [[0, 0, 45]]);
    for (const p of map.pads) world.userData.pads.push(pad(world, p.pos, p.dir));
  }
  scene.add(world);
}

// ---------- lanterns ----------
const lanternViews = new Map();
function makeLantern(L) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), M.wood);
  post.position.y = 1.6; g.add(post);
  const headMat = new THREE.MeshLambertMaterial({ color: C.lampOff, emissive: 0x000000 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), headMat);
  head.scale.y = 1.25; head.position.y = 3.7; g.add(head);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, opacity: 0 }));
  core.position.y = 3.7; g.add(core);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 12), mat(0x7a2a24));
  cap.position.y = 4.75; g.add(cap);
  const light = new THREE.PointLight(C.lampOn, 0, 28, 1.6); light.position.y = 3.7; g.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.lampOn, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(5); halo.position.y = 3.7; g.add(halo);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ map: glowTex, color: C.lampOn, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03; g.add(pool);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
  // torn paper: dark jagged patch, shown only while the lantern is out (shape cue independent of colour)
  const tear = new THREE.Mesh(new THREE.CircleGeometry(0.32, 5), new THREE.MeshBasicMaterial({ color: 0x15161c, side: THREE.DoubleSide }));
  tear.position.set(0.18, 3.75, 0.72); tear.rotation.z = 0.5; g.add(tear);
  const tear2 = tear.clone(); tear2.position.set(-0.2, 3.5, -0.72); tear2.scale.setScalar(0.7); g.add(tear2);
  // fuel bar (billboard): back + fill, above the cap
  const bar = new THREE.Group(); bar.position.y = 5.4;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.3), new THREE.MeshBasicMaterial({ color: 0xf5f1e6, transparent: true, opacity: 0.35, fog: false }));
  const fillMat = new THREE.MeshBasicMaterial({ color: C.lampOn, transparent: true, fog: false });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.18), fillMat); fill.position.z = 0.01;
  bar.add(back, fill); g.add(bar);
  const pips = [];
  for (let i = 0; i < T.lantern_cost; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: C.lampOff }));
    const a = (i / T.lantern_cost) * Math.PI * 2; p.position.set(Math.sin(a) * 1.1, 2.6, Math.cos(a) * 1.1); g.add(p); pips.push(p);
  }
  g.position.set(L.pos[0], L.pos[1], L.pos[2]);
  scene.add(g);
  return { g, head, headMat, core, light, ring, pips, glow: 0, tear, tear2, bar, fill, fillMat, halo, pool };
}

// ---------- player: Mây (áo trắng ngà, khăn đỏ, nón lá + đèn lồng nhỏ) ----------
const may = createMay(C);
const player = may.root;
scene.add(player);
const playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
playerShadow.rotation.x = -Math.PI / 2; scene.add(playerShadow);

// ---------- motes, shades, drifters, charms (pooled by id) ----------
const moteGeo = new THREE.SphereGeometry(0.13, 8, 6), moteMat = new THREE.MeshBasicMaterial({ color: C.moteCore });
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,229,138,1)'); g.addColorStop(0.4, 'rgba(255,229,138,.45)'); g.addColorStop(1, 'rgba(255,229,138,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
// Shades and motes are drawn with instancing: one draw call per part whatever their number (200 shades in the bench).
const MAX_SHADES = 256, MAX_MOTES = 192;
const instanced = (geo, mat, n) => {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); return m;
};
const moteCores = instanced(moteGeo, moteMat, MAX_MOTES);
const haloGeo = new THREE.BufferGeometry();
haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_MOTES * 3), 3).setUsage(THREE.DynamicDrawUsage));
const moteHalos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ map: haloTex, color: C.moteHalo, size: 0.9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
moteHalos.frustumCulled = false; scene.add(moteHalos);
const shadeGeo = new THREE.SphereGeometry(0.9, 18, 12), edgeGeo = new THREE.SphereGeometry(0.98, 18, 12), eyeGeo = new THREE.SphereGeometry(0.12, 8, 6);
const shadeBodies = instanced(shadeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_SHADES);
const shadeEdges = instanced(edgeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }), MAX_SHADES);
const shadeEyes = instanced(eyeGeo, new THREE.MeshBasicMaterial({ color: shadeEdgeColor() }), MAX_SHADES * 2);
const shadeShadows = instanced(new THREE.CircleGeometry(0.8, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }), MAX_SHADES);
const shadeAnim = new Map(); // id → current display scale (spawn grow-in)
const _m = new THREE.Matrix4(), _e = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color(), _c2 = new THREE.Color();
const EYE_OFFSETS = [new THREE.Vector3(-0.3, 0.2, 0.8), new THREE.Vector3(0.3, 0.2, 0.8)];
function makeDrifter() {
  const geo = new THREE.PlaneGeometry(0.5, 2.6, 1, 14);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  const g = new THREE.Group(); g.add(m); scene.add(g);
  return { g, m, base: Float32Array.from(geo.attributes.position.array) };
}
function makeCharm() {
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.05), new THREE.MeshBasicMaterial({ color: C.gold }));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.88, 0.07), new THREE.MeshBasicMaterial({ color: C.scarf }));
  const sym = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 16), new THREE.MeshBasicMaterial({ color: C.gold }));
  sym.position.z = 0.05; g.add(border, paper, sym);
  const light = new THREE.PointLight(C.scarf, 1.5, 6, 2); g.add(light);
  scene.add(g); return { g };
}
const drifterViews = new Map(), charmViews = new Map();
function sync(views, items, make) {
  const seen = new Set();
  for (const it of items) { seen.add(it.id); if (!views.has(it.id)) views.set(it.id, make(it)); }
  for (const [id, v] of views) if (!seen.has(id)) { scene.remove(v.g); views.delete(id); }
}
function clearViews() {
  for (const views of [drifterViews, charmViews, lanternViews]) { for (const v of views.values()) scene.remove(v.g); views.clear(); }
  shadeAnim.clear(); shadeBodies.count = shadeEdges.count = shadeEyes.count = shadeShadows.count = moteCores.count = 0; haloGeo.setDrawRange(0, 0);
}

// pulse rings, wind leaves
const pulses = [];
function spawnPulse(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos[0], pos[1] + 0.8, pos[2]); scene.add(m); pulses.push({ m, t: 0 });
}
const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.25, 0.14), new THREE.MeshBasicMaterial({ color: 0x9fbf6a, side: THREE.DoubleSide }), 80);
leaves.visible = false; scene.add(leaves);
const leafState = Array.from({ length: 80 }, (_, i) => ({ o: [Math.sin(i * 12.9) * 14, 1 + (i % 5), Math.cos(i * 7.7) * 14], s: 0.6 + (i % 7) / 7 }));
const leafM = new THREE.Matrix4(), leafQ = new THREE.Quaternion(), leafE = new THREE.Euler();

// ---------- input ----------
const keys = new Set();
let camYaw = 0, mouseDown = false;
addEventListener('keydown', (e) => {
  if (rebinding) { e.preventDefault(); e.stopPropagation(); finishRebind(e.code); return; }
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return; // typing a leaderboard name
  keys.add(e.code);
  if (['Space', 'ShiftLeft', 'ShiftRight', 'Tab'].includes(e.code) || Object.values(settings.keys).includes(e.code)) e.preventDefault();
  if ((e.code === 'Escape' || e.code === settings.keys.pause) && !e.repeat) { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
  if (e.code === 'F3') { $('fps').classList.toggle('hidden'); e.preventDefault(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (mode === 'playing') pause(); });
renderer.domElement.addEventListener('mousedown', (e) => {
  unlock();
  if (mode === 'playing' && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
  if (e.button === 0) mouseDown = true;
});
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', (e) => { if (document.pointerLockElement === renderer.domElement && mode === 'playing') camYaw -= e.movementX * 0.0025 * settings.sens; });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && mode === 'playing' && lockedOnce) pause(); lockedOnce = !!document.pointerLockElement || lockedOnce; });
let lockedOnce = false;

function readInput() {
  if (BENCH) return { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  // Contract: move = [x, z], z+ = camera forward. With yaw 0 the camera looks along +Z, so screen-right is world −X.
  const K = settings.keys, on = (a) => keys.has(K[a]);
  let x = 0, z = 0;
  if (on('up')) z += 1;
  if (on('down')) z -= 1;
  if (on('left')) x += 1;
  if (on('right')) x -= 1;
  return {
    move: [x, z], cam_yaw_deg: (camYaw * 180) / Math.PI,
    jump: on('jump'), interact: on('interact'),
    pulse: on('pulse') || (mouseDown && document.pointerLockElement === renderer.domElement),
    dash: on('dash'), pause: false,
  };
}

// ---------- flow ----------
const $ = (id) => document.getElementById(id);
const screens = ['scr-menu', 'scr-intro', 'scr-pause', 'scr-settings', 'scr-result', 'scr-dawn', 'scr-lb'];
const show = (id) => { for (const s of screens) $(s).classList.toggle('hidden', s !== id); };
const INTRO = {
  1: 'Mây ơi, sương đen tràn qua bến rồi. Năm ngọn đèn lớn đang chờ cháu, mỗi ngọn cần mười đốm sáng. Đèn sáng thì Bóng Mực không dám lại gần.',
  2: 'Đảo Cau là hai hòn đảo nối bằng cây cầu tre cũ, không có lan can đâu. Bục đá gió sẽ bắn cháu bay qua biển mây. Coi chừng Gió Lạc, chúng thích cướp đom đóm của người mang nặng.',
  3: 'Tháp chuông đứng giữa ba tầng đá. Gió mạnh thổi từng cơn, lá bay báo trước hai giây. Thắp đủ bảy ngọn đèn, bình minh sẽ về.',
};
let mode = 'menu', game = null, night = 1, acc = 0, last = performance.now();
let campaign = { scores: {}, seed: 1 }; // won night → score; nights use seed + night
const totalScore = () => Object.values(campaign.scores).reduce((a, b) => a + b, 0);
const urlScenario = params.get('scenario') ? await (await fetch(params.get('scenario'))).json() : null;

function newGame(n) {
  clearViews();
  night = n;
  buildWorld(n);
  const seed = params.has('seed') ? Number(params.get('seed')) : (campaign.seed + n) | 0;
  game = BENCH ? new Game({ tuning: T, seed: benchCfg.seed, night: 1, scenario: benchScenario(benchCfg.seed), bench: true })
    : new Game({ tuning: T, seed, night: n, scenario: urlScenario, obstacles: world.userData.colliders });
  for (const L of game.lanterns) lanternViews.set(L.id, makeLantern(L));
  camYaw = Math.atan2(game.player.facing[0], game.player.facing[1]);
  if (params.has('yaw')) camYaw = (Number(params.get('yaw')) * Math.PI) / 180;
  acc = 0; lastSecond = null;
  $('hud-night').textContent = `Đêm ${n} · ${NIGHTS[n].name}`;
}
function showIntro(n) {
  newGame(n);
  $('intro-num').textContent = `ĐÊM ${n} / 3`;
  $('intro-name').textContent = NIGHTS[n].name;
  $('intro-quote').textContent = `Ông Đăng: “${INTRO[n]}”`;
  const mins = Math.floor(game.timeLeft0 / 60), secs = Math.round(game.timeLeft0 % 60);
  $('intro-goal').innerHTML = [`🏮 ${game.lanterns.length} đèn`, `🌅 giữ ${game.winNeed} đèn tới bình minh`, `⏳ ${mins}:${String(secs).padStart(2, '0')}`, '🛢 đèn cạn dầu sẽ tắt']
    .map((c) => `<span class="chip2">${c}</span>`).join('');
  mode = 'intro'; show('scr-intro'); $('hud').classList.add('hidden');
}
function play() {
  unlock(); mode = 'playing'; show(null); $('hud').classList.remove('hidden');
  startMusic(night); last = performance.now();
  renderer.domElement.requestPointerLock?.();
}
function pause() { if (mode !== 'playing') return; mode = 'paused'; show('scr-pause'); document.exitPointerLock?.(); stopMusic(); }
function resume() { if (mode !== 'paused') return; play(); }
let settingsBack = 'scr-menu';
function openSettings(back) {
  settingsBack = back; show('scr-settings');
  $('set-vol').value = Math.round(settings.volume * 100); $('set-sens').value = settings.sens; renderSettings();
}
function renderSettings() {
  $('set-vol-o').textContent = `${Math.round(settings.volume * 100)}%`; $('set-sens-o').textContent = `${Number(settings.sens).toFixed(1)}×`;
  $('set-cb').checked = !!settings.colorblind; $('set-captions').checked = !!settings.captions; $('set-reduced').checked = !!settings.reducedMotion; $('set-large').checked = !!settings.largeText;
  renderKeys();
}
function applyA11y() {
  document.documentElement.classList.toggle('large', !!settings.largeText);
  document.body.classList.toggle('reduced', !!settings.reducedMotion);
  $('key-dash').textContent = keyLabel(settings.keys.dash); $('key-pulse').textContent = keyLabel(settings.keys.pulse);
  const K = settings.keys;
  $('controls').innerHTML = [
    [`${keyLabel(K.up)} ${keyLabel(K.left)} ${keyLabel(K.down)} ${keyLabel(K.right)}`, 'Di chuyển theo hướng camera'],
    ['Chuột · Z/C', 'Xoay camera (bấm vào màn hình để khóa chuột)'], [keyLabel(K.jump), 'Nhảy'], [keyLabel(K.dash), 'Lướt'],
    [keyLabel(K.interact), 'Nạp ánh sáng / thắp lại / châm dầu'], [`${keyLabel(K.pulse)} · chuột trái`, 'Tỏa Sáng (tốn 3 đom đóm)'], [`${keyLabel(K.pause)} · Esc`, 'Tạm dừng'],
  ].map(([k, d]) => `<span><kbd>${k}</kbd></span><span>${d}</span>`).join('');
}
// ---- key rebinding ----
let rebinding = null;
function duplicates() {
  const by = new Map();
  for (const [a] of ACTIONS) { const c = settings.keys[a]; if (!by.has(c)) by.set(c, []); by.get(c).push(a); }
  return [...by.entries()].filter(([, list]) => list.length > 1);
}
function renderKeys() {
  const dups = duplicates(), dupActions = new Set(dups.flatMap(([, l]) => l));
  $('keys').innerHTML = ACTIONS.map(([a, label]) => `<span>${label}</span><button class="ghost small${dupActions.has(a) ? ' dup' : ''}${rebinding === a ? ' listening' : ''}" data-action="${a}">${rebinding === a ? 'Nhấn phím…' : keyLabel(settings.keys[a])}</button>`).join('');
  const name = (a) => ACTIONS.find(([x]) => x === a)[1];
  $('keys-warn').textContent = dups.length ? `⚠ Trùng phím: ${dups.map(([c, l]) => `${keyLabel(c)} đang dùng cho ${l.map(name).join(' và ')}`).join('; ')}. Hãy đổi một trong các phím.` : '';
  for (const b of $('keys').querySelectorAll('button')) b.addEventListener('click', () => { rebinding = b.dataset.action; renderKeys(); });
}
function finishRebind(code) {
  if (code !== 'Escape') settings.keys[rebinding] = code; // Esc cancels
  rebinding = null; saveSettings(); renderKeys(); applyA11y(); sfx.click();
}
$('btn-keys-reset').addEventListener('click', () => { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); renderKeys(); applyA11y(); sfx.click(); });
for (const [id, key] of [['set-captions', 'captions'], ['set-reduced', 'reducedMotion'], ['set-large', 'largeText']]) {
  $(id).addEventListener('change', (e) => { settings[key] = e.target.checked; saveSettings(); applyA11y(); sfx.click(); });
}
$('set-cb').addEventListener('change', (e) => { settings.colorblind = e.target.checked; applyColorblind(); saveSettings(); sfx.click(); });
$('set-vol').addEventListener('input', (e) => { settings.volume = e.target.value / 100; setVolume(settings.volume); renderSettings(); saveSettings(); });
$('set-vol').addEventListener('change', () => sfx.click());
$('set-sens').addEventListener('input', (e) => { settings.sens = Number(e.target.value); renderSettings(); saveSettings(); });
$('btn-settings-back').addEventListener('click', () => show(settingsBack));
$('btn-menu-settings').addEventListener('click', () => openSettings('scr-menu'));
$('btn-pause-settings').addEventListener('click', () => openSettings('scr-pause'));
$('btn-play').addEventListener('click', () => { unlock(); campaign = { scores: {}, seed: params.has('seed') ? Number(params.get('seed')) : (Date.now() & 0x3fffffff) }; showIntro(1); });
$('btn-menu-lb').addEventListener('click', () => showLeaderboard());
$('btn-lb-back').addEventListener('click', () => show('scr-menu'));
$('btn-intro-go').addEventListener('click', play);
$('btn-resume').addEventListener('click', resume);
$('btn-restart').addEventListener('click', () => showIntro(night));
$('btn-tomenu').addEventListener('click', toMenu);
$('res-menu').addEventListener('click', toMenu);
$('btn-dawn-menu').addEventListener('click', toMenu);
// ---------- leaderboard (server on disk, browser storage as fallback when served statically) ----------
const LOCAL_LB = 'ddl-leaderboard';
const localLb = () => { try { return JSON.parse(localStorage.getItem(LOCAL_LB) || '{"entries":[]}').entries || []; } catch { return []; } };
async function fetchLb() {
  try { const r = await fetch('/api/leaderboard', { cache: 'no-store' }); if (r.ok) return { entries: (await r.json()).entries, where: 'disk' }; } catch { /* static hosting */ }
  return { entries: localLb(), where: 'browser' };
}
async function saveLb(body) {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (r.ok) return { ...data, where: 'disk' };
    if (r.status === 400) return { error: data.error };
  } catch { /* no server → browser storage */ }
  const { entry, error } = validateEntry(body);
  if (error) return { error };
  const res = insertEntry(localLb(), entry);
  try { localStorage.setItem(LOCAL_LB, JSON.stringify({ entries: res.entries })); } catch { return { error: 'không lưu được' }; }
  return { ...res, where: 'browser' };
}
let lastSaved = null;
function nameEntry(container) {
  container.innerHTML = '';
  container.appendChild($('tpl-name').content.cloneNode(true));
  const form = container.querySelector('form'), input = container.querySelector('.nf-name'), msg = container.querySelector('.nf-msg');
  const nightsWon = Object.keys(campaign.scores).length;
  container.querySelector('.nf-score').textContent = `${totalScore()} điểm (${nightsWon}/3 Đêm)`;
  try { input.value = localStorage.getItem('ddl-last-name') || ''; } catch { /* ignore */ }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: input.value, score: totalScore(), nights_won: nightsWon, seed: campaign.seed };
    const res = await saveLb(body);
    if (res.error) { msg.textContent = `⚠ ${res.error === 'name must be 3–12 characters: letters, digits or _' ? 'Tên cần 3–12 ký tự: chữ, số hoặc _' : res.error}`; return; }
    try { localStorage.setItem('ddl-last-name', input.value.trim()); } catch { /* ignore */ }
    lastSaved = res.entries[res.rank - 1] ?? null;
    container.innerHTML = `<p>${res.rank ? `Đã lưu: hạng <b>${res.rank}</b>` : 'Đã lưu, nhưng chưa vào top 10'}.</p><div class="btns"><button class="ghost small" type="button">Xem bảng xếp hạng</button></div>`;
    container.querySelector('button').addEventListener('click', () => showLeaderboard());
    sfx.click();
  });
}
async function showLeaderboard() {
  stopMusic(); mode = 'menu'; $('hud').classList.add('hidden'); show('scr-lb');
  const { entries, where } = await fetchLb();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('lb-body').innerHTML = entries.length ? entries.map((e, i) => `<tr class="${lastSaved && e.achieved_at === lastSaved.achieved_at && e.name === lastSaved.name ? 'me' : ''}"><td class="num">${i + 1}</td><td>${esc(e.name)}</td><td class="num">${e.score}</td><td class="num">${e.nights_won}</td><td>${new Date(e.achieved_at).toLocaleString('vi-VN')}</td></tr>`).join('')
    : '<tr><td colspan="5">Chưa có điểm nào. Hãy chơi một ván!</td></tr>';
  $('lb-note').textContent = where === 'disk' ? 'Lưu trên đĩa (data/leaderboard.json). Xuất: npm start -- --export-leaderboard out.json' : 'Không có server: đang lưu trong trình duyệt này.';
}

function toMenu() { stopMusic(); mode = 'menu'; $('hud').classList.add('hidden'); renderNightCards(); show('scr-menu'); }
function renderNightCards() {
  const feats = { 1: 'Đảo tròn, 5 đèn lớn', 2: 'Cầu tre · bục nhảy · Gió Lạc · Bùa Gió', 3: 'Ba tầng đá · tháp chuông · gió mạnh' };
  $('night-cards').innerHTML = [1, 2, 3].map((n) => {
    const m = NIGHTS[n], total = m.lanterns.length, need = Math.ceil(T.win_ratio * total - 1e-9), dur = T[m.durationKey];
    const won = campaign.scores[n] != null;
    return `<div class="ncard panel${won ? ' won' : ''}">${won ? `<span class="badge">★ ${campaign.scores[n]}</span>` : ''}<div class="no">ĐÊM ${n}</div><h3>${m.name}</h3>`
      + `<div class="meta">${feats[n]}</div><div class="meta">${total} đèn · giữ ${need} · ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}</div></div>`;
  }).join('');
}

function onEvent(ev) {
  switch (ev.name) {
    case 'mote_picked': sfx.pickup(); break;
    case 'deposit': sfx.deposit(); break;
    case 'lantern_lit': sfx.lantern(); message(ev.data.relight ? 'Đèn đã được thắp lại!' : 'Một ngọn đèn đã sáng!'); break;
    case 'refuel': sfx.deposit(); break;
    case 'lantern_out': sfx.out(); message(`Đèn ${ev.data.lantern_id} đã cạn dầu và tắt!`); break;
    case 'fuel_drain': if (!drainWarned.has(ev.data.lantern_id)) { drainWarned.add(ev.data.lantern_id); message(`Bóng Mực đang hút dầu đèn ${ev.data.lantern_id}!`); } break;
    case 'pulse': sfx.pulse(); break;
    case 'player_hit':
      if (ev.data.by === 'fall') { sfx.fall(); message('Rơi xuống biển mây! Mất hết đom đóm.'); } else sfx.hit();
      if (!settings.reducedMotion) { $('flash').style.opacity = 1; setTimeout(() => ($('flash').style.opacity = 0), 250); shakeT = 0.35; }
      break;
    case 'dash': sfx.dash(); break;
    case 'shade_spawned': sfx.shade(); caption('⚠ Bóng Mực xuất hiện', 'warn'); shadeAlerts.push({ id: ev.data.id, until: performance.now() + 4000 }); break;
    case 'charm_picked': sfx.charm(); message('Bùa Gió! Chạy nhanh hơn, lướt không cần hồi.'); break;
    case 'drifter_steal': sfx.steal(); message(`Gió Lạc cướp mất ${ev.data.amount} đom đóm! Tỏa sáng để đòi lại.`); break;
    case 'drifter_drop': sfx.pickup(); message('Gió Lạc đánh rơi đom đóm!'); break;
    case 'game_over': endNight(ev.data); break;
  }
}
let msgTimer = 0;
const drainWarned = new Set();
function message(t) {
  if (BENCH) return; $('hud-msg').textContent = t; $('hud-msg').style.opacity = 1; clearTimeout(msgTimer); msgTimer = setTimeout(() => ($('hud-msg').style.opacity = 0), 2600); }

function endNight({ result, reason }) {
  mode = 'result'; stopMusic(); document.exitPointerLock?.();
  const won = result === 'won';
  if (won) { campaign.scores[night] = game.score; sfx.win(); } else sfx.lose();
  if (won && night === 3) {
    $('dawn-stats').innerHTML = [1, 2, 3].map((n) => `<span>Đêm ${n} · ${NIGHTS[n].name}</span><b>${campaign.scores[n] ?? '—'}</b>`).join('') + `<span>Tổng điểm</span><b>${totalScore()}</b>`;
    nameEntry($('scr-dawn').querySelector('.name-entry'));
    setTimeout(() => { show('scr-dawn'); $('hud').classList.add('hidden'); }, 900);
    return;
  }
  const litNow = game.lanterns.filter((l) => l.lit).length;
  const why = { dawn_survived: `Bình minh lên với ${litNow}/${game.lanterns.length} ngọn đèn còn sáng trên ${NIGHTS[night].name}.`, dawn: `Bình minh lên nhưng chỉ còn ${litNow} đèn sáng (cần ${game.winNeed}).`, no_flames: 'Mây đã mất hết Ngọn Lửa trong sương đen.' }[reason];
  $('res-title').textContent = won ? `Đêm ${night} hoàn thành!` : 'Chưa thành công…';
  $('res-why').textContent = why;
  const lit = game.lanterns.filter((l) => l.lit).length;
  $('res-stats').innerHTML = `<span>Đèn đã thắp</span><b>${lit}/${game.lanterns.length}</b><span>Ngọn Lửa còn lại</span><b>${Math.max(0, game.player.flames)}</b><span>Điểm Đêm này</span><b>${game.score}</b><span>Tổng điểm (các Đêm đã thắng)</span><b>${totalScore()}</b>`;
  $('res-main').textContent = won ? `Đêm ${night + 1}: ${NIGHTS[night + 1].name}` : `Chơi lại Đêm ${night}`;
  $('res-main').onclick = () => showIntro(won ? night + 1 : night);
  const ne = $('scr-result').querySelector('.name-entry');
  if (won) ne.innerHTML = ''; else nameEntry(ne); // after a loss the score so far can be saved
  setTimeout(() => show('scr-result'), 700);
}

// ---------- HUD ----------
const flameSvg = '<svg class="flame" viewBox="0 0 26 34"><path d="M13 1C15 9 23 12 23 21a10 10 0 0 1-20 0c0-5 3-8 5-10 0 4 2 6 3 6-1-6 1-11 2-16z" fill="#FFB347"/><path d="M13 14c2 4 5 6 5 9a5 5 0 0 1-10 0c0-3 3-5 5-9z" fill="#FFE9B0"/></svg>';
$('hud-bar').innerHTML = '<div class="cell"></div>'.repeat(T.capacity_max) + '<span id="hud-carry"></span>';
const cells = [...document.querySelectorAll('#hud-bar .cell')];
let lastSecond = null;
const proj = new THREE.Vector3();
// Minimap, heading-up: centred on Mây, the camera's forward direction always points up (matches the screen).
const mm = $('minimap'), mctx = mm.getContext('2d');
let mmLast = 0;
function drawMinimap() {
  const now = performance.now();
  if (BENCH || now - mmLast < 50) return; // 20 Hz is plenty; creative UI → off in the standard bench scene
  mmLast = now;
  const map = NIGHTS[night], W = mm.width, R = W / 2, sc = (R - 8) / 38; // ~38 m around Mây
  const p = game.player, fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx; // screen-right = −X at yaw 0
  const toWorld = () => mctx.setTransform(sc * rx, -sc * fx, sc * rz, -sc * fz, R - sc * (p.pos[0] * rx + p.pos[2] * rz), R + sc * (p.pos[0] * fx + p.pos[2] * fz));
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, W, W);
  mctx.save(); mctx.beginPath(); mctx.arc(R, R, R - 2, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = 'rgba(18,56,74,.6)'; mctx.fillRect(0, 0, W, W);
  toWorld();
  mctx.fillStyle = 'rgba(47,93,80,.95)'; mctx.strokeStyle = 'rgba(201,180,138,.9)'; mctx.lineWidth = 3 / sc;
  const disc = (x, z, r) => { mctx.beginPath(); mctx.arc(x, z, r, 0, Math.PI * 2); mctx.fill(); mctx.stroke(); };
  if (night === 2) { disc(0, 0, 28); disc(70, 0, 28); mctx.fillStyle = 'rgba(107,74,47,.95)'; mctx.fillRect(26, -2, 18, 4); }
  else disc(0, 0, map.boundR);
  if (night === 3) {
    mctx.fillStyle = 'rgba(66,120,104,.95)'; mctx.beginPath(); mctx.arc(0, 0, 24, 0, Math.PI, false); mctx.arc(0, 0, 12, Math.PI, 0, true); mctx.fill();
    mctx.fillStyle = 'rgba(86,138,120,1)'; mctx.beginPath(); mctx.arc(0, 0, 8, 0, Math.PI * 2); mctx.fill();
  }
  const LOW = T.low_fuel_threshold * 60, dot = (x, z, rPx, color) => { mctx.fillStyle = color; mctx.beginPath(); mctx.arc(x, z, rPx / sc, 0, Math.PI * 2); mctx.fill(); };
  for (const L of game.lanterns) {
    if (game.hasZone(L)) { mctx.strokeStyle = 'rgba(255,179,71,.55)'; mctx.lineWidth = 2 / sc; mctx.beginPath(); mctx.arc(L.pos[0], L.pos[2], T.safe_radius, 0, Math.PI * 2); mctx.stroke(); }
    dot(L.pos[0], L.pos[2], 7, L.lit ? (L.fuel < LOW ? (settings.colorblind ? '#FFFFFF' : '#FF5A5F') : '#FFB347') : '#5B5F6E');
  }
  const sc1 = settings.colorblind ? '#00B3FF' : '#7A3CFF';
  for (const s of game.shades) dot(s.pos[0], s.pos[2], 4.5, sc1);
  for (const d of game.drifters) if (d.state !== 'removed') dot(d.pos[0], d.pos[2], 4, '#8FA3B8');
  for (const c of game.charms) if (c.available) dot(c.pos[0], c.pos[2], 4, '#C8102E');
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  // view cone (always up) + Mây's facing arrow relative to the camera
  mctx.fillStyle = 'rgba(255,233,176,.16)'; mctx.beginPath(); mctx.moveTo(R, R); mctx.arc(R, R, 52, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); mctx.fill();
  const ax = p.facing[0] * rx + p.facing[1] * rz, ay = -(p.facing[0] * fx + p.facing[1] * fz);
  mctx.translate(R, R); mctx.rotate(Math.atan2(ay, ax)); mctx.fillStyle = '#F5F1E6';
  mctx.beginPath(); mctx.moveTo(11, 0); mctx.lineTo(-7, 7); mctx.lineTo(-3, 0); mctx.lineTo(-7, -7); mctx.closePath(); mctx.fill();
  mctx.restore();
}
let shadeAlerts = [], shakeT = 0;
const lowWarned = new Set();
// Show `el` at the screen edge pointing toward world position `pos` when it is off-screen; hide it otherwise.
function edgeArrow(el, pos) {
  let show = false;
  if (pos) {
    proj.set(pos[0], pos[1], pos[2]).project(camera);
    const behind = proj.z > 1;
    let x = proj.x, y = proj.y;
    if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 1 || Math.abs(y) > 1) {
      show = true;
      const ang = Math.atan2(y, x), m = Math.max(Math.abs(Math.cos(ang)) / 0.86, Math.abs(Math.sin(ang)) / 0.8);
      const sx = (Math.cos(ang) / m + 1) / 2 * innerWidth, sy = (1 - (Math.sin(ang) / m + 1) / 2) * innerHeight;
      el.style.left = `${sx - 14}px`; el.style.top = `${sy - 18}px`;
      el.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
    }
  }
  el.classList.toggle('hidden', !show);
}
// Captions (subtitles for sound cues), shown when the setting is on.
function caption(text, kind = 'info', ms = 3500) {
  if (!settings.captions || BENCH || mode !== 'playing') return;
  const box = $('captions');
  const el = document.createElement('div'); el.className = `caption ${kind}`; el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), ms);
}
const hudCache = new Map();
const setText = (id, v) => { if (hudCache.get(id) !== v) { hudCache.set(id, v); $(id).textContent = v; } };
function updateHud() {
  const p = game.player;
  if (hudCache.get('flames') !== p.flames) { hudCache.set('flames', p.flames); $('hud-flames').innerHTML = Array.from({ length: T.flames }, (_, i) => flameSvg.replace('class="flame"', `class="flame${i < p.flames ? '' : ' lost'}"`)).join(''); }
  const tl = Math.max(0, Math.ceil(game.timeLeft - 1e-9));
  const clock = $('hud-clock');
  setText('hud-clock', `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`);
  clock.classList.toggle('danger', tl <= 30);
  $('hud-top').classList.toggle('danger', tl <= 30);
  const frac = Math.max(0, game.timeLeft) / game.timeLeft0;
  const off = (100.5 * (1 - frac)).toFixed(1);
  if (hudCache.get('ring') !== off) { hudCache.set('ring', off); $('hud-ring').setAttribute('stroke-dashoffset', off); }
  const FM = T.fuel_max * 60, LOW = T.low_fuel_threshold * 60;
  const sig = game.lanterns.map((L) => `${L.lit ? 1 : 0}${Math.round(L.fuel / 600)}${L.deposited}`).join('|');
  if (hudCache.get('lrows') !== sig) {
    hudCache.set('lrows', sig);
    $('hud-lanterns').innerHTML = game.lanterns.map((L) => {
      const cls = L.lit ? (L.fuel < LOW ? 'weak' : 'lit') : 'off';
      const w = L.lit ? (100 * L.fuel) / FM : (100 * L.deposited) / (L.everLit ? T.relight_cost : T.lantern_cost);
      return `<div class="lrow ${cls}"><span class="dot"></span><span>${L.id}</span><span class="bar"><i style="width:${w.toFixed(0)}%"></i></span></div>`;
    }).join('');
  }
  if (mode === 'playing' && tl <= 10 && tl > 0 && tl !== lastSecond) { sfx.tick(); if (tl === 10) caption('⏳ Còn 10 giây tới bình minh', 'warn', 4000); }
  for (const L of game.lanterns) {
    const low = L.lit && L.fuel < T.low_fuel_threshold * 60;
    if (low && !lowWarned.has(L.id)) { lowWarned.add(L.id); caption(`🏮 Đèn ${L.id} sắp cạn dầu (dưới ${T.low_fuel_threshold})`, 'warn', 5000); }
    if (!low) lowWarned.delete(L.id);
  }
  lastSecond = tl;
  const lit = game.lanterns.filter((l) => l.lit).length;
  setText('hud-lit', `${lit}/${game.lanterns.length}`);
  setText('hud-need', `cần ${game.winNeed} lúc bình minh`);
  $('hud-need').classList.toggle('danger', lit < game.winNeed);
  setText('hud-score', String(game.score));
  const cap = game.capacity;
  cells.forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.classList.toggle('hidden', i >= cap); });
  setText('hud-carry', `${p.carried}/${cap}`);
  const dashCd = p.charm > 0 ? 0 : p.dashCd / Math.round(T.dash_cooldown_s * 60);
  $('cd-dash').style.setProperty('--cd', Math.min(1, dashCd).toFixed(3));
  $('cd-dash').classList.toggle('charm', p.charm > 0);
  const pulseCd = p.pulseCd / Math.round(T.pulse_cooldown_s * 60);
  $('cd-pulse').style.setProperty('--cd', (p.carried < T.pulse_cost ? 1 : Math.min(1, pulseCd)).toFixed(3));
  drawMinimap();
  $('hud-charm').classList.toggle('hidden', !(p.charm > 0));
  setText('hud-charm-s', `${Math.ceil(p.charm / 60)} s`);

  // prompt near an unlit lantern
  const FUELMAX = T.fuel_max * 60;
  const near = game.lanterns.filter((l) => (!l.lit || l.fuel < FUELMAX) && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius)
    .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]) || a.id.localeCompare(b.id))[0];
  const pr = $('hud-prompt');
  pr.classList.toggle('hidden', !near);
  const ik = keyLabel(settings.keys.interact);
  if (near) pr.textContent = near.lit ? `${ik} — Châm dầu (${Math.round(near.fuel / 60)}/${T.fuel_max})` : `${ik} — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`;

  // arrow toward the nearest unlit lantern when it is off-screen
  const needy = game.lanterns.filter((l) => l.lit && l.fuel < T.low_fuel_threshold * 60);
  const target = (needy.length ? needy : game.lanterns.filter((l) => !l.lit)).sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  edgeArrow($('hud-arrow'), target ? [target.pos[0], target.pos[1] + 3.7, target.pos[2]] : null);
  // edge arrows toward shades that just appeared (visual cue for the spawn sound), 4 s each
  const nowMs = performance.now();
  shadeAlerts = shadeAlerts.filter((a) => a.until > nowMs && game.shades.some((s) => s.id === a.id));
  const box = $('shade-arrows');
  while (box.children.length < shadeAlerts.length) { const d = document.createElement('div'); d.className = 'edge-arrow shade-arrow hidden'; box.appendChild(d); }
  [...box.children].forEach((el, i) => {
    const a = shadeAlerts[i], s = a && game.shades.find((x) => x.id === a.id);
    edgeArrow(el, s && settings.captions ? s.pos : null);
  });
}

// ---------- render ----------
const AMBIENT_SKY = new THREE.Color(C.sky), DAWN_SKY = new THREE.Color(0x3a3060);
let prevWarn = false;
function render(t, dt) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const facing = Math.atan2(p.facing[0], p.facing[1]);
  player.rotation.y += (((facing - player.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 14);
  player.visible = p.fallWait === 0 && !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);
  may.update(dt, { speed: Math.hypot(p.vel[0], p.vel[2]), grounded: p.grounded, vy: p.vy, dashing: p.dashLeft > 0, carried: p.carried, t });
  const gh = game.ground(p.pos[0], p.pos[2]);
  playerShadow.visible = player.visible && gh !== null && gh !== Infinity;
  if (playerShadow.visible) { playerShadow.position.set(p.pos[0], gh + 0.04, p.pos[2]); const hgt = Math.max(0, p.pos[1] - gh); playerShadow.scale.setScalar(1 / (1 + hgt * 0.35)); playerShadow.material.opacity = 1 / (1 + hgt * 0.5); }

  if (!BENCH && (mode === 'menu' || mode === 'intro')) {
    const map = NIGHTS[night], a = t * 0.06, R = map.boundR * 1.25;
    camera.position.set(map.center[0] + R * Math.cos(a), 26, map.center[1] + R * Math.sin(a));
    camera.lookAt(map.center[0], 0, map.center[1]);
  } else if (BENCH) {
    const c = benchCamera(bench.t0 == null ? 0 : (performance.now() - bench.t0) / 1000);
    camera.position.set(c[0], c[1], c[2]); camera.lookAt(0, 0, 0);
  } else {
    const camDist = 10, h = 6;
    const cx = p.pos[0] - Math.sin(camYaw) * camDist, cz = p.pos[2] - Math.cos(camYaw) * camDist;
    const cy = Math.max(p.pos[1], -6) + h;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
    camera.lookAt(p.pos[0], Math.max(p.pos[1], -6) + 1.4, p.pos[2]);
    if (shakeT > 0 && !settings.reducedMotion) { const a = 0.3 * (shakeT / 0.35); camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; }
    shakeT = Math.max(0, shakeT - dt);
  }

  let lit = 0;
  for (const L of game.lanterns) {
    const v = lanternViews.get(L.id);
    const fuel = L.fuel / 60, low = L.lit && fuel < T.low_fuel_threshold;
    const blink = low ? 0.55 + 0.45 * Math.cos(t * Math.PI * 2) : 1; // 1 Hz slow blink when fuel < 30
    v.glow += ((L.lit ? blink : 0) - v.glow) * Math.min(1, dt * (low ? 10 : 2));
    v.head.scale.set(1, (L.lit ? 1.25 : 1.25 * 0.8), 1); // out → squashed 20 %
    v.head.position.y = L.lit ? 3.7 : 3.55;
    v.tear.visible = v.tear2.visible = !L.lit;
    v.bar.visible = L.lit;
    if (L.lit) {
      v.bar.quaternion.copy(camera.quaternion);
      v.fill.scale.x = Math.max(0.001, fuel / T.fuel_max); v.fill.position.x = -0.75 * (1 - fuel / T.fuel_max);
      v.fillMat.color.setHex(low ? (settings.colorblind ? 0xffffff : C.danger) : C.lampOn);
      v.fillMat.opacity = low ? 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2)) : 1; // 1 Hz blink
    }
    const cost = L.everLit ? T.relight_cost : T.lantern_cost;
    v.headMat.color.setHex(C.lampOff).lerp(new THREE.Color(C.lampOn), v.glow);
    v.headMat.emissive.setHex(C.lampOn).multiplyScalar(0.9 * v.glow);
    v.core.material.opacity = v.glow;
    v.light.intensity = 40 * v.glow;
    v.halo.material.opacity = 0.75 * v.glow; v.halo.scale.setScalar(4.5 + Math.sin(t * 2 + L.pos[0]) * 0.3);
    v.pool.material.opacity = 0.28 * v.glow;
    v.ring.material.opacity = game.hasZone(L) ? 0.35 * v.glow : 0; // ring only while the lantern still has a safe zone (fuel >= 30)
    v.pips.forEach((pp, i) => { pp.visible = L.lit || i < cost; pp.material.color.setHex(L.lit || i < L.deposited ? C.lampOn : C.lampOff); });
    if (L.lit) lit++;
  }
  const k = lit / game.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * k;
  scene.fog.far = 140 + 60 * k;
  sky.update(t, k, camera); cloudSea.update(t); fireflies?.update(t);

  // motes (instanced cores + one Points draw for the halos)
  let nm = 0;
  const hp = haloGeo.attributes.position.array;
  for (const m of game.motes) {
    if (nm >= MAX_MOTES) break;
    if (m.kind === 'dropped' && m.ttl <= 120 && Math.floor(t * 8) % 2 === 1) continue; // dropped motes blink before vanishing
    const ph = parseInt(m.id.slice(1), 10);
    _v.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, m.pos[1] + 0.9 + Math.sin(t * 2 + ph) * 0.25, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
    _m.makeTranslation(_v.x, _v.y, _v.z); moteCores.setMatrixAt(nm, _m);
    hp[nm * 3] = _v.x; hp[nm * 3 + 1] = _v.y; hp[nm * 3 + 2] = _v.z;
    nm++;
  }
  moteCores.count = nm; moteCores.instanceMatrix.needsUpdate = true;
  haloGeo.setDrawRange(0, nm); haloGeo.attributes.position.needsUpdate = true;

  // shades (instanced body, outline and eyes)
  let ns = 0;
  const seenShades = new Set(), edgeHex = shadeEdgeColor(), k2 = Math.min(1, dt * 6);
  for (const s of game.shades) {
    if (ns >= MAX_SHADES) break;
    seenShades.add(s.id);
    const stunned = s.state === 'stunned';
    const target = (s.state === 'spawning' ? 0.3 : 1) * (stunned ? 0.85 : 1);
    const sc = (shadeAnim.get(s.id) ?? 0.01) + (target - (shadeAnim.get(s.id) ?? 0.01)) * k2;
    shadeAnim.set(s.id, sc);
    let fx = p.pos[0], fz = p.pos[2];
    if (s.state === 'drain') { const L = game.lanterns.find((l) => l.id === s.drainId); if (L) { fx = L.pos[0]; fz = L.pos[2]; } }
    _q.setFromAxisAngle(_up, Math.atan2(fx - s.pos[0], fz - s.pos[2]));
    const sq = stunned ? 0.75 + Math.sin(t * 20) * 0.08 : 1 + Math.sin(t * 4) * 0.06;
    if (s.state === 'drain') _s.set(0.85 * sc, (1.15 + Math.sin(t * 9) * 0.06) * sc, 1.25 * sc); else _s.set(sc / sq, sc * sq, sc / sq);
    _v.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.id.length) * 0.15, s.pos[2]);
    _m.compose(_v, _q, _s);
    shadeBodies.setMatrixAt(ns, _m); shadeEdges.setMatrixAt(ns, _m);
    _e.makeTranslation(s.pos[0], s.pos[1] - 0.96, s.pos[2]); shadeShadows.setMatrixAt(ns, _e);
    for (let e = 0; e < 2; e++) { _e.makeTranslation(EYE_OFFSETS[e].x, EYE_OFFSETS[e].y, EYE_OFFSETS[e].z).premultiply(_m); shadeEyes.setMatrixAt(ns * 2 + e, _e); }
    _c.setHex(stunned ? C.shadeStun : C.shadeBody); shadeBodies.setColorAt(ns, _c);
    // outline strength by state (was material opacity): blend the outline colour toward the body colour
    const glow = stunned ? 0.3 : s.state === 'recoil' ? 0.5 : s.state === 'drain' ? 0.6 + 0.4 * Math.sin(t * 9) : 0.9;
    _c2.setHex(edgeHex).lerp(_c, 1 - glow); shadeEdges.setColorAt(ns, _c2);
    ns++;
  }
  for (const id of shadeAnim.keys()) if (!seenShades.has(id)) shadeAnim.delete(id);
  shadeBodies.count = shadeEdges.count = shadeShadows.count = ns; shadeEyes.count = ns * 2;
  for (const im of [shadeBodies, shadeEdges, shadeEyes, shadeShadows]) im.instanceMatrix.needsUpdate = true;
  if (ns) { shadeBodies.instanceColor.needsUpdate = true; shadeEdges.instanceColor.needsUpdate = true; }
  sync(drifterViews, game.drifters.filter((d) => d.state !== 'removed'), makeDrifter);
  for (const d of game.drifters) {
    const v = drifterViews.get(d.id); if (!v) continue;
    v.g.position.set(d.pos[0], d.pos[1], d.pos[2]);
    v.g.rotation.y = t * (d.state === 'chase' ? 4 : 1.5);
    const pos = v.m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(v.base[i * 3 + 1] * 2.2 + t * 7) * 0.35);
    pos.needsUpdate = true;
    v.m.material.opacity = d.state === 'flee' ? 0.45 + 0.4 * Math.abs(Math.sin(t * 10)) : 0.85;
    v.m.scale.setScalar(1 + 0.12 * d.stolen);
  }
  sync(charmViews, game.charms, makeCharm);
  for (const c of game.charms) {
    const v = charmViews.get(c.id);
    v.g.visible = c.available;
    v.g.position.set(c.pos[0], c.pos[1] + 1.1 + Math.sin(t * 2) * 0.15, c.pos[2]);
    v.g.rotation.y = t * 1.6;
  }
  if (world?.userData.pads) for (const pd of world.userData.pads) pd.userData.glow.material.opacity = 0.5 + 0.4 * Math.sin(t * 4);
  if (world?.userData.bell) world.userData.bell.rotation.z = Math.sin(t * 1.2) * 0.15;

  // wind: leaves fly for the 2 s warning and the 5 s gust
  const w = game.wind;
  leaves.visible = !!(w.warn || w.active) && w.dir != null;
  if (w.warn && !prevWarn && mode === 'playing') { sfx.wind(); message('Gió mạnh sắp tới!'); caption('🍃 Gió mạnh sắp thổi (2 giây)', 'warn'); }
  prevWarn = w.warn;
  if (leaves.visible) {
    const a = (w.dir * Math.PI) / 180, sp = w.active ? 9 : 4;
    for (let i = 0; i < leafState.length; i++) {
      const L = leafState[i], u = ((t * sp * L.s + i * 3.1) % 30) - 15;
      leafE.set(t * 3 + i, t * 2 + i, 0); leafQ.setFromEuler(leafE);
      leafM.compose(new THREE.Vector3(p.pos[0] + L.o[0] * 0.6 + Math.cos(a) * u, p.pos[1] + L.o[1], p.pos[2] + L.o[2] * 0.6 + Math.sin(a) * u), leafQ, new THREE.Vector3(1, 1, 1));
      leaves.setMatrixAt(i, leafM);
    }
    leaves.instanceMatrix.needsUpdate = true;
  }

  for (let i = pulses.length - 1; i >= 0; i--) {
    const pu = pulses[i]; pu.t += dt;
    const s = 1 + (T.pulse_radius - 1) * Math.min(1, pu.t / 0.35);
    pu.m.scale.set(s, s, s); pu.m.material.opacity = 0.9 * (1 - pu.t / 0.6);
    if (pu.t > 0.6) { scene.remove(pu.m); pulses.splice(i, 1); }
  }
  updateHud();
}

// ---------- loop ----------
let fpsFrames = 0, fpsT = performance.now(), fpsLog = [];
window.__resetFps = () => { fpsLog = []; };
const bench = { t0: null, last: null, dts: [], done: false };
function benchTick(now) {
  if (bench.t0 == null) { bench.t0 = now; bench.last = now; window.__bench = { done: false, firstFrameEpoch: performance.timeOrigin + now }; return; }
  const dt = now - bench.last; bench.last = now;
  const el = (now - bench.t0) / 1000;
  if (el > benchCfg.warmup && el <= benchCfg.warmup + benchCfg.duration) bench.dts.push(dt);
  if (el > benchCfg.warmup + benchCfg.duration && !bench.done) {
    bench.done = true;
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    Object.assign(window.__bench, { done: true, dts: bench.dts, three: THREE.REVISION, gl: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      viewport: `${innerWidth}x${innerHeight}`, pixelRatio: renderer.getPixelRatio(), shades: game.shades.length, motes: game.motes.length, lit: game.lanterns.filter((l) => l.lit).map((l) => l.id) });
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (keys.has('KeyZ')) camYaw += 1.8 * dt * settings.sens;
  if (keys.has('KeyC')) camYaw -= 1.8 * dt * settings.sens;
  if (game && mode === 'playing') {
    acc += dt;
    while (acc >= DT && mode === 'playing') {
      acc -= DT;
      const input = readInput();
      const wasGrounded = game.player.grounded;
      for (const ev of game.step(input)) onEvent(ev);
      if (wasGrounded && !game.player.grounded && game.player.vy > 6 && !game.player.launch) sfx.jump();
      if (game.lastPulse) spawnPulse(game.lastPulse.pos);
    }
  }
  if (game) render(now / 1000, dt);
  renderer.render(scene, camera);
  if (BENCH) benchTick(performance.now());
  fpsFrames++;
  if (now - fpsT >= 1000) {
    const fps = (fpsFrames * 1000) / (now - fpsT); fpsFrames = 0; fpsT = now;
    if (mode === 'playing') fpsLog.push(fps);
    const avg = fpsLog.length ? fpsLog.reduce((a, b) => a + b, 0) / fpsLog.length : fps;
    $('fps').textContent = `${fps.toFixed(0)} FPS · TB ${avg.toFixed(1)} · ${innerWidth}×${innerHeight}`;
    window.__fps = { now: fps, avg, samples: fpsLog.length };
  }
}

// idle scene behind the menu; URL options for screenshots / proof: ?night=2&autostart&seed=7&scenario=/tests/scenarios/x.json&fps
newGame(Number(params.get('night')) || 1);
if (params.has('fps')) $('fps').classList.remove('hidden');
if (BENCH) $('minimap').classList.add('hidden');
window.__showIntro = showIntro; // used by scripts/screens.js
if (params.has('cb')) settings.colorblind = true;
if (params.has('large')) settings.largeText = true;
applyColorblind();
applyA11y();
renderNightCards();
window.__showLeaderboard = showLeaderboard; window.__openSettings = () => openSettings('scr-menu');
if (params.has('autostart') || BENCH) { show(null); mode = 'playing'; $('hud').classList.remove('hidden'); }
requestAnimationFrame(frame);
