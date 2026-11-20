// FPS benchmark of the real 3D client at 1280×720 (GPU, real time) through the Chrome DevTools protocol.
//   PORT=5199 npm start   (in another terminal)
//   CHROME="/path/to/chrome" node scripts/fps-bench.js [seconds=15] [out.json]
// Reads window.__fps (average FPS while playing, computed by web/main.js) for each night.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'google-chrome';
const SECONDS = Number(process.argv[2] || 15);
const OUT = process.argv[3];
const BASE = `http://localhost:${process.env.PORT || 5199}`;
const RUNS = [
  ['Đêm 1', '?autostart&fps&seed=3&night=1'],
  ['Đêm 2', '?autostart&fps&seed=3&night=2'],
  ['Đêm 3', '?autostart&fps&seed=3&night=3'],
  ['Đêm 3, 6/7 đèn sáng (nhiều đèn nhất)', '?autostart&fps&seed=3&night=3&scenario=/tests/scenarios/bench-n3-lit.json'],
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(url, port) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=default', '--window-size=1280,720',
    `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', url], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await wait(200);
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
    }
    if (!target) throw new Error('chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0;
    const call = (method, params = {}) => new Promise((resolve) => {
      const my = ++id;
      const on = (ev) => { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', on); resolve(m.result); } };
      ws.addEventListener('message', on);
      ws.send(JSON.stringify({ id: my, method, params }));
    });
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await call('Runtime.evaluate', { expression: 'dispatchEvent(new Event("resize")); window.__resetFps && window.__resetFps()' });
    await wait(SECONDS * 1000);
    const r = await call('Runtime.evaluate', { expression: 'JSON.stringify({fps: window.__fps, gpu: (()=>{const c=document.createElement("canvas").getContext("webgl");const e=c&&c.getExtension("WEBGL_debug_renderer_info");return e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):"?"})(), w: innerWidth, h: innerHeight})', returnByValue: true });
    ws.close();
    return JSON.parse(r.result.value);
  } finally { chrome.kill(); }
}

const results = [];
let port = 9333;
for (const [name, q] of RUNS) {
  const r = await measure(BASE + '/' + q, port++);
  results.push({ name, avg_fps: r.fps ? Math.round(r.fps.avg * 10) / 10 : null, samples: r.fps?.samples ?? 0, viewport: `${r.w}×${r.h}`, gpu: r.gpu });
  console.log(`${name}: ${results.at(-1).avg_fps} FPS TB (${results.at(-1).samples} giây đo) · ${r.w}×${r.h} · ${r.gpu}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
