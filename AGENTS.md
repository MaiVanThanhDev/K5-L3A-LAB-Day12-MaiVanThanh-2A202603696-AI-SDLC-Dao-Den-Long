# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js), 3 Đêm, lõi mô phỏng tất định chạy headless theo **Test Contract v1.3** (Phase 4, Ticket-04: bench, soak, bảng xếp hạng, trợ năng, phát hành v1.0.0). Game nằm ở **gốc repo**; đề lab ở `docs/lab/`.

## Lệnh
- Cài: `npm install` (Node ≥ 22) · Chơi: `npm start` → http://localhost:5173 · Xuất bảng xếp hạng: `npm start -- --export-leaderboard out.json`
- Test (bắt buộc xanh trước khi xong việc): `npm test` (Phase 1–4: `tests/cases.js`, `cases2.js`, `cases3.js`, `cases4.js`)
- Bench (`bench_cmd`): `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (mở cửa sổ Chrome thật) · Soak (`soak_cmd`): `node scripts/soak.js --seed 7 --nights 10 --out soak.json`
- Sinh bằng chứng: `npm run proof -- <phase>` → `docs/proof/phase-<N>/results.md`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every n]`
- Ảnh và FPS client thật (cần `PORT=5199 npm start` chạy song song): `CHROME=<chrome> node scripts/screens.js docs/proof/phase-<N>/img [tên ảnh…]` · `CHROME=<chrome> node scripts/fps-bench.js 15 docs/proof/phase-<N>/fps.json`

## Kiến trúc
- `src/sim/game.js` — TOÀN BỘ luật game. `step()` chia đúng **12 bước theo thứ tự bắt buộc của Ticket-02** (pause → timer → di chuyển/rơi → nhặt → đèn → vùng an toàn → Tỏa Sáng → bóng/Gió Lạc di chuyển → chạm → sinh → thắng/thua → snapshot). Không DOM, không `Math.random()` (dùng `this.rng`), timer tính bằng **tick nguyên**. `tick` tăng mọi bước; `sim_tick` chỉ tăng khi không tạm dừng — lịch sinh và thời gian dùng `simTick`.
- Đèn: `lit`, `fuel` (**số nguyên đơn vị 1/60**, 100 = 6000), `everLit`, `relitCount`. Vùng an toàn = `hasZone(L)` (sáng và fuel ≥ 30): mọi luật chặn Bóng Mực phải dùng hàm này, không dùng `L.lit`. Sức chứa = getter `capacity`, ngưỡng thắng = `winNeed`. Quyết định: `docs/adr/`.
- `src/sim/maps.js` — 3 bản đồ chuẩn (đèn, điểm sinh, bục nhảy, bùa) + `groundAt(x,z)` (độ cao mặt đất, `null` = biển mây, `TOWER` = vật rắn). Góc: (cx + r·cos a, y, cz + r·sin a).
- `src/sim/io.js` — validate inputs/scenario v1.2 → `FormatError` (headless thoát mã 2).
- `src/sim/bench.js` — cảnh bench chuẩn + đường bay camera; cờ `bench` của `Game` tắt sinh thêm/sát thương/nhặt/hao dầu/kết thúc. `src/leaderboard-rules.js` (luật, dùng cả ở trình duyệt) + `src/leaderboard.js` (lưu file) + API trong `server.js`.
- `src/headless.js` — CLI contract. `web/main.js` + `web/audio.js` — chỉ render, âm thanh, HUD, menu, đọc phím; **không** chứa luật.
- Số tuning đọc từ `game.contract.json` (nguồn duy nhất). Số chuẩn của ticket **không được đổi**. Số tự chọn (khóa không có trong ticket) đổi ở đó, kèm cập nhật README + `docs/notes/assumptions.md`.

## Quy tắc
- Đọc yêu cầu gốc (ticket/contract) trước; không bịa yêu cầu. Chỗ mơ hồ → ghi giả định vào `docs/notes/assumptions.md` (Phase 2: mục B, Phase 3: mục C, Phase 4: mục D).
- Mọi luật mới → thêm case vào `tests/cases<phase>.js` (chạy CLI thật, kiểm tra JSONL). Kỳ vọng lấy từ ticket hoặc tính tay (ghi phép tính trong comment), **không** copy output của game. Không viết test luôn đạt, không sửa tay output.
- Test cũ bị luật mới làm sai → sửa **kèm lý do** (comment `// v1.x:` + bảng trong CHANGELOG.md/assumptions.md), không skip, không tắt âm thầm.
- Change request thay luật cốt lõi → viết ADR (`docs/adr/NNNN-*.md`) và mục BREAKING trong `CHANGELOG.md` trước khi gắn tag.
- Thực thể "sáng tạo thêm" chỉ ở `web/` hoặc phải tắt ở headless — đầu ra headless không được đổi.
- Mỗi tính năng mới của ticket cần ≥ 1 scenario headless và một dòng AC trong `docs/spec/phase-<N>.md`.
- Hiệu năng: thực thể có thể nhiều (Bóng Mực, đom đóm) vẽ bằng instancing; HUD chỉ ghi DOM khi giá trị đổi. Đo bằng bench trước và sau mỗi thay đổi client.
- Không "chỉnh số" để qua ngưỡng: nếu số đo trượt, đo thêm để tìm nguyên nhân, ghi cấu hình đo vào báo cáo và giả định.
- Ảnh chụp phải mở ra xem thật trước khi dùng làm bằng chứng. Chrome headless mặc định (SwiftShader) cho FPS 1–2, không dùng để đo FPS: dùng `scripts/fps-bench.js` (GPU thật).
- Commit nhỏ, mỗi commit một việc. Không commit `.env`/key.
