// Leaderboard rules shared by the server (src/leaderboard.js) and the browser fallback (web/main.js). No Node APIs.
export const MAX_ENTRIES = 10;
// 3–12 characters: letters (Vietnamese with diacritics accepted), digits, underscore. Length counted in characters after NFC.
const NAME_RE = /^[\p{L}\p{M}\p{N}_]+$/u;

export function normalizeName(name) {
  return typeof name === 'string' ? name.normalize('NFC').trim() : '';
}

// true if an already-normalized name is 3–12 characters (combining marks not counted) of letters, digits or _
export function checkName(name) {
  const len = [...name.replace(/\p{M}/gu, '')].length;
  return len >= 3 && len <= 12 && NAME_RE.test(name);
}

// Returns { entry } or { error }.
export function validate(input, now = new Date()) {
  if (!input || typeof input !== 'object') return { error: 'body must be a JSON object' };
  const name = normalizeName(input.name);
  if (!checkName(name)) return { error: 'name must be 3–12 characters: letters, digits or _' };
  const { score, nights_won: nightsWon, seed } = input;
  if (!Number.isInteger(score) || score < 0) return { error: 'score must be a non-negative integer' };
  if (!Number.isInteger(nightsWon) || nightsWon < 0 || nightsWon > 3) return { error: 'nights_won must be an integer 0–3' };
  if (!Number.isInteger(seed)) return { error: 'seed must be an integer' };
  return { entry: { name, score, nights_won: nightsWon, achieved_at: isoWithOffset(now), seed } };
}

// ISO 8601 with the local UTC offset, e.g. 2026-11-20T16:31:05.123+07:00
export function isoWithOffset(d = new Date()) {
  const pad = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
    + `${off >= 0 ? '+' : '-'}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

// Score descending; equal score → whoever achieved it first stays above (stable for identical timestamps).
export function insert(entries, entry) {
  const all = [...entries, entry];
  const order = all.map((e, i) => ({ e, i, t: Date.parse(e.achieved_at) }));
  order.sort((a, b) => b.e.score - a.e.score || a.t - b.t || a.i - b.i);
  const top = order.slice(0, MAX_ENTRIES).map((o) => o.e);
  return { entries: top, rank: top.indexOf(entry) + 1 || null };
}

