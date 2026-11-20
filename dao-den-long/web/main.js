// 3D client: renders the shared deterministic sim (src/sim/game.js). No gameplay rules live here.
import * as THREE from 'three';
import { Game, DT, ISLAND_RADIUS } from '/src/sim/game.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x120a24), WARM = new THREE.Color(0x3a2440);
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(0x1a0f2e, 0.03);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const hemi = new THREE.HemisphereLight(0x6a5aa8, 0x1a1030, 0.35);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9aa6ff, 0.25);
moon.position.set(-30, 50, -20); moon.castShadow = true;
scene.add(moon);

// stars
{
  const g = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 600; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.45 * Math.PI + 0.05, r = 180;
    pts.push(r * Math.cos(e) * Math.sin(a), r * Math.sin(e), r * Math.cos(e) * Math.cos(a));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1d0, size: 0.9, fog: false })));
}

// island + sea of clouds
const islandMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.95 });
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 6, 4, 64), islandMat);
island.position.y = -2; island.receiveShadow = true; scene.add(island);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshStandardMaterial({ color: 0x3b2a5c, roughness: 1 }));
clouds.rotation.x = -Math.PI / 2; clouds.position.y = -8; scene.add(clouds);
// a few rocks / grass tufts for shape
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2 + Math.sin(i * 7.3) * 0.2, r = 30 + (i % 5) * 2;
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.4), islandMat);
  m.position.set(r * Math.sin(a), 0.2, r * Math.cos(a)); m.castShadow = true; scene.add(m);
}

// ---------- lanterns ----------
const lanternViews = new Map();
function makeLantern(L) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x4a3324 }));
  post.position.y = 1.6; post.castShadow = true; g.add(post);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x5a3a6a, emissive: 0x000000, roughness: 0.5 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), headMat);
  head.scale.y = 1.25; head.position.y = 3.7; g.add(head);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x8a2a2a }));
  cap.position.y = 4.75; g.add(cap);
  const light = new THREE.PointLight(0xffb347, 0, 26, 1.6); light.position.y = 3.7; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  // progress pips (one per required mote)
  const pips = [];
  for (let i = 0; i < T.lantern_cost; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x55406a }));
    const a = (i / T.lantern_cost) * Math.PI * 2; p.position.set(Math.sin(a) * 1.1, 2.6, Math.cos(a) * 1.1); g.add(p); pips.push(p);
  }
  g.position.set(L.pos[0], L.pos[1], L.pos[2]);
  scene.add(g);
  return { g, headMat, light, ring, pips, glow: 0 };
}

// ---------- player (Mây, nón lá + đèn lồng nhỏ) ----------
const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 12), new THREE.MeshStandardMaterial({ color: 0x3f7fbf }));
  body.position.y = 0.75; body.castShadow = true; player.add(body);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2c9a0 }));
  face.position.y = 1.45; player.add(face);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.38, 24), new THREE.MeshStandardMaterial({ color: 0xe6c27a, roughness: 0.8 }));
  hat.position.y = 1.78; hat.castShadow = true; player.add(hat);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  string.position.set(0, 1.45, 0.62); player.add(string);
  const mini = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff8a2a, emissiveIntensity: 1.6 }));
  mini.position.set(0, 1.22, 0.62); player.add(mini);
  const pl = new THREE.PointLight(0xffa040, 1.4, 9, 1.8); pl.position.set(0, 1.3, 0.6); player.add(pl);
  player.userData = { body, pl };
}
scene.add(player);

// ---------- motes & shades (pooled by id) ----------
const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff3a0, emissive: 0xffd24a, emissiveIntensity: 2 });
const shadeGeo = new THREE.SphereGeometry(0.9, 20, 14);
const moteViews = new Map(), shadeViews = new Map();
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a0a2a, emissive: 0x3a0a5a, emissiveIntensity: 0.6, roughness: 0.3 });
  const blob = new THREE.Mesh(shadeGeo, mat); g.add(blob);
  for (const sx of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd8b8ff }));
    eye.position.set(sx, 0.2, 0.78); g.add(eye);
  }
  scene.add(g);
  return { g, mat, blob };
}
function sync(views, items, make) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    if (!views.has(it.id)) views.set(it.id, make(it));
  }
  for (const [id, v] of views) if (!seen.has(id)) { scene.remove(v.g || v); views.delete(id); }
}

