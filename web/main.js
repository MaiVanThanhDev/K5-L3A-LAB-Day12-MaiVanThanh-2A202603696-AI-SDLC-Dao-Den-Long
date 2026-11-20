// 3D client: renders the shared deterministic sim (src/sim/game.js). No gameplay rules live here.
// Flow: menu → night intro → play → result → next night … → Bình Minh. Pause / settings / audio / HUD.
import * as THREE from 'three';
import { Game, DT, NIGHTS } from '/src/sim/game.js';
import { sfx, unlock, setVolume, startMusic, stopMusic } from '/web/audio.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const params = new URLSearchParams(location.search);

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
  for (const v of shadeViews.values()) { v.edgeMat.color.setHex(shadeEdgeColor()); v.eyeMat.color.setHex(shadeEdgeColor()); }
}

// ---------- settings (persisted) ----------
const settings = { volume: 0.7, sens: 1, colorblind: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch { /* storage unavailable */ }
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
{
  const g = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.45 * Math.PI + 0.05, r = 300;
    pts.push(r * Math.cos(e) * Math.cos(a), r * Math.sin(e), r * Math.cos(e) * Math.sin(a));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6c2, size: 1.1, fog: false })));
}
const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshLambertMaterial({ color: C.sea }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -9; scene.add(sea);

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = { grass: mat(C.grass), sand: mat(C.sand), wood: mat(C.wood), stone: mat(C.stone), cliff: mat(0x3d4a52) };

// ---------- world building per night ----------
let world = null; // THREE.Group of static geometry for the current night
function island(r, cx = 0, cz = 0, depth = 6) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r - 2.5, r - 2.5, 0.2, 64), M.grass);
  top.position.y = -0.1; g.add(top);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 64, 1, true), M.sand);
  const sand = new THREE.Mesh(new THREE.RingGeometry(r - 2.5, r, 64), M.sand);
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.01; g.add(sand); rim.position.y = -0.1; g.add(rim);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, depth, 48), M.cliff);
  body.position.y = -depth / 2 - 0.2; g.add(body);
  g.position.set(cx, 0, cz);
  return g;
}
function decorate(g, n, rMin, rMax, cx = 0, cz = 0, avoid = () => false) {
  const rock = new THREE.DodecahedronGeometry(0.6), trunk = new THREE.CylinderGeometry(0.12, 0.18, 2.2, 6), leaf = new THREE.ConeGeometry(1.1, 2.2, 7);
  const leafMat = mat(0x24493f);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r = rMin + ((i * 7919) % 100) / 100 * (rMax - rMin);
    const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
    if (avoid(x, z)) continue;
    if (i % 3 === 0) {
      const t = new THREE.Group();
      const tr = new THREE.Mesh(trunk, M.wood); tr.position.y = 1.1; t.add(tr);
      const lf = new THREE.Mesh(leaf, leafMat); lf.position.y = 2.8; t.add(lf);
      t.position.set(x, 0, z); g.add(t);
    } else {
      const m = new THREE.Mesh(rock, M.stone); m.scale.setScalar(0.6 + (i % 4) * 0.35); m.position.set(x, 0.1, z); g.add(m);
    }
  }
}
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
  world.userData.pads = [];
  if (n === 1) {
    world.add(island(40));
    decorate(world, 60, 27, 37, 0, 0, (x, z) => map.lanterns.some((l) => Math.hypot(x - l[0], z - l[2]) < 4));
  } else if (n === 2) {
    world.add(island(28, 0, 0)); world.add(island(28, 70, 0));
    const bridge = new THREE.Group();
    for (let x = 26; x < 44; x += 0.6) { const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 4), M.wood); plank.position.set(x + 0.3, -0.08, 0); bridge.add(plank); }
    for (const z of [-2.1, 2.1]) { const rope = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 0.08), mat(0xc9b48a)); rope.position.set(35, -0.05, z); bridge.add(rope); }
    world.add(bridge);
    for (const cx of [0, 70]) decorate(world, 30, 16, 26, cx, 0, (x, z) => map.lanterns.some((l) => Math.hypot(x - l[0], z - l[2]) < 4) || map.pads.some((p) => Math.hypot(x - p.pos[0], z - p.pos[2]) < 3) || (Math.abs(z) < 4 && Math.abs(x - 35) < 12));
    for (const p of map.pads) world.userData.pads.push(pad(world, p.pos, [p.toward[0] - p.pos[0], p.toward[1] - p.pos[2]]));
  } else {
    world.add(island(45));
    // tier 1: half annulus 12–24 m on z > 0, height 3 (shape v = −z so that rotateX(−90°) lands it on z > 0)
    const pts = [];
    for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI; pts.push(new THREE.Vector2(24 * Math.cos(a), -24 * Math.sin(a))); }
    for (let i = 32; i >= 0; i--) { const a = (i / 32) * Math.PI; pts.push(new THREE.Vector2(12 * Math.cos(a), -12 * Math.sin(a))); }
    const t1 = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 3, bevelEnabled: false, curveSegments: 32 });
    t1.rotateX(-Math.PI / 2);
    world.add(new THREE.Mesh(t1, [M.grass, M.cliff]));
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [M.cliff, M.grass, M.cliff]);
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
    decorate(world, 50, 30, 42, 0, 0, (x, z) => map.lanterns.some((l) => Math.hypot(x - l[0], z - l[2]) < 4) || map.ramps.some((a) => Math.hypot(x - 27 * Math.cos(a * Math.PI / 180), z - 27 * Math.sin(a * Math.PI / 180)) < 5) || map.charms.some((c) => Math.hypot(x - c[0], z - c[2]) < 3));
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
  return { g, head, headMat, core, light, ring, pips, glow: 0, tear, tear2, bar, fill, fillMat };
}

