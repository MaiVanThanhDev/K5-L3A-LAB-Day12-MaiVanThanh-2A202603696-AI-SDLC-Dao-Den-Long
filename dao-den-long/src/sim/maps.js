// Standard maps (Ticket-02, Part 2). Pure data + terrain queries, no DOM.
// Angle convention: measured from +X, counter-clockwise seen from above → point = (cx + r·cos a, y, cz + r·sin a).
export const r3 = (x) => {
  const v = Math.round(x * 1000) / 1000;
  return v === 0 ? 0 : v; // avoid -0
};
const rad = (d) => (d * Math.PI) / 180;
const polar = (r, aDeg, y = 0, cx = 0, cz = 0) => [r3(cx + r * Math.cos(rad(aDeg))), y, r3(cz + r * Math.sin(rad(aDeg)))];
const ring = (n, r, a0, step, y = 0, cx = 0, cz = 0) => Array.from({ length: n }, (_, i) => polar(r, a0 + i * step, y, cx, cz));

export const SHADE_HOVER = 1.0;   // shade.pos is its centre, floating 1 m above the ground
export const TOWER = Infinity;    // groundAt() value for solid, unclimbable geometry

// ---------- terrain ----------
function ground1(x, z) {
  return Math.hypot(x, z) <= 40 ? 0 : null;
}
function ground2(x, z) {
  if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
  if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0; // bamboo bridge, no railing
  return null;
}
const RAMPS3 = [30, 150].map((a) => [Math.cos(rad(a)), Math.sin(rad(a))]);
function ground3(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 2) return TOWER;          // bell tower, 8 m tall, cannot be climbed
  if (r <= 8) return 6;              // tier 2: disc r 8
  let h = 0;
  if (r >= 12 && r <= 24 && z > 0) h = 3; // tier 1: half annulus 12–24 m, z > 0
  for (const [ux, uz] of RAMPS3) {
    const along = x * ux + z * uz, lat = Math.abs(x * uz - z * ux);
    if (along >= 24 && along <= 30 && lat <= 1.5) h = Math.max(h, (3 * (30 - along)) / 6);
  }
  return h;
}

// ---------- nights ----------
export const NIGHTS = {
  1: {
    night: 1, name: 'Đảo Bến', durationKey: 'night1_duration_s',
    start: [0, 0, 0], facing: [0, 1], boundR: 40, center: [0, 0],
    groundAt: ground1,
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
    shadePoints: ring(12, 37, 15, 30, SHADE_HOVER),
    shadeInterval: 480, shadeMax: 6, shadeSpeedKey: 'shade_speed',
    drifters: false, wind: false, charms: [], pads: [],
  },
  2: {
    night: 2, name: 'Đảo Cau', durationKey: 'night2_duration_s',
    start: [0, 0, 0], facing: [0, 1], boundR: 75, center: [35, 0],
    groundAt: ground2,
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [0, 70].flatMap((cx) => [...ring(4, 10, 0, 90, 0, cx), ...ring(8, 22, 0, 45, 0, cx)]),
    shadePoints: [0, 70].flatMap((cx) => ring(8, 26, 22.5, 45, SHADE_HOVER, cx)),
    shadeInterval: 420, shadeMax: 8, shadeSpeedKey: 'shade_speed',
    drifters: true, wind: false,
    charms: [[35, 0, 0]],
    // Launch pads: touch → vy 14, horizontal 24 m/s toward the other island's centre, kept until landing.
    pads: [
      { pos: [20, 0, 18], r: 1, vy: 14, speed: 24, toward: [70, 0] },
      { pos: [50, 0, -18], r: 1, vy: 14, speed: 24, toward: [0, 0] },
    ],
  },
  3: {
    night: 3, name: 'Đảo Chuông', durationKey: 'night3_duration_s',
    // (0,0,0) is inside the bell tower → start on tier 0, south of the tower, facing it (assumption B3).
    start: [0, 0, -20], facing: [0, 1], boundR: 45, center: [0, 0],
    groundAt: ground3,
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
    shadePoints: ring(16, 43, 0, 22.5, SHADE_HOVER),
    shadeInterval: 360, shadeMax: 10, shadeSpeedKey: 'shade_speed_night3',
    drifters: true, wind: true,
    charms: [[30, 0, 25], [-30, 0, 25]],
    pads: [{ pos: [0, 3, 13], r: 1, vy: 12, speed: 8, dir: [0, -1] }],
    ramps: [30, 150], tower: { r: 2, h: 8 },
  },
};

export function padVelocity(pad) {
  if (pad.dir) return [pad.dir[0] * pad.speed, pad.dir[1] * pad.speed];
  const dx = pad.toward[0] - pad.pos[0], dz = pad.toward[1] - pad.pos[2], n = Math.hypot(dx, dz);
  return [(dx / n) * pad.speed, (dz / n) * pad.speed];
}
