// Accessory shop rules (creative feature, not part of the game contract): catalog, earning, buying, equipping.
// Shared by the server (src/shop-store.js, Postgres or JSON file) and the browser fallback (web/shop.js). No Node APIs.
// Currency: xu. After every Night (won or lost) the player earns xu = the score of that Night, once per run id.
import { normalizeName, checkName } from './leaderboard-rules.js';

export const SLOTS = ['hat', 'shirt', 'pants', 'shoes'];
export const SLOT_NAMES = { hat: 'Nón', shirt: 'Áo', pants: 'Quần', shoes: 'Giày' };
export const MAX_EARN = 5000;            // one Night cannot be worth more (best Night 3 run ≈ 2000)
const RUN_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// price 0 = starting item, owned by everyone. color = main colour; hat style picks the model in web/may.js.
export const CATALOG = [
  { id: 'hat_nonla', slot: 'hat', name: 'Nón lá', price: 0, color: 0xc9b48a, style: 'nonla' },
  { id: 'hat_rom', slot: 'hat', name: 'Mũ rơm', price: 300, color: 0xd9b45a, style: 'rom' },
  { id: 'hat_quaithao', slot: 'hat', name: 'Nón quai thao', price: 600, color: 0x6b4a2f, style: 'quaithao' },
  { id: 'hat_khanvan', slot: 'hat', name: 'Khăn vấn đỏ', price: 900, color: 0xc8102e, style: 'khan' },
  { id: 'hat_mugam', slot: 'hat', name: 'Mũ gấm vàng', price: 1500, color: 0xf2c14e, style: 'mu' },
  { id: 'shirt_nga', slot: 'shirt', name: 'Áo trắng ngà', price: 0, color: 0xe8e2d0 },
  { id: 'shirt_cham', slot: 'shirt', name: 'Áo chàm', price: 250, color: 0x2e4a7a },
  { id: 'shirt_do', slot: 'shirt', name: 'Áo đỏ lễ hội', price: 400, color: 0xb3262e },
  { id: 'shirt_luc', slot: 'shirt', name: 'Áo lục bình', price: 400, color: 0x3f7a5a },
  { id: 'shirt_gam', slot: 'shirt', name: 'Áo gấm vàng', price: 1200, color: 0xe0a92e },
  { id: 'pants_cham', slot: 'pants', name: 'Quần chàm', price: 0, color: 0x2a3366 },
  { id: 'pants_den', slot: 'pants', name: 'Quần lụa đen', price: 150, color: 0x1c1a22 },
  { id: 'pants_nau', slot: 'pants', name: 'Quần nâu đất', price: 150, color: 0x6b4a2f },
  { id: 'pants_trang', slot: 'pants', name: 'Quần trắng', price: 200, color: 0xeeeae0 },
  { id: 'shoes_nau', slot: 'shoes', name: 'Dép nâu', price: 0, color: 0x3a2a20 },
  { id: 'shoes_den', slot: 'shoes', name: 'Giày vải đen', price: 150, color: 0x15141a },
  { id: 'shoes_do', slot: 'shoes', name: 'Guốc đỏ', price: 200, color: 0xc8102e },
  { id: 'shoes_vang', slot: 'shoes', name: 'Hài thêu vàng', price: 800, color: 0xf2c14e },
];
export const ITEMS = Object.fromEntries(CATALOG.map((it) => [it.id, it]));
export const DEFAULT_OUTFIT = Object.fromEntries(SLOTS.map((s) => [s, CATALOG.find((it) => it.slot === s && it.price === 0).id]));
export const isFree = (id) => ITEMS[id]?.price === 0;

export class ShopError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Normalized player name or a ShopError (same rules as the leaderboard: 3–12 letters/digits/_ , Vietnamese accepted).
export function playerName(raw) {
  const name = normalizeName(raw);
  if (!checkName(name)) throw new ShopError('Tên cần 3–12 ký tự: chữ, số hoặc _');
  return name;
}

export const newProfile = (name) => ({ name, balance: 0, owned: [], equipped: { ...DEFAULT_OUTFIT }, runs: [] });
export const publicProfile = (p) => ({ name: p.name, balance: p.balance, owned: [...p.owned], equipped: { ...p.equipped } });

export function checkEarn(runId, score) {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) throw new ShopError('run_id không hợp lệ');
  if (!Number.isInteger(score) || score < 0 || score > MAX_EARN) throw new ShopError(`Điểm một Đêm phải là số nguyên 0–${MAX_EARN}`);
}
export function checkItem(itemId) {
  const it = ITEMS[itemId];
  if (!it) throw new ShopError('Không có món này trong cửa hàng', 404);
  return it;
}

// Pure transitions on an in-memory profile (file store + browser fallback). Each returns a new profile or throws ShopError.
export function earn(p, runId, score) {
  checkEarn(runId, score);
  if (p.runs.includes(runId)) return p; // the same Night is never paid twice
  return { ...p, balance: p.balance + score, runs: [...p.runs, runId] };
}
export function buy(p, itemId) {
  const it = checkItem(itemId);
  if (it.price === 0 || p.owned.includes(itemId)) throw new ShopError('Bạn đã có món này rồi', 409);
  if (p.balance < it.price) throw new ShopError(`Chưa đủ xu: cần ${it.price}, đang có ${p.balance}`, 409);
  return { ...p, balance: p.balance - it.price, owned: [...p.owned, itemId] };
}
export function equip(p, itemId) {
  const it = checkItem(itemId);
  if (it.price > 0 && !p.owned.includes(itemId)) throw new ShopError('Cần mua món này trước khi mặc', 409);
  return { ...p, equipped: { ...p.equipped, [it.slot]: itemId } };
}
// Equipped ids → item objects, unknown or missing slots fall back to the starting item.
export function outfitItems(equipped = {}) {
  return Object.fromEntries(SLOTS.map((s) => [s, ITEMS[equipped[s]]?.slot === s ? ITEMS[equipped[s]] : ITEMS[DEFAULT_OUTFIT[s]]]));
}
