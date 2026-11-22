// Copies the game client into www/ with the same paths the server uses (/web, /src, /node_modules/three, /game.contract.json),
// so web/index.html, its absolute imports and fetch('/game.contract.json') work unchanged inside the Android WebView.
// No server in the app: leaderboard and shop fall back to on-device storage (same rules, src/*-rules.js).
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const WWW = join(HERE, 'www');
const three = join(ROOT, 'node_modules', 'three', 'build', 'three.module.js');
if (!existsSync(three)) { console.error('Chạy `npm install` ở thư mục gốc của game trước (cần three.js).'); process.exit(1); }

rmSync(WWW, { recursive: true, force: true });
mkdirSync(join(WWW, 'node_modules', 'three', 'build'), { recursive: true });
cpSync(join(ROOT, 'web'), join(WWW, 'web'), { recursive: true });
mkdirSync(join(WWW, 'src', 'sim'), { recursive: true });
for (const f of ['game.js', 'maps.js', 'rng.js', 'bench.js']) cpSync(join(ROOT, 'src', 'sim', f), join(WWW, 'src', 'sim', f));
for (const f of ['leaderboard-rules.js', 'shop-rules.js']) cpSync(join(ROOT, 'src', f), join(WWW, 'src', f));
cpSync(three, join(WWW, 'node_modules', 'three', 'build', 'three.module.js'));
cpSync(join(ROOT, 'game.contract.json'), join(WWW, 'game.contract.json'));
cpSync(join(ROOT, 'web', 'manifest.webmanifest'), join(WWW, 'manifest.webmanifest'));
// the page itself at the root (the WebView opens /index.html)
writeFileSync(join(WWW, 'index.html'), readFileSync(join(ROOT, 'web', 'index.html'), 'utf8'));
console.log(`web → ${WWW}`);
