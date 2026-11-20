// npm run proof — runs every verification case through the real headless CLI and writes
// docs/proof/phase-<N>/results.md (requirement → check → actual output → PASS/FAIL).
// Output is generated, never hand-edited. Exit code 1 if any case fails.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { cases, ROOT, runHeadless } from '../tests/cases.js';

const phase = process.argv[2] || '1';
const dir = join(ROOT, 'docs', 'proof', `phase-${phase}`);
mkdirSync(join(dir, 'out'), { recursive: true });

const rows = [];
let failed = 0;
for (const c of cases) {
  let status = 'PASS', detail;
  try { detail = c.run(); } catch (e) { status = 'FAIL'; failed++; detail = e.message.split('\n')[0]; }
  rows.push(`| ${c.id} | ${c.req} | ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${String(detail).replace(/\|/g, '\\|')} |`);
  console.log(`${status} ${c.id} ${c.req}`);
}

// Sample full runs kept as artefacts (reviewers can re-run and diff).
const sample = { seed: 42, ticks: 3600, inputs: [{ tick: 0, move: [0, 1] }, { tick: 300, move: [1, 0.2], cam_yaw_deg: 45 }, { tick: 900, pulse: true }, { tick: 901, pulse: false }] };
const a = runHeadless({ ...sample, outFile: join(dir, 'out', 'seed42-run1.jsonl') });
const b = runHeadless({ ...sample, outFile: join(dir, 'out', 'seed42-run2.jsonl') });
const same = a.text === b.text;
if (!same) failed++;

let commit = 'uncommitted';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* no git */ }

const md = `# Bằng chứng Phase ${phase} — kết quả tự động

> Sinh bởi \`npm run proof\` (không sửa tay). Mỗi dòng chạy **CLI headless thật** (\`node src/headless.js …\`) và kiểm tra JSONL đầu ra.
> Cùng các case này chạy trong \`npm test\` và CI. Commit lúc sinh: \`${commit}\` · Node ${process.version} · ${os.type()} ${os.release()} · ${os.cpus()[0]?.model ?? ''}

**Tổng: ${rows.filter((r) => r.includes("PASS")).length}/${cases.length} case đạt.**

| ID | Yêu cầu | Kết quả | Quan sát thực tế |
|---|---|---|---|
${rows.join('\n')}

## Tính tất định (chạy dài)

Lệnh (chạy 2 lần): \`node src/headless.js --seed 42 --night 1 --inputs <inputs> --ticks 3600 --out out/seed42-runN.jsonl\`

- out/seed42-run1.jsonl và out/seed42-run2.jsonl: **${same ? 'giống hệt từng byte ✅' : 'KHÁC NHAU ❌'}** (${a.lines.length} dòng, dòng cuối \`${JSON.stringify(a.lines.at(-1))}\`)
`;
writeFileSync(join(dir, 'results.md'), md);
console.log(`\n${failed ? 'FAILED' : 'ALL PASS'} → ${join('docs', 'proof', `phase-${phase}`, 'results.md')}`);
process.exit(failed ? 1 : 0);
