---
name: verify
description: Chạy kiểm chứng Đảo Đèn Lồng và lưu bằng chứng — dùng sau khi đổi luật game, trước khi gắn tag phase-N, hoặc khi cần chứng minh một yêu cầu.
---

# Kiểm chứng + bằng chứng

1. `npm test` — toàn bộ case trong `tests/cases.js` (chạy CLI headless thật). Phải xanh.
2. Yêu cầu mới chưa có case? Thêm vào `tests/cases.js`: `{ id, req: '<trích yêu cầu>', run() { … assert …; return '<quan sát thực tế>' } }`.
   Dùng `runHeadless({ scenario, inputs, ticks, every })` với scenario `quiet` (không ngẫu nhiên) để kết quả tính tay được.
   Giá trị kỳ vọng lấy từ `TUNING` (game.contract.json) hoặc tính tay — KHÔNG copy từ output của game.
3. `npm run proof -- <phase>` → ghi `docs/proof/phase-<N>/results.md` + 2 lần chạy seed 42 để chứng minh tất định.
4. Thứ chỉ nhìn mới thấy (HUD, đèn sáng, Bóng Mực): chạy `PORT=5199 npm start` rồi chụp bằng Chrome headless:
   `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/phase-<N>/img/<ten>.png "http://localhost:5199/?autostart&seed=3&scenario=/tests/scenarios/<file>.json"`
   Mở ảnh xem thật, ghi ảnh chứng minh yêu cầu nào trong `docs/proof/phase-<N>/README.md`.
5. Ghi trung thực: yêu cầu chưa đạt → "chưa đạt" + lý do.