// pulse rings
const pulses = [];
function spawnPulse(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos[0], 0.1, pos[2]); scene.add(m); pulses.push({ m, t: 0 });
}

// ---------- input ----------
const keys = new Set();
let camYaw = 0, dragging = false, lastX = 0;
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR' && game.state !== 'playing') restart(); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => { if (dragging) { camYaw -= (e.clientX - lastX) * 0.006; lastX = e.clientX; } });

function readInput() {
  // Contract: move = [x, z]; z+ = forward (camera direction). Screen-right is world -x when yaw = 0.
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x -= 1;
  return {
    move: [x, z],
    cam_yaw_deg: (camYaw * 180) / Math.PI,
    jump: keys.has('Space'),
    interact: keys.has('KeyF'),
    pulse: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    dash: false,
  };
}

// ---------- game loop ----------
let game, running = false, acc = 0, last = performance.now(), facing = 0;
const $ = (id) => document.getElementById(id);
const overlay = $('overlay'), card = $('card'), flash = $('flash');

// URL options (used for screenshots / proof): ?autostart&seed=7&scenario=/tests/scenarios/x.json
const params = new URLSearchParams(location.search);
const urlScenario = params.get('scenario') ? await (await fetch(params.get('scenario'))).json() : null;

function restart() {
  for (const v of lanternViews.values()) scene.remove(v.g);
  lanternViews.clear(); sync(moteViews, [], null); sync(shadeViews, [], null);
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() & 0x7fffffff);
  game = new Game({ tuning: T, seed, scenario: urlScenario });
  for (const L of game.lanterns) lanternViews.set(L.id, makeLantern(L));
  camYaw = 0; acc = 0; running = true; overlay.classList.add('hidden');
}
$('start').addEventListener('click', restart);

function onEvent(ev) {
  if (ev.name === 'player_hit') { flash.style.opacity = 1; setTimeout(() => (flash.style.opacity = 0), 250); }
  if (ev.name === 'game_over') showEnd(ev.data);
}

function showEnd({ result, reason }) {
  running = false;
  const why = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng. Đảo Bến lại rực rỡ!', dawn: 'Trời đã sáng mà đảo vẫn chưa được thắp hết đèn.', no_flames: 'Mây đã mất hết ngọn lửa trong sương đen.' }[reason];
  card.innerHTML = `<h1>${result === 'won' ? 'Chiến thắng! 🏮' : 'Thua rồi…'}</h1><p>${why}</p><p>Điểm: <b>${game.score}</b></p><p>Nhấn <kbd>R</kbd> hoặc nút dưới để chơi lại.</p><button id="again">Chơi lại</button>`;
  $('again').addEventListener('click', restart);
  overlay.classList.remove('hidden');
}

function updateHud() {
  const lit = game.lanterns.filter((l) => l.lit).length;
  const tl = Math.max(0, Math.ceil(game.timeLeft));
  $('h-flames').textContent = '🔥'.repeat(Math.max(0, game.player.flames)) || '0';
  $('h-carried').textContent = `${game.player.carried}/${T.carry_capacity}`;
  $('h-lit').textContent = `${lit}/${game.lanterns.length}`;
  $('h-time').textContent = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
  $('h-score').textContent = game.score;
  $('h-pulse').textContent = game.player.pulseCd > 0 ? 'đang hồi' : game.player.carried < T.pulse_cost ? `cần ${T.pulse_cost} ✨` : 'sẵn sàng';
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (keys.has('KeyQ')) camYaw += 1.8 * dt;
  if (keys.has('KeyE')) camYaw -= 1.8 * dt;
  if (game && running) {
    acc += dt;
    while (acc >= DT && running) {
      acc -= DT;
      for (const ev of game.step(readInput())) onEvent(ev);
      if (game.lastPulse) spawnPulse(game.lastPulse.pos);
    }
  }
  if (game) render(now / 1000, dt);
  renderer.render(scene, camera);
}

