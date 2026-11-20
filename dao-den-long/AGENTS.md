# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js) + lõi mô phỏng tất định chạy headless theo **Test Contract** (hiện: v1.0, Phase 1).

## Lệnh
- Cài: `npm install` · Chơi: `npm start` → http://localhost:5173
- Test (bắt buộc xanh trước khi xong việc): `npm test`
- Sinh bằng chứng: `npm run proof -- <phase>` → `docs/proof/phase-<N>/results.md`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every n]`

## Kiến trúc
- `src/sim/game.js` — TOÀN BỘ luật game. Không DOM, không `Math.random()` (dùng `this.rng`), timer tính bằng **tick nguyên**.
- `src/sim/io.js` — validate inputs/scenario → `FormatError` (headless thoát mã 2).
- `src/headless.js` — CLI contract. `web/main.js` — chỉ render + đọc phím, **không** chứa luật.
- Số tuning đọc từ `game.contract.json` (nguồn duy nhất). Đổi số → đổi ở đó, cập nhật README + `docs/notes/assumptions.md`.

## Quy tắc
- Đọc yêu cầu gốc (ticket/contract) trước; không bịa yêu cầu. Chỗ mơ hồ → ghi giả định vào `docs/notes/assumptions.md`.
- Mọi luật mới → thêm case vào `tests/cases.js` (chạy CLI thật, kiểm tra JSONL). Không viết test luôn đạt, không sửa tay output.
- Test cũ bị luật mới làm sai → sửa/bỏ **kèm lý do** trong `docs/notes/assumptions.md`, không tắt âm thầm.
- Thực thể "sáng tạo thêm" chỉ ở `web/` hoặc phải tắt ở headless — đầu ra headless không được đổi.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`/key.
