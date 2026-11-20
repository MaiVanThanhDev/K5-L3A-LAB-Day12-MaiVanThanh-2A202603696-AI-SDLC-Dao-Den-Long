// Local leaderboard (Ticket-04 §3): JSON file storage on top of the shared rules. Used by server.js (API + --export-leaderboard).
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export { MAX_ENTRIES, normalizeName, validate, isoWithOffset, insert } from './leaderboard-rules.js';

export function load(file) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch { return []; }
}

export function save(file, entries) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  renameSync(tmp, file); // atomic replace: a crash never leaves a half-written leaderboard
}