function render(t, dt) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const inp = readInput();
  if (running && (inp.move[0] || inp.move[1])) {
    const th = camYaw, [mx, mz] = inp.move;
    const wx = mx * Math.cos(th) + mz * Math.sin(th), wz = -mx * Math.sin(th) + mz * Math.cos(th);
    facing = Math.atan2(wx, wz);
  }
  player.rotation.y += (((facing - player.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 12);
  player.visible = !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);
  player.userData.pl.intensity = 0.8 + 0.15 * p.carried;

  // camera behind player along cam yaw
  const cx = p.pos[0] - Math.sin(camYaw) * 10, cz = p.pos[2] - Math.cos(camYaw) * 10;
  camera.position.lerp(new THREE.Vector3(cx, p.pos[1] + 6, cz), Math.min(1, dt * 8));
  camera.lookAt(p.pos[0], p.pos[1] + 1.4, p.pos[2]);

  // lanterns + island brightening
  let lit = 0;
  for (const L of game.lanterns) {
    const v = lanternViews.get(L.id);
    v.glow += ((L.lit ? 1 : 0) - v.glow) * Math.min(1, dt * 2);
    v.headMat.emissive.setRGB(1.0 * v.glow, 0.6 * v.glow, 0.15 * v.glow);
    v.headMat.emissiveIntensity = 1.5;
    v.light.intensity = 30 * v.glow;
    v.ring.material.opacity = 0.35 * v.glow;
    v.pips.forEach((pp, i) => pp.material.color.set(i < L.deposited ? 0xffc35a : 0x55406a));
    if (L.lit) lit++;
  }
  const k = lit / game.lanterns.length;
  hemi.intensity = 0.35 + 0.6 * k;
  scene.fog.density = 0.03 - 0.018 * k;
  scene.background.copy(NIGHT).lerp(WARM, k);
  islandMat.color.setHex(0x2b3a4a).lerp(new THREE.Color(0x4a6a3a), k);

  sync(moteViews, game.motes, () => { const m = new THREE.Mesh(moteGeo, moteMat); scene.add(m); return m; });
  for (const m of game.motes) {
    const v = moteViews.get(m.id), ph = parseInt(m.id.slice(1), 10);
    v.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, 0.9 + Math.sin(t * 2 + ph) * 0.25, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
  }
  sync(shadeViews, game.shades, makeShade);
  for (const s of game.shades) {
    const v = shadeViews.get(s.id), stunned = s.stun > 0;
    v.g.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.id.length) * 0.15, s.pos[2]);
    v.g.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const sq = stunned ? 0.75 + Math.sin(t * 20) * 0.08 : 1 + Math.sin(t * 4) * 0.06;
    v.blob.scale.set(1 / sq, sq, 1 / sq);
    v.mat.emissive.setHex(stunned ? 0x8a6aaa : 0x3a0a5a);
  }

  for (let i = pulses.length - 1; i >= 0; i--) {
    const pu = pulses[i]; pu.t += dt;
    const s = 1 + (T.pulse_radius - 1) * Math.min(1, pu.t / 0.35);
    pu.m.scale.set(s, s, s); pu.m.material.opacity = 0.9 * (1 - pu.t / 0.6);
    if (pu.t > 0.6) { scene.remove(pu.m); pulses.splice(i, 1); }
  }
  updateHud();
}

// idle preview behind the start card
game = new Game({ tuning: T, seed: 1 });
for (const L of game.lanterns) lanternViews.set(L.id, makeLantern(L));
if (params.has('autostart')) restart();
requestAnimationFrame(frame);
