# Giả định & tiêu chí nghiệm thu

## Phase 1 — PRD-0 + Test Contract v1.0

### Chỗ PRD-0 mơ hồ → giả định của tôi

| # | Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|---|
| A1 | "Tỏa sáng tốn ánh sáng": tốn cái gì? | Tốn `pulse_cost` = 2 đom đóm đang mang. Không đủ thì không tỏa sáng được (không có event `pulse`). | Ánh sáng chính là đom đóm, tạo đánh đổi giữa thắp đèn và tự vệ. |
| A2 | "Bóng Mực sợ đèn": đèn nào? | Chỉ đèn **đã thắp**. Bóng Mực bị đẩy ra biên `safe_radius` = 5 m. | Thắp đèn tạo vùng an toàn, có ý nghĩa gameplay. |
| A3 | Máu | 3 "ngọn lửa" (`flames`). Mỗi lần chạm mất 1, bất tử 1.5 s. | Hợp chủ đề ánh sáng. |
| A4 | Bị chạm thì sao với đom đóm? | Rơi `floor(carried × 0.5)` con, đặt lại trên vòng 2.5 m quanh Mây (ngoài `pickup_radius`), nhặt lại được. | Phạt nhưng không mất hẳn. |
| A5 | Nạp đèn | Bấm interact trong `interact_radius` = 2.5 m của đèn **chưa thắp** gần nhất: nạp `min(carried, lantern_cost − deposited)`. Đủ 5 thì thắp. | Nạp một lần là xong, không thừa. |
| A6 | Đom đóm xuất hiện thế nào? | 30 con rải ngẫu nhiên (theo seed) trong vành 3–38 m. Cứ 3 s sinh 1 con nếu đang < 30. | Luôn đủ để thắp 25 điểm đèn. |
| A7 | Bóng Mực xuất hiện thế nào? | Con đầu ở 5 s (tick 300), sau đó cứ 20 s một con, tối đa 6. Sinh ở rìa (36 m), không sinh trong vùng an toàn. Luôn đuổi Mây với 3.5 m/s (chậm hơn Mây 6 m/s). | Áp lực tăng dần nhưng vẫn chạy thoát được. |
| A8 | Tỏa sáng cụ thể | Choáng 3 s mọi Bóng Mực trong 6 m, đẩy ra xa 4 m, hồi chiêu 1 s. Bóng Mực bị choáng không di chuyển và không gây sát thương. | |
| A9 | Thua | Hết lửa (`no_flames`) hoặc hết 300 s (`dawn`). | Contract có sẵn 2 lý do này. |
| A10 | Điểm | Xem README. Thưởng thời gian và lửa còn lại **chỉ khi thắng**; giây còn lại làm tròn xuống. | |
| A11 | Rơi khỏi đảo | Không có. Đảo bán kính 40 m có rìa chặn → `fall_enabled = false`. | Giảm phạm vi Phase 1. |
| A12 | Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s², đỉnh khoảng 1.2 m. Nhảy **không** né được Bóng Mực (khoảng cách đo theo mặt phẳng XZ như contract). | Contract đo theo XZ. |
| A13 | Vị trí đèn mặc định | L1…L5 trên vòng 25 m, L1 ở (0,0,25), mỗi đèn cách nhau 72°. | Khớp ví dụ L1 trong contract. |

### Giả định về chi tiết contract

- Thứ tự trong 1 bước: timer → di chuyển → nhảy → nhặt → nạp → tỏa sáng → sinh Bóng Mực → Bóng Mực di chuyển → va chạm → sinh đom đóm → kiểm tra kết thúc (thắng ưu tiên trước thua).
- Mọi timer (bất tử, hồi chiêu, choáng, sinh) tính bằng **số tick nguyên** (`round(s × 60)`) để tránh sai số float.
- Scenario: `motes`/`shades` thay thế danh sách ban đầu. Nếu `random_*` không phải `false` thì vẫn sinh thêm theo lịch. Shade không có `id` sẽ nhận `S1, S2…` (bỏ qua id đã được dùng). Lantern id không tồn tại → mã thoát 2.
- Snapshot có thêm mảng `motes` (khuyến nghị v1.0). Không ghi snapshot thừa ngoài chu kỳ `--snapshot-every`.
- Mã thoát: lỗi tham số dòng lệnh → 1; file inputs/scenario không đọc được hoặc sai định dạng → 2.

### Tiêu chí nghiệm thu (mỗi dòng có case trong `tests/cases.js`)

C1 format snapshot/end · C2 tất định · C3 mã thoát · C4 move theo camera · C5 mô hình tick · G1 pickup · G2 capacity · G3/G4 nạp & thắp · G5/G6 tỏa sáng · G7/G8 bị chạm · G9 thua no_flames · G10 thua dawn · G11 thắng + điểm · G12 safe radius · G13 Bóng Mực đuổi · G14 sinh ngẫu nhiên · G15 nhảy · G16 scenario không phát event, rìa đảo.
Kết quả: [docs/proof/phase-1/results.md](../proof/phase-1/results.md).
