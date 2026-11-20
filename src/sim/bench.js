// Standard benchmark scene (Ticket-04 §1), identical for every run: Night 1, 200 wandering shades and 100 motes
// spread uniformly over the island with seed 42, lanterns L1–L3 lit with fuel 100, player idle at (0,0,0).
import { mulberry32 } from './rng.js';
import { r3, SHADE_HOVER } from './maps.js';

export const BENCH = { shades: 200, motes: 100, islandR: 39, lit: ['L1', 'L2', 'L3'] };

export function benchScenario(seed = 42) {
  const rng = mulberry32(seed);
  const point = () => {
    const a = rng() * 2 * Math.PI, r = BENCH.islandR * Math.sqrt(rng()); // uniform over the disc
    return [r3(r * Math.cos(a)), r3(r * Math.sin(a))];
  };
  const shades = Array.from({ length: BENCH.shades }, (_, i) => { const [x, z] = point(); return { id: `S${i + 1}`, pos: [x, SHADE_HOVER, z], state: 'wander' }; });
  const motes = Array.from({ length: BENCH.motes }, () => { const [x, z] = point(); return [x, 0, z]; });
  return {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, 0, 0] }, shades, motes, drifters: [], charms: [],
    lanterns: BENCH.lit.map((id) => ({ id, lit: true, fuel: 100 })),
  };
}

// Camera path: circle r 30 m at Y 15 around (0,0,0), start at 0° = (30,15,0), counter-clockwise seen from above, 15 s per lap.
export function benchCamera(tSec) {
  const a = (tSec / 15) * 2 * Math.PI;
  return [30 * Math.cos(a), 15, 30 * Math.sin(a)];
}
