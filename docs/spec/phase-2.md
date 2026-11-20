# Spec Phase 2: Ticket-02 "Ba hòn đảo" (Contract v1.1)

Nguồn yêu cầu: Ticket-02 (giảng viên phát lúc mốc 1h). Phần 1 (số chuẩn), Phần 2 (bản đồ chuẩn) và Phần 4 (Test Contract v1.1) là số liệu bắt buộc, đã nằm nguyên trong [game.contract.json](../../game.contract.json) và [src/sim/maps.js](../../src/sim/maps.js). Tài liệu này viết **tiêu chí nghiệm thu (AC)** cho từng mục, nhất là Phần 3. Mỗi AC chỉ ra nơi kiểm chứng:

- `Pxx` / `Gxx` / `Cxx`: case trong [tests/cases2.js](../../tests/cases2.js) / [tests/cases.js](../../tests/cases.js), chạy CLI headless thật. Kết quả ở [docs/proof/phase-2/results.md](../proof/phase-2/results.md).
- `img/…`: ảnh chụp client thật (GPU, 1280×720) ở [docs/proof/phase-2/img/](../proof/phase-2/img/).
- `code`: phần chỉ có ở client (âm thanh, cài đặt). Kiểm tra bằng đọc code và chơi thử.

Chỗ ticket còn mơ hồ: xem [docs/notes/assumptions.md](../notes/assumptions.md) mục B.

## Phần 3: tính năng mới

### 3.1 Gió Lạc (Đêm 2 và 3)

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| D-1 | Chỉ có ở Đêm 2, 3. Sinh tại sim tick 1200, 2400, … ở một điểm sương ngẫu nhiên. Id D1, D2, … Tối đa 2 con còn sống. | P23 |
| D-2 | `idle` lượn 2 m/s. Chuyển `chase` khi Mây mang ≥ 5 đom đóm **và** cách ≤ 15 m (xét mỗi tick). Mất điều kiện thì về `idle`. | P21 (mang 6 → chase, mang 4 → idle) |
| D-3 | `chase` bay 7 m/s. Chạm (XZ ≤ 1.2 m) thì cướp min(3, đang mang), phát `drifter_steal {drifter_id, amount, carried}`, chuyển `flee`. | P21 (cướp ở tick 76 = tính tay) |
| D-4 | `flee`: bay ra xa Mây 7 m/s trong 240 tick, rồi `removed` cùng số đã cướp. Mỗi con chỉ cướp 1 lần. | P21 (removed đúng 240 tick sau) |
| D-5 | Tỏa Sáng trúng con đang `chase` thì nó chuyển `flee`, không cướp. | P22 |
| D-6 | Tỏa Sáng trúng con đang `flee` có mang đồ thì nó thả lại toàn bộ thành đom đóm rơi (`drifter_drop {drifter_id, amount}`) và biến mất sau 120 tick. | P22 |
| D-7 | Không làm mất Ngọn Lửa. Vùng an toàn không chặn. Bất tử của Mây không ngăn bị cướp. | P21 (`invuln_ticks: 600` vẫn bị cướp, flames giữ 3) |
| D-8 | Hình: dải lụa xám xanh `#8FA3B8` uốn lượn, mờ nhấp nháy khi `flee`. | img/night2-bridge-pad.png |

### 3.2 Bùa Gió

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| C-1 | Vị trí chuẩn: Đêm 2 (35,0,0); Đêm 3 (30,0,25) và (−30,0,25). Id C1, C2. Đêm 1 không có. | P2 |
| C-2 | Nhặt theo luật đom đóm (XZ ≤ 1 m, chênh cao ≤ 1.5 m). Phát `charm_picked {charm_id, charm_ticks: 600}`. | P7 |
| C-3 | Hiệu lực 600 tick (nhặt lại thì làm mới): chạy 7.2 m/s; hết hiệu lực thì về 6 m/s. | P7 |
| C-4 | Khi có bùa, Lướt không hồi chiêu nhưng vẫn phải nhấn lại. Nhấn khi đang lướt bị bỏ qua. Lướt vẫn 14 m/s trong 12 tick. | P8 |
| C-5 | Bùa xuất hiện lại sau 2700 tick. Snapshot `charms[]` có `id, available, respawn_s`. | P7 |
| C-6 | Hình: lá bùa đỏ `#C8102E` viền vàng `#F2C14E`. HUD báo "Bùa Gió n s", ô Lướt viền đỏ. | img/night2-bridge-pad.png, img/danger-clock-prompt.png |