// ---------- player: Mây (áo trắng ngà, khăn đỏ, nón lá + đèn lồng nhỏ) ----------
const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 12), mat(C.robe)); body.position.y = 0.75; player.add(body);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 16), mat(C.scarf)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.2; player.add(scarf);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.04), mat(C.scarf)); tail.position.set(0.12, 1.0, -0.3); tail.rotation.x = 0.4; player.add(tail);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat(0xf2c9a0)); face.position.y = 1.45; player.add(face);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.38, 24), mat(C.sand)); hat.position.y = 1.78; player.add(hat);
  const mini = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: C.lampOn })); mini.position.set(0, 1.22, 0.64); player.add(mini);
  const pl = new THREE.PointLight(C.lampOn, 2, 10, 1.6); pl.position.set(0, 1.4, 0.6); player.add(pl);
  player.userData = { pl, tail };
}
scene.add(player);

// ---------- motes, shades, drifters, charms (pooled by id) ----------
const moteGeo = new THREE.SphereGeometry(0.13, 8, 6), moteMat = new THREE.MeshBasicMaterial({ color: C.moteCore });
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,229,138,1)'); g.addColorStop(0.4, 'rgba(255,229,138,.45)'); g.addColorStop(1, 'rgba(255,229,138,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const haloMat = new THREE.SpriteMaterial({ map: haloTex, color: C.moteHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
function makeMote() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, moteMat));
  const h = new THREE.Sprite(haloMat); h.scale.setScalar(0.9); g.add(h);
  scene.add(g); return { g };
}
const shadeGeo = new THREE.SphereGeometry(0.9, 18, 12), edgeGeo = new THREE.SphereGeometry(0.98, 18, 12);
function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: C.shadeBody });
  const blob = new THREE.Mesh(shadeGeo, bodyMat); g.add(blob);
  const edgeMat = new THREE.MeshBasicMaterial({ color: shadeEdgeColor(), side: THREE.BackSide, transparent: true, opacity: 0.85 });
  const edge = new THREE.Mesh(edgeGeo, edgeMat); g.add(edge);
  const eyeMat = new THREE.MeshBasicMaterial({ color: shadeEdgeColor() });
  for (const sx of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeMat);
    eye.position.set(sx, 0.2, 0.8); g.add(eye);
  }
  g.scale.setScalar(0.01);
  scene.add(g); return { g, bodyMat, edgeMat, eyeMat, blob, edge, born: performance.now() };
}
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
const moteViews = new Map(), shadeViews = new Map(), drifterViews = new Map(), charmViews = new Map();
function sync(views, items, make) {
  const seen = new Set();
  for (const it of items) { seen.add(it.id); if (!views.has(it.id)) views.set(it.id, make(it)); }
  for (const [id, v] of views) if (!seen.has(id)) { scene.remove(v.g); views.delete(id); }
}
function clearViews() {
  for (const views of [moteViews, shadeViews, drifterViews, charmViews, lanternViews]) { for (const v of views.values()) scene.remove(v.g); views.clear(); }
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
  keys.add(e.code);
  if (['Space', 'ShiftLeft', 'ShiftRight', 'Tab'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
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
  // Contract: move = [x, z], z+ = camera forward. With yaw 0 the camera looks along +Z, so screen-right is world −X.
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x -= 1;
  return {
    move: [x, z], cam_yaw_deg: (camYaw * 180) / Math.PI,
    jump: keys.has('Space'), interact: keys.has('KeyE'),
    pulse: keys.has('KeyQ') || (mouseDown && document.pointerLockElement === renderer.domElement),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), pause: false,
  };
}

// ---------- flow ----------
const $ = (id) => document.getElementById(id);
const screens = ['scr-menu', 'scr-intro', 'scr-pause', 'scr-settings', 'scr-result', 'scr-dawn'];
const show = (id) => { for (const s of screens) $(s).classList.toggle('hidden', s !== id); };
const INTRO = {
  1: 'Mây ơi, sương đen tràn qua bến rồi. Năm ngọn đèn lớn đang chờ cháu, mỗi ngọn cần mười đốm sáng. Đèn sáng thì Bóng Mực không dám lại gần.',
  2: 'Đảo Cau là hai hòn đảo nối bằng cây cầu tre cũ, không có lan can đâu. Bục đá gió sẽ bắn cháu bay qua biển mây. Coi chừng Gió Lạc, chúng thích cướp đom đóm của người mang nặng.',
  3: 'Tháp chuông đứng giữa ba tầng đá. Gió mạnh thổi từng cơn, lá bay báo trước hai giây. Thắp đủ bảy ngọn đèn, bình minh sẽ về.',
};
let mode = 'menu', game = null, night = 1, acc = 0, last = performance.now();
let campaign = { scores: {} }; // won night → score
const totalScore = () => Object.values(campaign.scores).reduce((a, b) => a + b, 0);
const urlScenario = params.get('scenario') ? await (await fetch(params.get('scenario'))).json() : null;

function newGame(n) {
  clearViews();
  night = n;
  buildWorld(n);
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() & 0x7fffffff);
  game = new Game({ tuning: T, seed, night: n, scenario: urlScenario });
  for (const L of game.lanterns) lanternViews.set(L.id, makeLantern(L));
  camYaw = Math.atan2(game.player.facing[0], game.player.facing[1]);
  if (params.has('yaw')) camYaw = (Number(params.get('yaw')) * Math.PI) / 180;
  acc = 0; lastSecond = null;
  $('hud-night').textContent = `Đêm ${n} · ${NIGHTS[n].name}`;
}
function showIntro(n) {
  newGame(n);
  $('intro-num').textContent = `Đêm ${n} / 3`;
  $('intro-name').textContent = NIGHTS[n].name;
  $('intro-quote').textContent = `Ông Đăng: “${INTRO[n]}”`;
  $('intro-goal').textContent = `Giữ ít nhất ${game.winNeed}/${game.lanterns.length} đèn sáng tới bình minh (${Math.round(game.timeLeft0 / 60 * 10) / 10} phút). Đèn cạn dầu sẽ tắt — châm thêm đom đóm để giữ lửa.`;
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
function renderSettings() { $('set-vol-o').textContent = `${Math.round(settings.volume * 100)}%`; $('set-sens-o').textContent = `${Number(settings.sens).toFixed(1)}×`; $('set-cb').checked = !!settings.colorblind; }
$('set-cb').addEventListener('change', (e) => { settings.colorblind = e.target.checked; applyColorblind(); saveSettings(); sfx.click(); });
$('set-vol').addEventListener('input', (e) => { settings.volume = e.target.value / 100; setVolume(settings.volume); renderSettings(); saveSettings(); });
$('set-vol').addEventListener('change', () => sfx.click());
$('set-sens').addEventListener('input', (e) => { settings.sens = Number(e.target.value); renderSettings(); saveSettings(); });
$('btn-settings-back').addEventListener('click', () => show(settingsBack));
$('btn-menu-settings').addEventListener('click', () => openSettings('scr-menu'));
$('btn-pause-settings').addEventListener('click', () => openSettings('scr-pause'));
$('btn-play').addEventListener('click', () => { unlock(); campaign = { scores: {} }; showIntro(1); });
$('btn-intro-go').addEventListener('click', play);
$('btn-resume').addEventListener('click', resume);
$('btn-restart').addEventListener('click', () => showIntro(night));
$('btn-tomenu').addEventListener('click', toMenu);
$('res-menu').addEventListener('click', toMenu);
$('btn-dawn-menu').addEventListener('click', toMenu);
function toMenu() { stopMusic(); mode = 'menu'; $('hud').classList.add('hidden'); show('scr-menu'); }

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
      $('flash').style.opacity = 1; setTimeout(() => ($('flash').style.opacity = 0), 250);
      break;
    case 'dash': sfx.dash(); break;
    case 'shade_spawned': sfx.shade(); break;
    case 'charm_picked': sfx.charm(); message('Bùa Gió! Chạy nhanh hơn, lướt không cần hồi.'); break;
    case 'drifter_steal': sfx.steal(); message(`Gió Lạc cướp mất ${ev.data.amount} đom đóm! Tỏa sáng để đòi lại.`); break;
    case 'drifter_drop': sfx.pickup(); message('Gió Lạc đánh rơi đom đóm!'); break;
    case 'game_over': endNight(ev.data); break;
  }
}
let msgTimer = 0;
const drainWarned = new Set();
function message(t) { $('hud-msg').textContent = t; $('hud-msg').style.opacity = 1; clearTimeout(msgTimer); msgTimer = setTimeout(() => ($('hud-msg').style.opacity = 0), 2600); }

