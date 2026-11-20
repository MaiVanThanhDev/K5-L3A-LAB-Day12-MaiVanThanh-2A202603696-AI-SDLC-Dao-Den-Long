# Spec Phase 3: Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Change request thay luật cốt lõi. Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md). Giả định: [assumptions.md](../notes/assumptions.md) mục C. Kết quả tự động: [docs/proof/phase-3/results.md](../proof/phase-3/results.md).

| # | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| **1. Nhiên liệu đèn** | | |
| F-1 | Vừa thắp (lần đầu hoặc thắp lại) thì fuel = 100. Đang sáng hao 1/giây (1/60 mỗi tick), tính bằng đơn vị nguyên. | F2 (đầy → tắt đúng tick 6000), F4 |
| F-2 | Châm dầu: used = min(mang, ceil((100 − fuel)/10)), fuel = min(100, fuel + 10·used). Phát `refuel {lantern_id, amount, fuel}`, +5 mỗi đom đóm. | F5, P10 |
| F-3 | Tương tác chỉ xét đèn nhận được (tắt, hoặc sáng chưa đầy). Gần nhất, hòa thì id nhỏ. | P10, F5 |
| F-4 | fuel ≤ 0 → tắt, deposited = 0, `lantern_out`, `ever_lit` vẫn true. Tắt ngay sau bước 2. | F3, F9 |
| F-5 | Thắp lại đèn `ever_lit` cần 5 đom đóm; đèn chưa từng sáng cần 10. `lantern_lit.relight`. | F4, G3 |
| F-6 | Hiển thị thanh dầu trên đèn sáng. fuel < 30 thì đèn và thanh nhấp nháy chậm 1 Hz. | img/p3-fuel-drain.png; code `render()` (cos(2πt)) |
| **2. Bóng Mực hút dầu** | | |
| D-1 | fuel < 30 mất vùng an toàn; đúng 30 vẫn còn. | F6 |
| D-2 | Chỉ con `wander` chọn đèn yếu gần nhất (hòa thì id nhỏ); không có thì đi về đèn tắt gần nhất. Con `chase` không đổi mục tiêu. | F7 |
| D-3 | Cách đèn ≤ 2 m (XZ) → `drain`: đứng yên, hút 5/giây, nhiều con cộng dồn, đèn vẫn tự hao 1/giây. `fuel_drain` mỗi 60 tick. | F8 |
| D-4 | Từ drain: Mây ≤ 6 m → chase; trúng Tỏa Sáng → stunned; đèn tắt / fuel ≥ 30 / > 2 m → wander. Hết choáng → wander. | F9, F10 |
| D-5 | Châm lên ≥ 30 khi có bóng trong 6 m → đẩy ra mép ≤ 30 tick, không gây sát thương. | F10 |
| **3. Luật thắng** | | |
| W-1 | Thời lượng 240 / 270 / 300 s. | F1, P2 |
| W-2 | Thắng: còn sống ở tick bình minh và số đèn sáng ≥ ceil(0.6 × tổng) (3/5, 4/6, 5/7) → `dawn_survived`. Thắp đủ không kết thúc Đêm. | G11, F11, P25 |
| W-3 | Thua: hết lửa (ngay lập tức, kể cả tick cuối, xét trước) hoặc bình minh mà thiếu đèn → `dawn`. | P25, F11, G9, G10 |
| **4. Sức chứa** | | |
| C-1 | Sức chứa = 10 + 2 × successful_lights, tối đa 20. Thắp lại cũng tính, đèn đặt sẵn không tính. Đặt lại mỗi Đêm. HUD "mang/sức chứa". | F12, F1; img/p3-fuel-drain.png (7/14) |
| **5. Điểm** | | |
| S-1 | +5 mỗi đom đóm nạp (thắp, thắp lại, châm). +100 thắp lần đầu. +40 thắp lại. Tỏa Sáng +5/con, +15 nếu đang drain. Bình minh (chỉ khi thắng): +50 + floor(fuel) mỗi đèn sáng, +50 mỗi lửa. Bỏ thưởng thời gian. | G3, F4, F5, P12, F9, G11 |
| **6. Mù màu** | | |
| M-1 | Cài đặt "Bảng màu dễ phân biệt", được lưu: viền và mắt Bóng Mực `#7A3CFF` → `#00B3FF`; cảnh báo UI `#FF5A5F` → `#FFFFFF` kèm ⚠. | img/p3-colorblind.png (⚠ 00:20 trắng, "⚠ cần 3 lúc bình minh") |
| M-2 | Phân biệt đèn tắt/sáng không cần màu: đèn tắt xẹp 20 % và có vết rách; đèn sắp hết dầu nhấp nháy. | img/p3-fuel-drain.png (L5 xẹp, rách) |
| **7. Contract v1.2** | | |
| K-1 | `contract_version: "1.2"`, tuning mới, thời lượng mới. | F1 |
| K-2 | Snapshot: `lanterns[].fuel` (1 chữ số), `ever_lit`, `relit_count`; `player.capacity`; trạng thái `drain`. | F1, F3, F8 |
| K-3 | Scenario: `lanterns[].lit/fuel/ever_lit` (lit không có fuel → 100), `player.successful_lights`, `shades[].target_lantern_id`. Sai kiểu → mã 2. | F1, F8, F12, F13 |
| K-4 | Sự kiện `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight`; `game_over.reason` có `dawn_survived`, không còn `all_lit`. | F3–F5, F8, G11 |
| K-5 | Thứ tự trong tick: trừ dầu ở bước 2, tắt ngay sau bước 2, xét thắng/thua sau mọi cập nhật. | F3, F9, P25; `Game.step()` |
| **DoD** | ADR · changelog breaking · test cũ cập nhật có lý do · test ẩn Phase 1–2 không bị thay vẫn đạt | ADR 0001, CHANGELOG.md, 62/62 case |