### 3.3 Chuỗi 3 Đêm

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| N-1 | Menu chính → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. | img/menu.png, img/intro-night2.png; code `showIntro`, `endNight` trong web/main.js |
| N-2 | Ba bản đồ đúng chuẩn: Đảo Bến, Đảo Cau (2 đảo, cầu tre không lan can, 2 bục nhảy), Đảo Chuông (3 tầng, 2 dốc, bục nhảy, tháp chuông). | P2, P18, P19; img/night1-3lit.png, img/night2-bridge-pad.png, img/night3-tiers-wind.png, img/night3-launch.png |
| N-3 | Thắng Đêm 3 thì hiện màn Bình Minh với tổng điểm. | img/dawn.png |
| N-4 | Thua thì được chơi lại Đêm đó (nút "Chơi lại Đêm n"). Tổng điểm = tổng điểm các Đêm đã thắng. | img/result-lost.png; code `endNight` |
| N-5 | Ngọn Lửa hồi đầy (3) đầu mỗi Đêm. Thời lượng 300 / 330 / 360 s. | P2 (mỗi Đêm là một `Game` mới) |

### 3.4 Tạm dừng

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| P-1 | Esc hoặc P mở menu tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. | img/pause.png |
| P-2 | Logic dừng hoàn toàn: client không gọi `step()`. Headless: input `pause` (cạnh false→true) bật/tắt; `tick` vẫn tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot `state: "paused"`; event `paused {}` / `resumed {}`. | P24 (Bóng Mực sinh ở tick 400 khi dừng 100 tick) |
| P-3 | Tick vừa bấm pause dừng ngay ở bước đọc input. Nút khác bấm trong lúc dừng bị bỏ qua. | P24 |

### 3.5 Cài đặt

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| S-1 | Chỉnh âm lượng (0–100 %) và độ nhạy chuột (0.2–3×). Có hiệu lực ngay. | img/settings.png; code `set-vol`, `set-sens` |
| S-2 | Lưu giữa các lần mở game (`localStorage` khóa `ddl-settings`). Bộ nhớ trình duyệt bị chặn thì vẫn chạy với giá trị mặc định. | code `saveSettings` (try/catch) |

### 3.6 Âm thanh

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| A-1 | Nhạc nền đêm (drone + arpeggio ngũ cung, mỗi Đêm một giọng). Tắt khi tạm dừng hoặc hết Đêm. | code web/audio.js `startMusic` |
| A-2 | Hiệu ứng cho: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối. Thêm: rơi, Bùa Gió, bị cướp, cảnh báo gió. | code `sfx.*`, gọi trong `onEvent` |
| A-3 | Âm thanh tổng hợp bằng WebAudio, không cần file. Âm lượng theo Cài đặt. | code |

### 3.7 HUD đầy đủ

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| H-1 | Ngọn Lửa ở trên trái. Đồng hồ mm:ss ở trên giữa, ≤ 30 s thì đổi đỏ `#FF5A5F` và nhấp nháy. Đèn k/n và điểm ở trên phải. | img/danger-clock-prompt.png (00:22 đỏ) |
| H-2 | Thanh đom đóm 10 ô ở dưới giữa. Biểu tượng hồi chiêu Lướt và Tỏa Sáng ở dưới phải (che mờ theo thời gian hồi; Tỏa Sáng che kín khi < 3 đom đóm). | mọi ảnh gameplay |
| H-3 | Đứng trong 2 m của đèn chưa sáng thì hiện "E — Nạp ánh sáng (x/10)", x là số đã nạp vào đèn đó. | img/danger-clock-prompt.png (4/10) |
| H-4 | Mũi tên chỉ tới đèn chưa sáng gần nhất khi đèn đó ở ngoài màn hình. | img/night2-bridge-pad.png, img/night3-tiers-wind.png |

