// Scenery (rendering only, no rules): sky dome, moon, twinkling stars, animated sea of clouds, islands,
// decorative trees/rocks/grass. Decorations return circle colliders the client passes to the sim (client-only obstacles).
import * as THREE from 'three';

// deterministic hash noise so the same island always looks (and collides) the same
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

export function createSky(scene, C) {
  const group = new THREE.Group();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: { top: { value: new THREE.Color(C.sky) }, horizon: { value: new THREE.Color(C.mist) }, dawn: { value: new THREE.Color(0x6a4a7a) }, k: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, horizon, dawn; uniform float k; varying vec3 vP;
      void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, h));
        c = mix(c, dawn, k * 0.35 * (1.0 - smoothstep(0.0, 0.35, h))); gl_FragColor = vec4(c, 1.0); }`,
  });
  // drawn after the opaque scene (renderOrder) with depth test: pixels covered by islands are skipped (fill-rate)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), skyMat); dome.renderOrder = 2; group.add(dome);
  // stars: per-star phase → twinkle in the vertex shader (one draw call)
  const N = 900, pos = new Float32Array(N * 3), ph = new Float32Array(N), sz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = hash(i, 1) * Math.PI * 2, e = 0.06 + hash(i, 2) * 1.35, r = 400;
    pos.set([r * Math.cos(e) * Math.cos(a), r * Math.sin(e), r * Math.cos(e) * Math.sin(a)], i * 3);
    ph[i] = hash(i, 3) * 6.28; sz[i] = 1.2 + hash(i, 4) * 2.6;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); sg.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { t: { value: 0 }, fade: { value: 1 } },
    vertexShader: 'attribute float ph; attribute float sz; uniform float t; varying float vA; void main(){ vA = 0.55 + 0.45 * sin(t * 1.7 + ph); gl_PointSize = sz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float fade; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(1.0, 0.97, 0.82, a * vA * fade); }',
  });
  const stars = new THREE.Points(sg, starMat); stars.renderOrder = 3; group.add(stars);
  // moon + halo
  const glowTex = radialTexture('rgba(255,240,200,1)', 'rgba(255,240,200,0)');
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd8dcff, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
  halo.scale.setScalar(90); halo.position.set(-160, 190, -260);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 40), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  moonDisc.position.copy(halo.position); moonDisc.lookAt(0, 0, 0);
  halo.renderOrder = moonDisc.renderOrder = 3; group.add(halo, moonDisc);
  scene.add(group);
  return {
    update(t, k, camera) {
      group.position.copy(camera.position); // sky follows the camera (infinitely far)
      starMat.uniforms.t.value = t; starMat.uniforms.fade.value = 1 - 0.6 * k; skyMat.uniforms.k.value = k;
    },
  };
}

export function radialTexture(inner, outer, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Sea of clouds: drifting value noise evaluated per vertex on a 96×96 grid (cheap fragment stage), base colour #12384A.
export function createCloudSea(scene, C) {
  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { t: { value: 0 }, base: { value: new THREE.Color(C.sea) }, light: { value: new THREE.Color(0x3d6a86) }, mist: { value: new THREE.Color(C.mist) } },
    vertexShader: `uniform float t; uniform vec3 base, light, mist; varying vec3 vC;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
      void main(){ vec2 p = position.xy * 0.02 + vec2(t * 0.012, t * 0.007);
        float c = n(p * 3.0) * 0.6 + n(p * 7.0 - t * 0.02) * 0.4;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vC = mix(mix(base, light, smoothstep(0.45, 0.9, c) * 0.55), mist, smoothstep(60.0, 300.0, -mv.z));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }',
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000, 96, 96), mat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -9; sea.renderOrder = 1; // after islands: early-z skips hidden pixels
  scene.add(sea);
  return { update(t) { mat.uniforms.t.value = t; } };
}

// Island: grass top with colour variation, sand rim, rocky cliff body with an underside spike.
export function islandMesh(r, C, depth = 7) {
  const g = new THREE.Group();
  const top = new THREE.CircleGeometry(r - 2.2, 72, 0, Math.PI * 2);
  top.rotateX(-Math.PI / 2);
  const col = [], base = new THREE.Color(C.grass), dark = new THREE.Color(0x24493f), lite = new THREE.Color(0x3b7262);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const n = vnoise(p.getX(i) * 0.12, p.getZ(i) * 0.12);
    const c = base.clone().lerp(n > 0.5 ? lite : dark, Math.abs(n - 0.5) * 0.9);
    col.push(c.r, c.g, c.b);
  }
  top.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Mesh(top, new THREE.MeshLambertMaterial({ vertexColors: true })));
  const sand = new THREE.Mesh(new THREE.RingGeometry(r - 2.2, r, 72, 1), new THREE.MeshLambertMaterial({ color: C.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.01; g.add(sand);
  // cliff: displaced cylinder, flat shaded for a stylised rock look
  const cliff = new THREE.CylinderGeometry(r, r * 0.62, depth, 56, 5, true);
  const cp = cliff.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), a = Math.atan2(z, x);
    if (y > depth / 2 - 0.01) continue; // keep the rim exact (matches the walkable radius)
    const k = 1 + (vnoise(a * 5, y * 0.6) - 0.5) * 0.12;
    cp.setXYZ(i, x * k, y, z * k);
  }
  cliff.computeVertexNormals();
  const rock = new THREE.MeshLambertMaterial({ color: 0x3d4a52, flatShading: true });
  const body = new THREE.Mesh(cliff, rock); body.position.y = -depth / 2 - 0.02; g.add(body);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.62, depth * 1.6, 28, 3), rock);
  spike.rotation.x = Math.PI; spike.position.y = -depth - depth * 0.8; g.add(spike);
  return g;
}

