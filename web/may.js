// Mây — original character model (rendering only): conical nón lá with a small hanging lantern, ivory tunic,
// red scarf with trailing ends, jointed arms and legs. Procedural run / jump / dash / idle animation.
import * as THREE from 'three';

export function createMay(C) {
  const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  const robe = lam(C.robe), scarfM = lam(C.scarf), skin = lam(0xf2c9a0), hair = lam(0x1d1a24), pants = lam(0x2a3366), hatM = lam(C.sand), shoe = lam(0x3a2a20);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // bobs / leans

  // legs (pivot at hip)
  const legG = new THREE.CapsuleGeometry(0.1, 0.42, 3, 8); legG.translate(0, -0.27, 0);
  const footG = new THREE.BoxGeometry(0.16, 0.08, 0.26); footG.translate(0, -0.56, 0.05);
  const legs = [-0.13, 0.13].map((x) => {
    const hip = new THREE.Group(); hip.position.set(x, 0.62, 0);
    hip.add(new THREE.Mesh(legG, pants), new THREE.Mesh(footG, shoe));
    body.add(hip); return hip;
  });
  // tunic: lathe profile flaring at the hem
  const prof = [[0.0, 0.5], [0.3, 0.52], [0.33, 0.62], [0.28, 0.85], [0.24, 1.1], [0.2, 1.18], [0.0, 1.2]].map(([r, y]) => new THREE.Vector2(r, y));
  body.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 18), robe));
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 6, 18), lam(C.gold)); belt.rotation.x = Math.PI / 2; belt.position.y = 0.86; body.add(belt);
  // arms (pivot at shoulder)
  const armG = new THREE.CapsuleGeometry(0.075, 0.36, 3, 8); armG.translate(0, -0.22, 0);
  const handG = new THREE.SphereGeometry(0.075, 8, 6); handG.translate(0, -0.45, 0);
  const arms = [-1, 1].map((sd) => {
    const sh = new THREE.Group(); sh.position.set(0.27 * sd, 1.1, 0); sh.rotation.z = 0.12 * sd;
    sh.add(new THREE.Mesh(armG, robe), new THREE.Mesh(handG, skin));
    body.add(sh); return sh;
  });
  // head
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skin));
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.255, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  hairBack.rotation.x = -0.35; hairBack.position.set(0, 0.02, -0.03); head.add(hairBack);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hair); bun.position.set(0, 0.06, -0.26); head.add(bun);
  for (const sd of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), lam(0x1a1420)); eye.position.set(0.085 * sd, 0.02, 0.215); head.add(eye);
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: 0xf09a8a, transparent: true, opacity: 0.6 }));
    cheek.position.set(0.13 * sd, -0.06, 0.2); cheek.lookAt(0.4 * sd, -0.1, 1.5); head.add(cheek);
  }
  // scarf: ring + two trailing ends (pivot at the back of the neck)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 18), scarfM); ring.rotation.x = Math.PI / 2; ring.position.y = 1.2; body.add(ring);
  const tailG = new THREE.BoxGeometry(0.12, 0.04, 0.42); tailG.translate(0, 0, -0.21);
  const tails = [-0.06, 0.07].map((x, k) => { const t = new THREE.Group(); t.position.set(x, 1.2, -0.18); t.add(new THREE.Mesh(tailG, scarfM)); t.userData.k = k; body.add(t); return t; });
  // headwear (shop item, default nón lá) + small lantern on a string hanging at the front brim
  const hat = new THREE.Group(); hat.position.y = 0.2; head.add(hat);
  let hatModel = null;
  const lanternPivot = new THREE.Group(); hat.add(lanternPivot);
  function setHat(style, color) {
    if (hatModel) { hat.remove(hatModel); hatModel.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }
    const g = (hatModel = new THREE.Group()); hat.add(g);
    const add = (geo, mat, y = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.x = rx; g.add(m); return m; };
    const ring = (r, t, y, c, seg = 4) => add(new THREE.TorusGeometry(r, t, seg, 28), lam(c), y, Math.PI / 2);
    let brim = [0, -0.03, 0.56]; // where the lantern string starts
    if (style === 'rom') { // mũ rơm: flat brim, round crown, red band
      add(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 26), lam(color), 0);
      add(new THREE.CylinderGeometry(0.21, 0.25, 0.2, 18), lam(color), 0.11);
      ring(0.245, 0.02, 0.04, 0xa8262a);
      brim = [0, -0.01, 0.46];
    } else if (style === 'quaithao') { // nón quai thao: wide flat lacquered disc, gold rim, small crown, hanging tassels
      add(new THREE.CylinderGeometry(0.74, 0.74, 0.04, 32), lam(color), 0.02);
      add(new THREE.CylinderGeometry(0.19, 0.21, 0.08, 18), lam(0x3b2a1c), 0.08);
      ring(0.73, 0.012, 0.02, 0xf2c14e);
      for (const sd of [-1, 1]) { const t = add(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), lam(0xc8102e), -0.22); t.position.x = 0.3 * sd; }
      brim = [0, 0, 0.68];
    } else if (style === 'khan') { // khăn vấn: two wrapped rings of cloth
      ring(0.215, 0.07, -0.03, color, 8);
      ring(0.17, 0.06, 0.05, color, 8).rotation.z = 0.15;
      brim = [0, 0.0, 0.3];
    } else if (style === 'mu') { // mũ gấm: brocade cylinder with brim ring and a red jewel at the front
      add(new THREE.CylinderGeometry(0.23, 0.25, 0.22, 18), lam(color, { emissive: 0x3a2a00 }), 0.08);
      add(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 18), lam(0xc8102e), 0.2);
      ring(0.26, 0.025, -0.02, 0xc89a2e);
      const gem = add(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a4a }), 0.08); gem.position.z = 0.24;
      brim = [0, -0.02, 0.32];
    } else { // nón lá: wide flat cone with three rings
      add(new THREE.ConeGeometry(0.62, 0.34, 28, 1, true), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }), 0.12);
      for (const [r, y] of [[0.5, 0.025], [0.34, 0.11], [0.18, 0.2]]) ring(r, 0.008, y, 0xa8936a);
    }
    lanternPivot.position.set(brim[0], brim[1], brim[2]);
  }
  setHat('nonla', C.sand);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), lam(0x222222)); string.position.y = -0.11; lanternPivot.add(string);
  const lanternMat = new THREE.MeshBasicMaterial({ color: C.lampOn });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), lanternMat); lantern.scale.y = 1.25; lantern.position.y = -0.27; lanternPivot.add(lantern);
  const lcap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.05, 8), lam(0x7a2a24)); lcap.position.y = -0.19; lanternPivot.add(lcap);
  const light = new THREE.PointLight(C.lampOn, 2, 10, 1.6); light.position.set(0, 1.35, 0.55); root.add(light);
  // dash streak (two fading ribbons behind the body)
  const streakMat = new THREE.MeshBasicMaterial({ color: 0xfff6c2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), streakMat); streak.rotation.x = Math.PI / 2; streak.position.set(0, 0.9, -1.2); root.add(streak);

  let phase = 0, swing = 0, swingV = 0, lean = 0, dashFx = 0;
  return {
    root, light,
    // outfit = { hat, shirt, pants, shoes } catalog items (src/shop-rules.js outfitItems); the tunic sleeves follow the shirt
    setOutfit(o) {
      robe.color.setHex(o.shirt.color); pants.color.setHex(o.pants.color); shoe.color.setHex(o.shoes.color);
      setHat(o.hat.style, o.hat.color);
    },
    update(dt, s) {
      // s = { speed (m/s horizontal), grounded, vy, dashing, carried, t }
      const run = Math.min(1, s.speed / 6);
      phase += dt * (4 + s.speed * 1.6);
      const sw = Math.sin(phase) * 0.9 * run;
      if (s.grounded) {
        legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
        arms[0].rotation.x = -sw * 0.8; arms[1].rotation.x = sw * 0.8;
        body.position.y = Math.abs(Math.sin(phase)) * 0.06 * run + Math.sin(s.t * 2) * 0.008 * (1 - run);
      } else { // airborne: knees tucked, arms up
        legs[0].rotation.x = -0.7; legs[1].rotation.x = -0.35;
        arms[0].rotation.x = arms[1].rotation.x = s.vy > 0 ? -2.2 : -1.4;
        body.position.y = 0;
      }
      const targetLean = s.dashing ? 0.55 : run * 0.12;
      lean += (targetLean - lean) * Math.min(1, dt * 12);
      body.rotation.x = lean;
      // hanging lantern: damped pendulum driven by acceleration
      const acc = (s.speed - (this._ls ?? s.speed)) / Math.max(dt, 1e-3); this._ls = s.speed;
      swingV += (-swing * 30 - swingV * 4 - acc * 0.02) * dt; swing += swingV * dt;
      lanternPivot.rotation.x = Math.max(-0.8, Math.min(0.8, swing + lean * 0.5));
      // scarf ends flutter more with speed
      for (const t of tails) t.rotation.x = 0.35 + run * 0.9 + Math.sin(s.t * (8 + run * 10) + t.userData.k) * (0.08 + run * 0.15);
      dashFx += ((s.dashing ? 1 : 0) - dashFx) * Math.min(1, dt * (s.dashing ? 20 : 6));
      streakMat.opacity = 0.35 * dashFx;
      light.intensity = 1.2 + 0.25 * s.carried;
      lanternMat.color.setHex(C.lampOn);
    },
  };
}