function endNight({ result, reason }) {
  mode = 'result'; stopMusic(); document.exitPointerLock?.();
  const won = result === 'won';
  if (won) { campaign.scores[night] = game.score; sfx.win(); } else sfx.lose();
  if (won && night === 3) {
    $('dawn-stats').innerHTML = [1, 2, 3].map((n) => `<span>Đêm ${n} · ${NIGHTS[n].name}</span><b>${campaign.scores[n] ?? '—'}</b>`).join('') + `<span>Tổng điểm</span><b>${totalScore()}</b>`;
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
  setTimeout(() => show('scr-result'), 700);
}

// ---------- HUD ----------
const flameSvg = '<svg class="flame" viewBox="0 0 26 34"><path d="M13 1C15 9 23 12 23 21a10 10 0 0 1-20 0c0-5 3-8 5-10 0 4 2 6 3 6-1-6 1-11 2-16z" fill="#FFB347"/><path d="M13 14c2 4 5 6 5 9a5 5 0 0 1-10 0c0-3 3-5 5-9z" fill="#FFE9B0"/></svg>';
$('hud-bar').innerHTML = '<div class="cell"></div>'.repeat(T.capacity_max) + '<span id="hud-carry"></span>';
const cells = [...document.querySelectorAll('#hud-bar .cell')];
let lastSecond = null;
const proj = new THREE.Vector3();
function updateHud() {
  const p = game.player;
  $('hud-flames').innerHTML = Array.from({ length: T.flames }, (_, i) => flameSvg.replace('class="flame"', `class="flame${i < p.flames ? '' : ' lost'}"`)).join('');
  const tl = Math.max(0, Math.ceil(game.timeLeft - 1e-9));
  const clock = $('hud-clock');
  clock.textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`;
  clock.classList.toggle('danger', tl <= 30);
  if (mode === 'playing' && tl <= 10 && tl > 0 && tl !== lastSecond) { sfx.tick(); }
  lastSecond = tl;
  const lit = game.lanterns.filter((l) => l.lit).length;
  $('hud-lit').textContent = `${lit}/${game.lanterns.length}`;
  $('hud-need').textContent = `cần ${game.winNeed} lúc bình minh`;
  $('hud-need').classList.toggle('danger', lit < game.winNeed);
  $('hud-score').textContent = game.score;
  const cap = game.capacity;
  cells.forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.classList.toggle('hidden', i >= cap); });
  $('hud-carry').textContent = `${p.carried}/${cap}`;
  const dashCd = p.charm > 0 ? 0 : p.dashCd / Math.round(T.dash_cooldown_s * 60);
  $('cd-dash').querySelector('.shade').style.height = `${Math.min(1, dashCd) * 100}%`;
  $('cd-dash').classList.toggle('charm', p.charm > 0);
  const pulseCd = p.pulseCd / Math.round(T.pulse_cooldown_s * 60);
  $('cd-pulse').querySelector('.shade').style.height = `${p.carried < T.pulse_cost ? 100 : Math.min(1, pulseCd) * 100}%`;
  $('hud-charm').classList.toggle('hidden', !(p.charm > 0));
  $('hud-charm-s').textContent = `${Math.ceil(p.charm / 60)} s`;

  // prompt near an unlit lantern
  const FUELMAX = T.fuel_max * 60;
  const near = game.lanterns.filter((l) => (!l.lit || l.fuel < FUELMAX) && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius)
    .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]) || a.id.localeCompare(b.id))[0];
  const pr = $('hud-prompt');
  pr.classList.toggle('hidden', !near);
  if (near) pr.textContent = near.lit ? `E — Châm dầu (${Math.round(near.fuel / 60)}/${T.fuel_max})` : `E — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`;

  // arrow toward the nearest unlit lantern when it is off-screen
  const needy = game.lanterns.filter((l) => l.lit && l.fuel < T.low_fuel_threshold * 60);
  const target = (needy.length ? needy : game.lanterns.filter((l) => !l.lit)).sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  const arrow = $('hud-arrow');
  let showArrow = false;
  if (target) {
    proj.set(target.pos[0], target.pos[1] + 3.7, target.pos[2]).project(camera);
    const behind = proj.z > 1;
    let x = proj.x, y = proj.y;
    if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 1 || Math.abs(y) > 1) {
      showArrow = true;
      const ang = Math.atan2(y, x), m = Math.max(Math.abs(Math.cos(ang)) / 0.86, Math.abs(Math.sin(ang)) / 0.8);
      const sx = (Math.cos(ang) / m + 1) / 2 * innerWidth, sy = (1 - (Math.sin(ang) / m + 1) / 2) * innerHeight;
      arrow.style.left = `${sx - 14}px`; arrow.style.top = `${sy - 18}px`;
      arrow.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
    }
  }
  arrow.classList.toggle('hidden', !showArrow);
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
  player.userData.pl.intensity = 1.2 + 0.25 * p.carried;
  player.userData.tail.rotation.x = 0.4 + Math.min(1.1, Math.hypot(p.vel[0], p.vel[2]) / 8) + Math.sin(t * 12) * 0.08;

  const camDist = 10, h = 6;
  const cx = p.pos[0] - Math.sin(camYaw) * camDist, cz = p.pos[2] - Math.cos(camYaw) * camDist;
  const cy = Math.max(p.pos[1], -6) + h;
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
  camera.lookAt(p.pos[0], Math.max(p.pos[1], -6) + 1.4, p.pos[2]);

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
    v.ring.material.opacity = game.hasZone(L) ? 0.35 * v.glow : 0; // ring only while the lantern still has a safe zone (fuel >= 30)
    v.pips.forEach((pp, i) => { pp.visible = L.lit || i < cost; pp.material.color.setHex(L.lit || i < L.deposited ? C.lampOn : C.lampOff); });
    if (L.lit) lit++;
  }
  const k = lit / game.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * k;
  scene.background.copy(AMBIENT_SKY).lerp(DAWN_SKY, k * 0.6);
  scene.fog.far = 130 + 60 * k;

  sync(moteViews, game.motes, makeMote);
  for (const m of game.motes) {
    const v = moteViews.get(m.id), ph = parseInt(m.id.slice(1), 10);
    v.g.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, m.pos[1] + 0.9 + Math.sin(t * 2 + ph) * 0.25, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
    v.g.visible = m.kind !== 'dropped' || m.ttl > 120 || Math.floor(t * 8) % 2 === 0; // dropped motes blink before vanishing
  }
  sync(shadeViews, game.shades, makeShade);
  for (const s of game.shades) {
    const v = shadeViews.get(s.id), stunned = s.state === 'stunned';
    v.g.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.id.length) * 0.15, s.pos[2]);
    v.g.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const grow = s.state === 'spawning' ? 0.3 : 1;
    const target = grow * (stunned ? 0.85 : 1);
    v.g.scale.setScalar(v.g.scale.x + (target - v.g.scale.x) * Math.min(1, dt * 6));
    const sq = stunned ? 0.75 + Math.sin(t * 20) * 0.08 : 1 + Math.sin(t * 4) * 0.06;
    v.blob.scale.set(1 / sq, sq, 1 / sq); v.edge.scale.copy(v.blob.scale);
    v.bodyMat.color.setHex(stunned ? C.shadeStun : C.shadeBody);
    v.edgeMat.opacity = stunned ? 0.3 : s.state === 'recoil' ? 0.5 : s.state === 'drain' ? 0.6 + 0.4 * Math.sin(t * 9) : 0.85;
    if (s.state === 'drain') { const L = game.lanterns.find((l) => l.id === s.drainId); if (L) v.g.lookAt(L.pos[0], s.pos[1], L.pos[2]); v.blob.scale.set(0.85, 1.15 + Math.sin(t * 9) * 0.06, 1.25); }
  }
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
  if (w.warn && !prevWarn && mode === 'playing') { sfx.wind(); message('Gió mạnh sắp tới!'); }
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
window.__showIntro = showIntro; // used by scripts/screens.js
if (params.has('cb')) settings.colorblind = true;
applyColorblind();
if (params.has('autostart')) { show(null); mode = 'playing'; $('hud').classList.remove('hidden'); }
requestAnimationFrame(frame);
