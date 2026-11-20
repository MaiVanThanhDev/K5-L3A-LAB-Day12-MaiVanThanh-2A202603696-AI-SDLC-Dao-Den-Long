// Hook gate: runs the test suite.
//   stop  — blocks the agent from finishing while tests are red (exit 2 → message goes back to the agent).
//   edit  — after an Edit/Write to src/ or tests/, runs tests and reports failures to the agent.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mode = process.argv[2] || 'stop';
let payload = {};
try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no stdin */ }

if (mode === 'stop' && payload.stop_hook_active) process.exit(0); // avoid infinite loop
if (mode === 'edit') {
  const f = String(payload.tool_input?.file_path || '').replace(/\\/g, '/');
  if (!/\/(src|tests)\/|game\.contract\.json$/.test(f)) process.exit(0);
}

const r = spawnSync(process.execPath, ['--test', '--test-reporter=dot'], { cwd: ROOT, encoding: 'utf8' });
if (r.status === 0) process.exit(0);
const tail = (r.stdout + r.stderr).split('\n').filter((l) => /not ok|✖|Error|expected|actual|fail/.test(l)).slice(0, 30).join('\n');
process.stderr.write(`npm test đang ĐỎ — sửa trước khi kết thúc:\n${tail}\n`);
process.exit(2);
