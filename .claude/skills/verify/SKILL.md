---
name: verify
description: Chạy kiểm chứng Đảo Đèn Lồng (contract v1.2, 3 Đêm, đèn có dầu) và lưu bằng chứng — dùng sau khi đổi luật game, trước khi gắn tag phase-N, hoặc khi cần chứng minh một yêu cầu.
---

# Kiểm chứng + bằng chứng

1. `npm test` — toàn bộ case trong `tests/cases.js`, `tests/cases2.js`, `tests/cases3.js` (Phase 1–3), chạy CLI headless thật. Phải xanh.
2. Yêu cầu mới chưa có case? Thêm vào `tests/cases<phase>.js`: `{ id, req: '<trích yêu cầu>', run() { … assert …; return '<quan sát thực tế>' } }`.
   Dùng `runHeadless({ night, scenario, inputs, ticks, every })` với scenario `Q` (không ngẫu nhiên: không đom đóm/bóng/Gió Lạc tự sinh, không gió, không bùa mặc định) để kết quả tính tay được.
   Giá trị kỳ vọng lấy từ ticket, `TUNING` (game.contract.json) hoặc tính tay — KHÔNG copy từ output của game. Ghi phép tính vào comment (ví dụ `y_k = (14k − k(k+1)/6)/60 → chạm đất ở k = 83`).
   Nhớ mô hình tick: sự kiện của bước k ghi `tick = k+1`; bộ đếm N tick đặt ở bước k hết sau N bước.
   Dầu đèn: tính bằng FU = 1/60 (hao 1 FU/tick, mỗi con drain 5 FU/tick, 1 đom đóm = 600 FU); bước 2 trừ dầu **trước** tương tác ở bước 5.
3. `npm run proof -- <phase>` → ghi `docs/proof/phase-<N>/results.md` + 2 lần chạy seed 42 để chứng minh tất định.
4. Thứ chỉ nhìn mới thấy (HUD, menu, bản đồ, màu): chạy `PORT=5199 npm start`, rồi `CHROME=<đường dẫn chrome> node scripts/screens.js docs/proof/phase-<N>/img [tên ảnh]`.
   Scenario cho ảnh ở `tests/scenarios/screenshot-*.json`. URL nhận `?autostart&night=N&seed=S&scenario=…&yaw=độ&fps`.
   **Mở từng ảnh ra xem thật**, ghi ảnh chứng minh yêu cầu nào trong `docs/proof/phase-<N>/README.md`.
5. FPS: `CHROME=… node scripts/fps-bench.js 15 docs/proof/phase-<N>/fps.json` (GPU thật, ép viewport 1280×720). Không đo FPS bằng `--use-angle=swiftshader`.
6. E2E: `node scripts/bot.js <seed> b.json <night>` rồi phát lại `node src/headless.js --seed <seed> --night <night> --inputs b.json --ticks 21600 --out o.jsonl` — dòng `end` phải khớp kết quả bot.
7. Ghi trung thực: yêu cầu chưa đạt → "chưa đạt" + lý do.
