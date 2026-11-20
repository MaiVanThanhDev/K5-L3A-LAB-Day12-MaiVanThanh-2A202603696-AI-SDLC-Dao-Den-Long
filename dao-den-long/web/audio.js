// Synthesised audio (WebAudio, no asset files): night music + sound effects. Rendering side only.
let ctx = null, master = null, musicGain = null, musicTimer = null, volume = 0.7;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
  return ctx;
}

export function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function tone({ f = 440, f2 = null, type = 'sine', t = 0.15, a = 0.005, g = 0.3, delay = 0, dest = null }) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(), e = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  e.gain.setValueAtTime(0.0001, t0);
  e.gain.exponentialRampToValueAtTime(g, t0 + a);
  e.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(e); e.connect(dest || master);
  o.start(t0); o.stop(t0 + t + 0.05);
}

function noise({ t = 0.3, g = 0.2, f = 800, q = 1, delay = 0, sweep = null }) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + delay, n = Math.floor(c.sampleRate * t);
  const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t0); bp.Q.value = q;
  if (sweep) bp.frequency.exponentialRampToValueAtTime(sweep, t0 + t);
  const e = c.createGain();
  e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + t * 0.3); e.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(bp); bp.connect(e); e.connect(master); src.start(t0);
}

export const sfx = {
  pickup: () => { tone({ f: 1320, t: 0.09, g: 0.15, type: 'triangle' }); tone({ f: 1760, t: 0.12, g: 0.12, type: 'triangle', delay: 0.05 }); },
  deposit: () => tone({ f: 660, f2: 990, t: 0.18, g: 0.18, type: 'triangle' }),
  lantern: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: 0.5, g: 0.18, type: 'triangle', delay: i * 0.08 })),
  pulse: () => { tone({ f: 300, f2: 1200, t: 0.35, g: 0.22, type: 'sine' }); noise({ t: 0.35, g: 0.08, f: 2000, sweep: 6000 }); },
  hit: () => { tone({ f: 220, f2: 70, t: 0.35, g: 0.35, type: 'sawtooth' }); noise({ t: 0.2, g: 0.15, f: 300 }); },
  jump: () => tone({ f: 380, f2: 620, t: 0.14, g: 0.12, type: 'square' }),
  dash: () => noise({ t: 0.22, g: 0.25, f: 900, sweep: 3000, q: 0.7 }),
  charm: () => [880, 1175, 1568].forEach((f, i) => tone({ f, t: 0.3, g: 0.14, type: 'sine', delay: i * 0.06 })),
  steal: () => tone({ f: 900, f2: 300, t: 0.4, g: 0.18, type: 'triangle' }),
  shade: () => { tone({ f: 110, f2: 82, t: 0.8, g: 0.2, type: 'sawtooth' }); tone({ f: 116, f2: 87, t: 0.8, g: 0.12, type: 'sawtooth' }); },
  tick: () => tone({ f: 1000, t: 0.06, g: 0.15, type: 'square' }),
  fall: () => tone({ f: 600, f2: 80, t: 0.9, g: 0.2, type: 'sine' }),
  out: () => { tone({ f: 520, f2: 130, t: 0.7, g: 0.2, type: 'triangle' }); noise({ t: 0.4, g: 0.06, f: 500 }); },
  wind: () => noise({ t: 2.5, g: 0.18, f: 400, sweep: 1200, q: 0.5 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, t: 0.7, g: 0.2, type: 'triangle', delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ f, t: 0.6, g: 0.18, type: 'sine', delay: i * 0.18 })),
  click: () => tone({ f: 700, t: 0.05, g: 0.1, type: 'triangle' }),
};

// Night music: low drone + slow pentatonic arpeggio, a little brighter for each night.
const SCALE = [0, 3, 5, 7, 10, 12, 15];
export function startMusic(night = 1) {
  const c = ensure(); if (!c) return;
  stopMusic();
  const root = [196, 174.6, 220][night - 1] || 196;
  const drone = [root / 2, root * 0.75].map((f) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.25; o.connect(g); g.connect(musicGain); o.start();
    return o;
  });
  let step = 0;
  musicTimer = { drone, id: setInterval(() => {
    const k = SCALE[(step * 3 + (step >> 2)) % SCALE.length];
    tone({ f: root * 2 ** (k / 12) * 2, t: 1.4, a: 0.08, g: 0.35, type: 'triangle', dest: musicGain });
    if (step % 4 === 0) tone({ f: root * 2 ** (k / 12), t: 2.2, a: 0.3, g: 0.25, type: 'sine', dest: musicGain });
    step++;
  }, 650) };
}
export function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer.id);
  for (const o of musicTimer.drone) { try { o.stop(); } catch { /* already stopped */ } }
  musicTimer = null;
}
