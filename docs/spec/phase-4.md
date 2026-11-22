# Spec Phase 4: Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Yêu cầu phi chức năng và phát hành. Mỗi mục có số đo hoặc checklist. Kết quả tự động: [docs/proof/phase-4/results.md](../proof/phase-4/results.md). Giả định: [assumptions.md](../notes/assumptions.md) mục D.

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| **1. Benchmark** | | |
| B-1 | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` mở cửa sổ 1280×720 (không toàn màn hình), vsync tắt, tự thoát mã 0 sau 3 s khởi động + 30 s đo. | [bench.json](../../bench.json) (`viewport`, `vsync_off`, `headless: false`) |
| B-2 | Cảnh chuẩn: Đêm 1, đủ hiệu ứng và ánh sáng, đúng 200 Bóng Mực wander rải đều (seed 42), đúng 100 đom đóm, L1–L3 sáng fuel 100. Tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm. Bóng Mực vẫn đi theo luật wander. Mây đứng yên ở (0,0,0), không input. | R5; bench.json `scene`; [img/bench-scene.png](../proof/phase-4/img/bench-scene.png) |
| B-3 | Camera: vòng tròn tâm (0,0,0), r 30 m, Y 15 m, nhìn vào tâm, bắt đầu ở (30,15,0), ngược chiều kim đồng hồ nhìn từ trên, 15 s một vòng. | R6 (`benchCamera`) |
| B-4 | Trường `contract_version, avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms, peak_mem_mb, vsync_off, renderer, os` tính đúng định nghĩa: avg = 1000N/Σdt; 1 % low = 1000 / trung bình k = max(1, ceil(0.01N)) dt lớn nhất; p95 của dt. | `scripts/bench.js` (phép tính) + bench.json |
| B-5 | Ngưỡng (máy chấm): avg ≥ 60, 1 % low ≥ 30, load ≤ 10000 ms. | Máy tham khảo: 123.1 / 36.0 / 1747 ms |
| B-6 | Thực thể sáng tạo thêm tắt trong cảnh bench. | `decorate()` trả về sớm khi `?bench`; không có HUD message, phụ đề |
| **2. Soak** | | |
| S-1 | `node scripts/soak.js --seed 7 --nights 10 --out soak.json`: 10 Đêm trong cùng tiến trình, 1→2→3 xoay vòng, Đêm i dùng seed 7 + i, chạy tới khi kết thúc. Input ngẫu nhiên theo seed: đổi hướng mỗi 30 tick; mỗi tick 5 % nhảy, 3 % lướt, 2 % tỏa sáng, 10 % tương tác. | R7; [soak.json](../../soak.json) `per_night` |
| S-2 | `mem_start_mb` = RSS sau khi tải Đêm đầu; `mem_end_mb` = RSS sau khi reset Đêm cuối. Đạt: crashes = 0 và mem_end ≤ 1.2 × mem_start. | soak.json: 0 crash, 41.6 → 43.3 MB |
| **3. Bảng xếp hạng** | | |
| L-1 | Sau Bình Minh hoặc khi thua ở bất kỳ Đêm nào: nhập tên 3–12 ký tự [A-Za-z0-9_], tiếng Việt có dấu được chấp nhận (điểm cộng). | R2; [img/result-lost.png](../proof/phase-4/img/result-lost.png) |
| L-2 | Mỗi mục: name, score (tổng các Đêm đã thắng), nights_won (0–3), achieved_at (ISO 8601 có múi giờ), seed. | R2, R4 |
| L-3 | Top 10, điểm giảm dần, bằng điểm thì ai đạt trước đứng trên. | R3; [img/leaderboard.png](../proof/phase-4/img/leaderboard.png) |
| L-4 | Lưu trên đĩa, còn sau khi tắt và mở lại. Màn Bảng xếp hạng từ menu chính. | R4 (tắt server rồi xuất lại); img/leaderboard.png |
| L-5 | `npm start -- --export-leaderboard out.json` → `{"entries": [...]}` đúng thứ tự. | R4 |
| **4. Dễ tiếp cận** | | |
| A-1 | Đổi phím cho mọi hành động (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng); phát hiện và báo trùng phím; "Khôi phục mặc định"; được lưu. | [img/settings-a11y.png](../proof/phase-4/img/settings-a11y.png) (Nhảy = Tương tác = E, tô đỏ + cảnh báo) |
| A-2 | Phụ đề / chỉ báo hình ảnh: Bóng Mực xuất hiện (kèm mũi tên ở mép màn hình), gió sắp thổi, 10 s cuối, đèn fuel < 30. | [img/captions-arrow.png](../proof/phase-4/img/captions-arrow.png), [img/large-text.png](../proof/phase-4/img/large-text.png) |
| A-3 | Giảm chuyển động: tắt rung camera và hiệu ứng chớp màn hình. | code `settings.reducedMotion` (shake, `#flash`, nhấp nháy đồng hồ) |
| A-4 | Chữ UI tối thiểu 18 px ở 1280×720; tùy chọn chữ lớn ×1.25. | CSS `:root { font-size: 18px }`, mọi cỡ chữ ≥ 1rem; img/large-text.png |
| **5. Đóng gói & tài liệu** | | |
| P-1 | Clone sạch → tối đa 3 lệnh theo README → chơi được. | README "Cài đặt & chạy"; kiểm tra clone sạch (proof README) |
| P-2 | README có: mô tả, ảnh, yêu cầu hệ thống, cài đặt, điều khiển, test, headless, bench, soak. | [README.md](../../README.md) |
| P-3 | CHANGELOG có mục cho cả 4 phase; CREDITS liệt kê asset, âm thanh, công cụ AI; có LICENSE. | [CHANGELOG.md](../../CHANGELOG.md), [CREDITS.md](../../CREDITS.md), [LICENSE](../../LICENSE) |
| P-4 | GitHub Release v1.0.0 có bản chạy được. | Release v1.0.0: zip (kèm three.js, chạy `node server.js`) + Dockerfile |
| **6. Contract v1.3** | `contract_version: "1.3"`, `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên. | R1 + 62 case Phase 1–3 |
| **7. Retro & demo** | Retro 1–2 trang; video .mp4 < 5 phút. | [docs/notes/retro.md](../notes/retro.md); video: **chưa có** (xem proof README) |
| **8. Sau v1.0.0 (nhánh feature/shop-scenery)** | | |
| X-1 | Đẩy Bóng Mực ra mép vùng an toàn không bao giờ thả nó xuống biển mây hay vào tháp chuông; độ cao bám theo địa hình (giả định D17). | R9 |
| X-2 | Làng trên ba đảo (nhà, cổng làng, giếng, cây, đường đá, đèn trời) chỉ ở client, chặn Mây, tắt trong bench (D21). | [proof/shop-scenery](../proof/shop-scenery/README.md): ảnh village-*, bench-scene; kiểm tra va chạm trong client thật |
| X-3 | Mỗi Đêm chơi xong nhận xu = điểm Đêm đó, mỗi Đêm một lần (D18, D19). | SH2, SH4; ảnh result-xu |
| X-4 | Cửa hàng 4 ô: mua trừ đúng giá, không đủ xu / đã có / chưa mua mà mặc → lỗi; mặc đồ đổi ngoại hình Mây. | SH1, SH3; ảnh shop, shop-tryon |
| X-5 | Lưu PostgreSQL qua `docker compose`; mua song song không làm số dư âm; không có DB thì lưu file (D20). | SH4 (file, bật lại server), SH5 (PostgreSQL) |
| **9. Sau v1.0.0 (nhánh feature/boss-android, ADR 0002)** | | |
| X-6 | Không có `extras` thì đầu ra headless giống hệt v1.3 (nút banish bị bỏ qua, snapshot không thêm trường, không có boss) (D22). | X1; `cmp` ba Đêm trước/sau |
| X-7 | Diệt Bóng xóa Bóng Mực đang choáng trong 3 m, tốn 2 đom đóm, +20 mỗi con, hồi 1 s; bấm hụt vẫn tốn (D23). | X2, X3 |
| X-8 | Boss xuất hiện ở giây 60 tại điểm sinh xa Mây nhất, HP = 2 + Đêm; Tỏa Sáng làm choáng, Diệt Bóng trừ HP, HP 0 → defeated (+300); chạm Mây → −1 lửa (D25). | X4, X5, X9, X10 |
| X-9 | Skill boss báo trước 1.5 s: Triệu Hồi gọi 2 Bóng Mực, Nhật Thực hút 25 dầu của đèn trong 14 m và đánh Mây trong 5 m; Tỏa Sáng ngắt được (D26). | X6, X7, X8 |
| X-10 | Scenario/inputs mới sai định dạng → mã thoát 2; chạy hai lần cùng seed với extras cho kết quả giống hệt. | X11, X12 |
| X-11 | Chơi trên Android: điều khiển cảm ứng (joystick, kéo camera, 5 nút), PWA cài được, app Capacitor chạy offline, APK build trên CI (D29). | ảnh touch-phone, touch-play (bản `android-app/www` không server); kiểm tra chạm thật qua CDP; workflow android.yml |
