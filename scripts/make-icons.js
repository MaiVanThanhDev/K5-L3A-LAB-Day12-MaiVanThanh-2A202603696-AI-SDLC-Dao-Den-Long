#!/usr/bin/env node
// Draws the app icon (a glowing lantern on the night-sky colour) and writes PNGs with no dependencies (zlib only).
//   node scripts/make-icons.js            → web/icons/icon-{192,512}.png, icon-maskable-512.png
//                                           + Android launcher icons (android-app/android/app/src/main/res/mipmap-*) when that project exists
// Re-run after changing the drawing; the PNGs are committed so the game needs no build step.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'web', 'icons');

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const SKY = hex(0x0e1430), MIST = hex(0x1b2350), LAMP = hex(0xffb347), CORE = hex(0xffe9b0), CAP = hex(0x7a2a24), GOLD = hex(0xf2c14e);

// Colour at (u, v) in [-1, 1]² (v down). `pad` shrinks the drawing (maskable icons keep a safe zone).
function shade(u, v, { rounded, circle, pad, noBg }) {
  if (rounded) { // rounded square, radius 0.22
    const q = (x) => Math.max(Math.abs(x) - (1 - 0.22), 0);
    if (Math.hypot(q(u), q(v)) > 0.22) return null;
  }
  if (circle && Math.hypot(u, v) > 1) return null;
  u *= pad; v *= pad; // pad > 1 shrinks the drawing toward the centre
  let c = mix(MIST, SKY, Math.min(1, Math.hypot(u, v + 0.2) / 1.3));
  // glow
  const g = Math.max(0, 1 - Math.hypot(u, (v - 0.05) * 0.9) / 0.95);
  c = mix(c, LAMP, g * g * 0.55);
  // string + top/bottom caps
  const string = Math.abs(u) < 0.025 && ((v > -0.86 && v < -0.62) || (v > 0.72 && v < 0.88));
  if (string) c = GOLD;
  const capT = v > -0.64 && v < -0.5 && Math.abs(u) < 0.36 - (v + 0.64) * -0.9;
  const capB = v > 0.6 && v < 0.74 && Math.abs(u) < 0.3 - (v - 0.6) * 0.9;
  if (capT || capB) return [...CAP, 255];
  // lantern body: ellipse with ribs and a bright core
  const e = (u / 0.52) ** 2 + ((v - 0.05) / 0.58) ** 2;
  if (e <= 1) {
    let b = mix(LAMP, CORE, Math.max(0, 1 - e) ** 1.6);
    const rib = Math.abs(Math.sin(Math.asin(Math.max(-1, Math.min(1, u / 0.52 / Math.sqrt(Math.max(1e-6, 1 - ((v - 0.05) / 0.58) ** 2))))) * 2));
    if (rib < 0.06 && e < 0.97) b = mix(b, hex(0xc9822f), 0.5);
    if (Math.abs(v - 0.05) < 0.012) b = mix(b, hex(0xc9822f), 0.5);
    return [...b, 255];
  }
  if (noBg) return string ? [...GOLD, 255] : null; // Android adaptive-icon foreground: lantern only, background is a colour
  return [...c, 255];
}

function draw(size, opts) {
  const ss = 3, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const u = ((x + (i + 0.5) / ss) / size) * 2 - 1, v = ((y + (j + 0.5) / ss) / size) * 2 - 1;
      const c = shade(u, v, opts);
      if (!c) continue;
      r += c[0]; g += c[1]; b += c[2]; a += 255;
    }
    const n = ss * ss, o = (y * size + x) * 4, al = a / n;
    buf[o] = al ? Math.round(r / (a / 255)) : 0; buf[o + 1] = al ? Math.round(g / (a / 255)) : 0; buf[o + 2] = al ? Math.round(b / (a / 255)) : 0; buf[o + 3] = Math.round(al);
  }
  return png(size, buf);
}

mkdirSync(OUT, { recursive: true });
for (const s of [192, 512]) writeFileSync(join(OUT, `icon-${s}.png`), draw(s, { rounded: true, pad: 1 }));
writeFileSync(join(OUT, 'icon-maskable-512.png'), draw(512, { rounded: false, pad: 1.35 }));
console.log(`icons → ${OUT}`);

const RES = join(ROOT, 'android-app', 'android', 'app', 'src', 'main', 'res');
if (existsSync(RES)) {
  // legacy 48 dp icon + adaptive 108 dp foreground (safe zone 66 dp → pad 108/66 ≈ 1.65)
  for (const [d, k] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
    const dir = join(RES, `mipmap-${d}`); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ic_launcher.png'), draw(48 * k, { rounded: true, pad: 1 }));
    writeFileSync(join(dir, 'ic_launcher_round.png'), draw(48 * k, { circle: true, pad: 1.1 }));
    writeFileSync(join(dir, 'ic_launcher_foreground.png'), draw(108 * k, { noBg: true, pad: 1.65 }));
  }
  console.log(`android icons → ${RES}`);
}
