// Benchmark (Ticket-04 §1): opens the real 3D client in a 1280×720 Chrome window with vsync off, runs the standard
// bench scene (Night 1, 200 wandering shades, 100 motes, L1–L3 lit, scripted orbit camera), skips 3 s warm-up,
// measures --duration seconds of frames and writes bench.json, then exits 0.
//   node scripts/bench.js --seed 42 --duration 30 --out bench.json     (bench_cmd in game.contract.json)
// Options: --chrome <path> (or env CHROME), --headless (no window; for CI only, not for scoring), --warmup <s>.
import { spawn, execFile } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus, totalmem, type, release, arch } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROC_START = performance.timeOrigin; // process start (epoch ms)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const seed = Number(opt('seed', 42)), duration = Number(opt('duration', 30)), warmup = Number(opt('warmup', 3));
const out = opt('out', 'bench.json'), headless = argv.includes('--headless') || process.env.BENCH_HEADLESS === '1';
if (!Number.isInteger(seed) || !(duration > 0)) { process.stderr.write('usage: --seed <int> --duration <s> --out <file>\n'); process.exit(1); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { process.stderr.write(`bench: ${msg}\n`); cleanup(); process.exit(1); };

function findChrome() {
  const given = opt('chrome', process.env.CHROME);
  if (given) return given;
  const cands = {
    win32: [`${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  }[process.platform] || [];
  for (const c of cands) if (c && existsSync(c)) return c;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    for (const dir of (process.env.PATH || '').split(delimiter)) if (existsSync(join(dir, name))) return join(dir, name);
  }
  return null;
}

// RSS of the whole browser process tree (browser + GPU + renderer processes), in MB.
function treeRssMb(rootPid) {
  return new Promise((resolve) => {
    const done = (rows) => {
      const kids = new Map();
      for (const r of rows) { if (!kids.has(r.ppid)) kids.set(r.ppid, []); kids.get(r.ppid).push(r); }
      let sum = 0; const stack = [rootPid], seen = new Set();
      const self = rows.find((r) => r.pid === rootPid); if (self) sum += self.bytes;
      while (stack.length) { const p = stack.pop(); if (seen.has(p)) continue; seen.add(p); for (const c of kids.get(p) || []) { sum += c.bytes; stack.push(c.pid); } }
      resolve(sum ? sum / 2 ** 20 : null);
    };
    if (process.platform === 'win32') {
      execFile('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId),$($_.WorkingSetSize)" }'], { maxBuffer: 1 << 24 }, (e, so) => {
        if (e) return resolve(null);
        done(so.trim().split(/\r?\n/).map((l) => l.split(',').map(Number)).filter((a) => a.length === 3).map(([pid, ppid, b]) => ({ pid, ppid, bytes: b })));
      });
    } else {
      execFile('ps', ['-A', '-o', 'pid=,ppid=,rss='], { maxBuffer: 1 << 24 }, (e, so) => {
        if (e) return resolve(null);
        done(so.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number)).map(([pid, ppid, kb]) => ({ pid, ppid, bytes: kb * 1024 })));
      });
    }
  });
}

let server = null, chrome = null, profile = null;
function cleanup() {
  try { chrome?.kill(); } catch { /* gone */ }
  try { server?.kill(); } catch { /* gone */ }
  if (profile) setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ } }, 500);
}

const CHROME = findChrome();
if (!CHROME) fail('Chrome/Chromium/Edge not found — pass --chrome <path> or set CHROME');
const port = 5300 + Math.floor(Math.random() * 500), dbg = 9300 + Math.floor(Math.random() * 500);
server = spawn(process.execPath, [join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch { /* starting */ } await wait(100); }

profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
const flags = ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--window-size=1296,800', '--window-position=40,40', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`];
if (headless) flags.push('--headless=new');
chrome = spawn(CHROME, [...flags, 'about:blank'], { stdio: 'ignore' });

let target;
for (let i = 0; i < 100 && !target; i++) { await wait(100); try { target = (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find((t) => t.type === 'page'); } catch { /* starting */ } }
if (!target) fail('Chrome did not expose a page target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let msgId = 0;
const call = (method, params = {}) => new Promise((resolve) => {
  const id = ++msgId;
  const on = (ev) => { const m = JSON.parse(ev.data); if (m.id === id) { ws.removeEventListener('message', on); resolve(m.result); } };
  ws.addEventListener('message', on); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => (await call('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.value;

const version = await call('Browser.getVersion');
await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await call('Page.navigate', { url: `http://127.0.0.1:${port}/?bench&seed=${seed}&duration=${duration}&warmup=${warmup}${process.env.BENCH_QS || ''}` }); // BENCH_QS: extra query for A/B experiments only

const deadline = Date.now() + (warmup + duration + 90) * 1000;
let peak = null, result = null, sampling = false;
const chromePid = chrome.pid;
while (Date.now() < deadline) {
  await wait(1000);
  const st = await evaluate('window.__bench ? JSON.stringify({done: window.__bench.done}) : null');
  const started = !!st;
  if (started && !sampling) {
    sampling = true;
    (async function sample() { while (sampling) { const m = await treeRssMb(chromePid); if (m != null) peak = Math.max(peak ?? 0, m); await wait(5000); } })();
  }
  if (st && JSON.parse(st).done) { result = JSON.parse(await evaluate('JSON.stringify(window.__bench)')); break; }
}
sampling = false;
if (!result) fail('bench scene did not finish in time');

const dts = result.dts, N = dts.length, sum = dts.reduce((a, b) => a + b, 0);
const sorted = [...dts].sort((a, b) => a - b);
const k = Math.max(1, Math.ceil(0.01 * N));
const worst = sorted.slice(-k), p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
const r1 = (x) => Math.round(x * 10) / 10;
const pkg = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const report = {
  contract_version: pkg.contract_version,
  avg_fps: r1((1000 * N) / sum),
  p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
  frame_ms_p95: r1(p95),
  frames: N,
  load_ms: Math.round(result.firstFrameEpoch - PROC_START),
  peak_mem_mb: peak == null ? null : Math.round(peak),
  vsync_off: true,
  renderer: `three.js r${result.three} (WebGL) in ${version.product} · ${result.gl}`,
  os: `${type()} ${release()} ${arch()} · ${cpus()[0]?.model?.trim()} · ${Math.round(totalmem() / 2 ** 30)} GB RAM`,
  seed, duration_s: duration, warmup_s: warmup, viewport: result.viewport, pixel_ratio: result.pixelRatio, headless,
  scene: { night: 1, shades: result.shades, motes: result.motes, lit: result.lit },
  notes: 'vsync off via --disable-gpu-vsync --disable-frame-rate-limit; peak_mem_mb = RSS (working set on Windows) of the whole Chrome process tree, sampled every 5 s while measuring; load_ms = bench process start → first rendered frame of the bench scene.',
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`bench: ${report.avg_fps} FPS avg, ${report.p1_low_fps} 1% low, p95 ${report.frame_ms_p95} ms, ${N} frames, load ${report.load_ms} ms, peak ${report.peak_mem_mb} MB → ${out}`);
ws.close();
cleanup();
setTimeout(() => process.exit(0), 600);