// Objects close to the camera dissolve (dithered alpha, no sorting needed) so trees never block the view of Mây.
function nearFade(mat, from = 3.5, to = 9) {
  mat.alphaHash = true;
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `diffuseColor.a *= smoothstep(${from.toFixed(1)}, ${to.toFixed(1)}, length(vViewPosition));
#include <alphatest_fragment>`);
  };
  return mat;
}

// Decorations (instanced): layered trees, rocks, grass tufts. `avoid(x,z)` keeps gameplay spots clear.
// Returns { group, colliders: [{x, z, r, h}] } — trees block (h 4), rocks can be jumped when small.
export function decorations(C, spots, avoid) {
  const group = new THREE.Group(), colliders = [];
  const trees = [], rocks = [];
  spots.forEach(([cx, cz, n, rMin, rMax], si) => {
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + si, r = rMin + hash(i, si + 7) * (rMax - rMin);
      const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
      if (avoid(x, z)) continue;
      if (i % 3 === 0) trees.push({ x, z, s: 0.8 + hash(i, si + 9) * 0.45, rot: hash(i, 3) * 6.28 });
      else rocks.push({ x, z, s: 0.5 + hash(i, si + 11) * 0.9, rot: hash(i, 5) * 6.28 });
    }
  });
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const inst = (geo, mat, list, place) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { place(it); M4.compose(V, Q, S); m.setMatrixAt(i, M4); });
    group.add(m); return m;
  };
  const trunkG = new THREE.CylinderGeometry(0.14, 0.22, 2.0, 6); trunkG.translate(0, 1.0, 0);
  const leafG = [new THREE.ConeGeometry(1.05, 1.5, 7), new THREE.ConeGeometry(0.82, 1.3, 7), new THREE.ConeGeometry(0.58, 1.1, 7)];
  leafG[0].translate(0, 2.2, 0); leafG[1].translate(0, 2.9, 0); leafG[2].translate(0, 3.5, 0);
  const leafMats = [0x24493f, 0x2c574a, 0x346353].map((c) => nearFade(new THREE.MeshLambertMaterial({ color: c, flatShading: true })));
  inst(trunkG, nearFade(new THREE.MeshLambertMaterial({ color: C.wood })), trees, (t) => { V.set(t.x, 0, t.z); Q.setFromAxisAngle(up, t.rot); S.setScalar(t.s); });
  leafG.forEach((lg, k) => inst(lg, leafMats[k], trees, (t) => { V.set(t.x, 0, t.z); Q.setFromAxisAngle(up, t.rot + k); S.setScalar(t.s); }));
  for (const t of trees) colliders.push({ x: t.x, z: t.z, r: 0.6 * t.s, h: 4 * t.s }); // trunk + lowest canopy
  const rockG = new THREE.DodecahedronGeometry(0.6, 0);
  inst(rockG, new THREE.MeshLambertMaterial({ color: C.stone, flatShading: true }), rocks, (r) => { V.set(r.x, 0.1 * r.s, r.z); Q.setFromAxisAngle(up, r.rot); S.set(r.s * 1.2, r.s * 0.8, r.s); });
  for (const r of rocks) colliders.push({ x: r.x, z: r.z, r: 0.55 * r.s, h: 0.75 * r.s });
  return { group, colliders };
}

// Grass tufts: many tiny blades, instanced, kept off lantern/paths via avoid().
export function grass(C, areas, avoid, count = 700) {
  const blade = new THREE.ConeGeometry(0.07, 0.45, 3); blade.translate(0, 0.22, 0);
  const pts = [];
  let i = 0;
  while (pts.length < count && i < count * 4) {
    const [cx, cz, R] = areas[i % areas.length];
    const a = hash(i, 21) * Math.PI * 2, r = Math.sqrt(hash(i, 22)) * (R - 3);
    const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
    if (!avoid(x, z)) pts.push([x, z, 0.6 + hash(i, 23) * 0.9, hash(i, 24) * 6.28]);
    i++;
  }
  const m = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: 0x4f8a6c }), pts.length);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  pts.forEach(([x, z, s, r], k) => { E.set((hash(k, 31) - 0.5) * 0.5, r, (hash(k, 32) - 0.5) * 0.5); Q.setFromEuler(E); M4.compose(new THREE.Vector3(x, 0, z), Q, new THREE.Vector3(s, s, s)); m.setMatrixAt(k, M4); });
  return m;
}

// Ambient fireflies drifting over the island (decorative, not gameplay motes): one Points draw.
export function ambientFireflies(scene, areas, count = 140) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const [cx, cz, R] = areas[i % areas.length];
    const a = hash(i, 41) * 6.28, r = Math.sqrt(hash(i, 42)) * R;
    pos.set([cx + r * Math.cos(a), 0.6 + hash(i, 43) * 3.5, cz + r * Math.sin(a)], i * 3); seed[i] = hash(i, 44) * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 } },
    vertexShader: `attribute float seed; uniform float t; varying float vA;
      void main(){ vec3 p = position + vec3(sin(t*0.6+seed)*0.8, sin(t*0.9+seed*1.3)*0.4, cos(t*0.5+seed)*0.8);
        vA = 0.35 + 0.65 * max(0.0, sin(t*2.1 + seed*3.0)); vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = 90.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(1.0, 0.9, 0.55, a * vA); }',
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  scene.add(pts);
  return { obj: pts, update(t) { mat.uniforms.t.value = t; } };
}

// Soft round contact shadow texture (used under characters and lanterns instead of real shadow maps).
export const shadowTexture = () => radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 64);