### 3.8 Bảng màu và ánh sáng

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| K-1 | Đúng hex chuẩn (đặt nguyên giá trị, sai lệch 0 %) cho trời/sương, cỏ/cát/gỗ/biển mây, đèn sáng/lõi/tắt, đom đóm lõi/quầng, Bóng Mực thân/viền/choáng, áo/khăn Mây và Bùa Gió, viền vàng/điểm, Gió Lạc, UI nguy hiểm/chữ. | bảng `C` trong web/main.js, biến CSS trong web/index.html |
| K-2 | Ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn). | code `ambient.intensity` trong `render()` |

## Phần 1, 2, 4: số chuẩn, bản đồ, contract v1.1 (tóm tắt AC)

| Mục | Tiêu chí | Kiểm chứng |
|---|---|---|
| Số chuẩn | `tuning` khớp bảng của ticket | P1 |
| Di chuyển, nhảy, lướt | 6 m/s tức thời; nhảy 7 m/s, g −20, chỉ khi chạm đất; lướt 14 m/s × 12 tick, hồi 90 tick, trên không giữ độ cao, không bất tử | P4, P5, P6, C4, G15 |
| Đom đóm | 20 con ở 20 điểm chuẩn khác nhau; +1 mỗi 240 tick ở điểm trống; nhặt XZ ≤ 1, chênh cao ≤ 1.5 | P2, P3, P9, G1, G2 |
| Đèn | 10 đom đóm, nạp nhiều lần; gần nhất, hòa thì id nhỏ; +10/đom đóm nạp, +100/đèn | P10, G3, G4, G11 |
| Vùng an toàn | 6 m; bóng trong vùng lúc thắp bị đẩy ra ≤ 30 tick, không gây hit | P11, G12 |
| Tỏa Sáng | 3 đom đóm, 5 m 3D từ chân + 0.8 m, choáng 120 tick, đẩy 4 m trong 15 tick, dừng ở vật cản, làm mới khi trúng lại, +5/bóng | P12, P13, G5, G6 |
| Bóng Mực | 4 m/s (Đêm 3: 4.5); phát hiện 12 / bỏ 18 m; chạm XZ ≤ 1 và chênh cao ≤ 1.5; 1 hit/tick theo id; recoil 2 m / 60 tick; lịch sinh và tối đa theo Đêm; ≥ 15 m | P14, P15, P26, G7, G13, G14 |
| Bị đánh, rơi | rơi floor(n/2) ra vành 1.5–2.5 m, TTL 480; bất tử 90; rơi khỏi đảo: 1 lần, mất hết, chờ 60, hồi sinh | P16, P17, G8 |
| Thắng/thua | sau mỗi tick: hết lửa luôn thua; đèn sáng hết thì thắng (kể cả tick hết giờ) | P25, G9, G10 |
| Bản đồ | Đêm 2 cầu + bục; Đêm 3 vách, dốc, bục, tháp; gió 30 s / 5 s / 2 m/s | P18, P19, P20 |
| Contract v1.1 | `--night 1|2|3`; trường snapshot mới; scenario mới; input dash/pause; sự kiện mới; tên trạng thái Bóng Mực; 21.600 tick ≤ 30 s | P2, P24, P27, P28 |
| Thứ tự trong tick | 12 bước đúng thứ tự ticket | các bước 1–12 trong `Game.step()` (src/sim/game.js) |
| ≥ 30 FPS ở 1280×720 | đo client thật bằng GPU | [docs/proof/phase-2/fps.json](../proof/phase-2/fps.json) |
