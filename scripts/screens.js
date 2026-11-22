// Screenshots of the real 3D client (GPU, 1280×720) driven through the Chrome DevTools protocol.
//   PORT=5199 npm start   (in another terminal)
//   CHROME="/path/to/chrome" node scripts/screens.js docs/proof/phase-2/img
// Each shot: open URL, run optional JS (click buttons, press keys), wait, capture.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'google-chrome';
const OUT = process.argv[2] || 'docs/proof/phase-2/img';
const BASE = `http://localhost:${process.env.PORT || 5199}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (code, ms = 120) => `(async()=>{dispatchEvent(new KeyboardEvent('keydown',{code:'${code}'}));await new Promise(r=>setTimeout(r,${ms}));dispatchEvent(new KeyboardEvent('keyup',{code:'${code}'}));})()`;
const click = (id) => `document.getElementById('${id}').click()`;
// shop demo player: 2400 xu from one fixed run id (paid once, so re-running the script does not add more)
const shopDemo = "(async()=>{localStorage.setItem('ddl-last-name','Mây_Demo'); const post=(op,b)=>fetch('/api/shop/'+op,{method:'POST',body:JSON.stringify({name:'Mây_Demo',...b})}); await post('earn',{run_id:'demo-shop-1',score:2400}); ";

const SHOTS = [
  { name: 'menu', url: '/' , wait: 2500 },
  { name: 'intro-night2', url: '/', custom: 'intro2', wait: 1500 },
  { name: 'night1-3lit', url: '/?autostart&seed=3&night=1&scenario=/tests/scenarios/screenshot-3lit.json', wait: 3500 },
  { name: 'night2-bridge-pad', url: '/?autostart&seed=3&night=2&scenario=/tests/scenarios/screenshot-n2.json&yaw=60', wait: 3500 },
  { name: 'night3-tiers-wind', url: '/?autostart&seed=3&night=3&scenario=/tests/scenarios/screenshot-n3.json', wait: 3500 },
  { name: 'night3-launch', url: '/?autostart&seed=3&night=3&scenario=/tests/scenarios/screenshot-n3-pad.json&yaw=180', wait: 700 },
  { name: 'danger-clock-prompt', url: '/?autostart&seed=3&night=1&scenario=/tests/scenarios/screenshot-danger.json', wait: 2500 },
  { name: 'p3-fuel-drain', url: '/?autostart&seed=3&night=1&scenario=/tests/scenarios/screenshot-p3-fuel.json&yaw=10', wait: 1800 },
  { name: 'p3-colorblind', url: '/?autostart&seed=3&night=1&cb&scenario=/tests/scenarios/screenshot-p3-fuel.json&yaw=10', wait: 1800 },
  { name: 'bench-scene', url: '/?bench&seed=42&duration=60&warmup=3', wait: 5000 },
  { name: 'captions-arrow', url: '/?autostart&seed=5&night=1&scenario=/tests/scenarios/screenshot-captions.json', wait: 5200 },
  { name: 'large-text', url: '/?autostart&seed=3&night=1&large&scenario=/tests/scenarios/screenshot-p3-fuel.json&yaw=10', wait: 1500 },
  { name: 'settings-a11y', url: '/', steps: [["window.__openSettings()", 400], ["document.querySelector('#keys button[data-action=jump]').click()", 200], ["dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}))", 300]], wait: 300 },
  { name: 'leaderboard', url: '/', steps: [["(async()=>{for (const [n,s,w] of [['Mây_Đêm',1840,3],['ThanhHUMG',960,2],['ban_tre',420,1],['Lan_01',420,1]]) await fetch('/api/leaderboard',{method:'POST',body:JSON.stringify({name:n,score:s,nights_won:w,seed:7})}); await window.__showLeaderboard();})()", 800]], wait: 300 },
  { name: 'pause', url: '/?autostart&seed=3&night=2', steps: [[key('Escape'), 800]], wait: 300 },
  { name: 'settings', url: '/?autostart&seed=3&night=2', steps: [[key('KeyP'), 500], [click('btn-pause-settings'), 500]], wait: 300 },
  { name: 'result-lost', url: '/?autostart&seed=3&night=1&scenario=/tests/scenarios/screenshot-lose.json', wait: 3500 },
  // feature/shop-scenery: villages (houses, palms, gate, well, paths, sky lanterns) and the accessory shop
  { name: 'village-n1', url: '/?autostart&seed=3&night=1&scenario=/tests/scenarios/screenshot-3lit.json&cam=-6,22,-46,2,0,-8', wait: 3000 },
  { name: 'village-n1-close', url: '/?autostart&seed=3&night=1&scenario=/tests/scenarios/screenshot-3lit.json&cam=4,5,-6,9,2,10', wait: 3000 },
  { name: 'village-n2', url: '/?autostart&seed=3&night=2&cam=35,28,-40,35,0,0', wait: 3000 },
  { name: 'village-n3', url: '/?autostart&seed=3&night=3&cam=0,26,-58,0,2,-10', wait: 3000 },
  { name: 'shop', url: '/', steps: [[shopDemo + "await post('buy',{item:'hat_quaithao'}); await post('equip',{item:'hat_quaithao'}); await post('buy',{item:'shirt_do'}); await post('equip',{item:'shirt_do'}); await window.__openShop();})()", 1500]], wait: 300 },
  { name: 'shop-tryon', url: '/', steps: [[shopDemo + "await window.__openShop();})()", 1200], ["document.querySelector('#shop-tabs [data-tab=shirt]').click()", 300], ["document.querySelector('.item[data-id=shirt_gam] .nm').click()", 300], ["document.querySelector('#shop-tabs [data-tab=hat]').click()", 300], ["document.querySelector('.item[data-id=hat_mugam] .nm').click()", 600]], wait: 300 },
  { name: 'result-xu', url: '/?autostart&seed=3&night=1', steps: [["localStorage.setItem('ddl-last-name','Xu_Check'); const g = window.__game(); g.score = 345; g.player.flames = 0;", 2500]], wait: 300 },
  { name: 'dawn', url: '/?autostart&seed=3&night=3&scenario=/tests/scenarios/screenshot-win3.json', steps: [[key('KeyE', 200), 2500]], wait: 300 },
];

async function shot(s, port) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1280,720', `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) { await wait(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* starting */ } }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0;
    const call = (method, params = {}) => new Promise((resolve) => {
      const my = ++id;
      const on = (ev) => { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', on); resolve(m.result); } };
      ws.addEventListener('message', on); ws.send(JSON.stringify({ id: my, method, params }));
    });
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: BASE + s.url });
    await wait(1500);
    if (s.custom === 'intro2') {
      // jump straight to the Night 2 intro card (as after winning Night 1)
      await call('Runtime.evaluate', { expression: "document.getElementById('btn-play').click()" });
      await wait(500);
      await call('Runtime.evaluate', { expression: "window.__showIntro && window.__showIntro(2)" });
      await wait(800);
    } else {
      for (const [expr, ms] of s.steps || []) { await call('Runtime.evaluate', { expression: expr, awaitPromise: true }); await wait(ms); }
    }
    await wait(s.wait);
    const img = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${s.name}.png`), Buffer.from(img.data, 'base64'));
    ws.close();
  } finally { chrome.kill(); }
}

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(3);
if (only.length) SHOTS.splice(0, SHOTS.length, ...SHOTS.filter((s) => only.includes(s.name)));
let port = 9400;
for (const s of SHOTS) { await shot(s, port++); console.log(`${OUT}/${s.name}.png`); }
