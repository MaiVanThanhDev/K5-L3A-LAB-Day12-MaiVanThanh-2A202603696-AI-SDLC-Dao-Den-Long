# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js), 3 Đêm, lõi mô phỏng tất định chạy headless theo **Test Contract v1.1** (Phase 2, Ticket-02 "Ba hòn đảo").

## Lệnh
- Cài: `npm install` · Chơi: `npm start` → http://localhost:5173
- Test (bắt buộc xanh trước khi xong việc): `npm test` (Phase 1 regression `tests/cases.js` + Phase 2 `tests/cases2.js`)
- Sinh bằng chứng: `npm run proof -- <phase>` → `docs/proof/phase-<N>/results.md`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every n]`
- Ảnh và FPS client thật (cần `PORT=5199 npm start` chạy song song): `CHROME=<chrome> node scripts/screens.js docs/proof/phase-<N>/img [tên ảnh…]` · `CHROME=<chrome> node scripts/fps-bench.js 15 docs/proof/phase-<N>/fps.json`

## Kiến trúc
- `src/sim/game.js` — TOÀN BỘ luật game. `step()` chia đúng **12 bước theo thứ tự bắt buộc của Ticket-02** (pause → timer → di chuyển/rơi → nhặt → đèn → vùng an toàn → Tỏa Sáng → bóng/Gió Lạc di chuyển → chạm → sinh → thắng/thua → snapshot). Không DOM, không `Math.random()` (dùng `this.rng`), timer tính bằng **tick nguyên**. `tick` tăng mọi bước; `sim_tick` chỉ tăng khi không tạm dừng — lịch sinh và thời gian dùng `simTick`.
- `src/sim/maps.js` — 3 bản đồ chuẩn (đèn, điểm sinh, bục nhảy, bùa) + `groundAt(x,z)` (độ cao mặt đất, `null` = biển mây, `TOWER` = vật rắn). Góc: (cx + r·cos a, y, cz + r·sin a).
- `src/sim/io.js` — validate inputs/scenario v1.1 → `FormatError` (headless thoát mã 2).
- `src/headless.js` — CLI contract. `web/main.js` + `web/audio.js` — chỉ render, âm thanh, HUD, menu, đọc phím; **không** chứa luật.
- Số tuning đọc từ `game.contract.json` (nguồn duy nhất). Số chuẩn của ticket **không được đổi**. Số tự chọn (khóa không có trong ticket) đổi ở đó, kèm cập nhật README + `docs/notes/assumptions.md`.

## Quy tắc
- Đọc yêu cầu gốc (ticket/contract) trước; không bịa yêu cầu. Chỗ mơ hồ → ghi giả định vào `docs/notes/assumptions.md` (Phase 2: mục B).
- Mọi luật mới → thêm case vào `tests/cases2.js` (chạy CLI thật, kiểm tra JSONL). Kỳ vọng lấy từ ticket hoặc tính tay (ghi phép tính trong comment), **không** copy output của game. Không viết test luôn đạt, không sửa tay output.
- Test cũ bị luật mới làm sai → sửa **kèm lý do** (comment `// v1.1:` + bảng trong assumptions.md), không tắt âm thầm.
- Thực thể "sáng tạo thêm" chỉ ở `web/` hoặc phải tắt ở headless — đầu ra headless không được đổi.
- Mỗi tính năng mới của ticket cần ≥ 1 scenario headless và một dòng AC trong `docs/spec/phase-<N>.md`.
- Ảnh chụp phải mở ra xem thật trước khi dùng làm bằng chứng. Chrome headless mặc định (SwiftShader) cho FPS 1–2, không dùng để đo FPS: dùng `scripts/fps-bench.js` (GPU thật).
- Commit nhỏ, mỗi commit một việc. Không commit `.env`/key.
