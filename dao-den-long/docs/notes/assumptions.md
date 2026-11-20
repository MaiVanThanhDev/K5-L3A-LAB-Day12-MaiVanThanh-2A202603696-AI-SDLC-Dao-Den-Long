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

> **Ghi chú Phase 2:** Ticket-02 thay toàn bộ số tự chọn ở trên bằng số chuẩn (xem `game.contract.json`). Các giả định A1–A13 chỉ còn giá trị lịch sử khi chúng trái với số chuẩn.

## Phase 2 — Ticket-02 + Test Contract v1.1

Spec và tiêu chí nghiệm thu: [docs/spec/phase-2.md](../spec/phase-2.md). Dưới đây là những chỗ ticket chưa nói rõ và cách tôi chọn.

### B. Chỗ Ticket-02 mơ hồ → giả định

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | "Tăng tốc/dừng trong ≤ 0.1 s" | Đạt tốc độ và dừng **ngay trong 1 tick** (0.017 s ≤ 0.1 s). Giữ được C4 cũ (60 tick đi đúng 6 m). |
| B2 | Quy ước góc | (cx + r·cos a, y, cz + r·sin a). Kiểm tra: tầng 1 "nửa z > 0" chứa các điểm 20°…160° và đèn (18,3,10). |
| B3 | Điểm xuất phát Đêm 2, 3 | Đêm 1, 2: (0,0,0) quay mặt +Z. **Đêm 3: (0,0,0) nằm trong tháp chuông**, nên chọn (0,0,−20) trên tầng 0, quay mặt +Z (nhìn về tháp), cách mọi điểm sinh Bóng Mực ≥ 15 m. |
| B4 | Trần 30 đom đóm | Đếm mọi đom đóm đang có (ngẫu nhiên + rơi). Đêm 1 và 2 chỉ có 24 điểm sinh nên đom đóm ngẫu nhiên tối đa 24. "Điểm trống" là điểm chưa có đom đóm ngẫu nhiên; đom đóm rơi không chiếm điểm. |
| B5 | Trạng thái `spawning` | Bóng mới sinh ở `spawning` 30 tick (0.5 s): không di chuyển, không gây hit, nhưng vẫn trúng Tỏa Sáng. Bóng đặt bằng scenario mặc định là `chase` (v1.0: "hoạt động bình thường ngay lập tức"). |
| B6 | `wander` | Lượn 1.5 m/s, đổi hướng ngẫu nhiên (theo seed) mỗi 120 tick hoặc khi bị chặn. Hết `spawning`, `stunned`, `recoil` thì về `wander`, rồi tick sau xét phát hiện 12 m. |
| B7 | "Chênh cao" khi Bóng Mực chạm | `shade.pos` là tâm, bay cao 1 m trên mặt đất. Chênh cao = \|chân Mây − (tâm bóng − 1 m)\|. Bóng bám mặt đất: không rời đảo, không leo vách > 0.5 m (đi được dốc), không vào tháp; nhảy xuống tầng dưới được. |
| B8 | Vùng an toàn | Ngoài trường hợp "đèn vừa thắp", bóng nằm trong vùng sáng vì lý do khác (ví dụ scenario đặt sẵn) cũng bị đẩy ra theo cùng luật 30 tick. Bóng đang bị đẩy không gây hit. |
| B9 | Đẩy lùi của Tỏa Sáng | Hướng ngang từ tâm Tỏa Sáng tới tâm bóng (trùng XZ → +X). "Vật cản": mép đảo, vách tầng, tháp, mép vùng sáng. Gặp vật cản thì dừng hẳn phần đẩy còn lại. |
| B10 | Lướt | Trong lúc lướt, vận tốc dọc **được giữ nguyên** (đóng băng), hết lướt thì chuyển động dọc tiếp tục. Không nhảy được khi đang lướt. Bấm lướt khi đang lướt luôn bị bỏ qua. Có bùa: không đặt hồi chiêu. |
| B11 | Rơi khỏi đảo | Trong 60 tick chờ, Mây đứng yên ở chỗ rơi (Y < −10), `vel` = 0, không nhặt, không nạp, không tỏa sáng, không bị chạm hay cướp. Hồi sinh ở điểm xuất phát của Đêm, quay mặt như lúc đầu. |
| B12 | Vách và dốc | Mây đi lên được bậc ≤ 0.35 m mỗi tick (dốc tăng 0.05 m/tick), cao hơn thì bị chặn (trượt dọc theo vách). Đang đứng thì bám xuống mặt đất nếu thấp hơn ≤ 0.35 m, sâu hơn thì rơi. Tháp chuông là vật rắn. |
| B13 | Bục nhảy | Kích hoạt khi Mây đứng trên bục (XZ ≤ 1 m, đúng độ cao bục). Bắn từ tick sau. Hướng ngang Đêm 2: từ tâm bục tới tâm đảo kia. Vận tốc phóng giữ tới khi chạm đất; lướt giữa không trung thay vận tốc ngang trong 12 tick. |
| B14 | Gió Đêm 3 | Cơn gió bắt đầu ở sim tick 1800, 3600, … (mỗi 30 s, không có cơn ở 0 s), kéo dài 300 tick, đẩy 2 m/s theo hướng `dir_deg` (số nguyên, chọn theo seed lúc bắt đầu báo trước, tick 1680 + 1800k). Báo trước 2 s chỉ là hình và âm thanh. Không có gió thì `dir_deg` = `null`. Gió tác động cả khi đang bay. |
| B15 | Gió Lạc | Chỉ con đang `chase` mới cướp. Chạm chỉ xét XZ (ticket không nêu chênh cao). Bay ở độ cao mặt đất + 1.5 m, bay qua vách và biển. "Điểm sương" là các điểm sinh Bóng Mực của Đêm. Đom đóm thả lại nằm trong 0.3–1 m quanh con Gió Lạc; rơi trúng biển thì mất. Không có sự kiện sinh Gió Lạc (ticket không định nghĩa). Con đã `removed` vẫn nằm trong `drifters[]` để test tham chiếu, không tính vào tối đa 2. |
| B16 | Bùa Gió | Đếm 2700 tick hồi từ lúc nhặt. Không chiếm sức chứa đom đóm. |
| B17 | Tạm dừng ở cuối lần chạy | Snapshot ghi `state: "paused"`. Dòng `end` vẫn ghi `playing` vì contract chỉ định nghĩa `playing / won / lost` cho `end`. |
| B18 | `player.invuln` | Kiểu boolean (đang bất tử hay không). Các trường thời gian có hậu tố `_s` tính bằng giây. |
| B19 | Điểm đom đóm | Theo bảng điểm chuẩn: +10 cho **mỗi đom đóm nạp vào đèn**, nhặt không còn được điểm. |
| B20 | Scenario v1.1 | `motes[]` nhận `[x,y,z]` hoặc `{pos, kind, ttl_ticks \| ttl_s}`. `shades[].state_ticks_left` là số tick còn lại của `stunned` / `recoil` / `spawning`. `drifters[]`: `{id, pos, state, stolen, state_ticks_left}`. `charms[]`: `{id, pos, available, respawn_ticks \| respawn_s}`. Sai kiểu → mã 2. |
| B21 | Khoảng cách nạp đèn | Theo XZ như quy ước v1.0, không xét chênh cao. |
| B22 | Thực thể mới | Đom đóm sinh hoặc rơi trong một tick chỉ nhặt được từ tick sau (trường nội bộ `from`). |

### Case Phase 1 bị luật mới làm thay đổi (sửa kèm lý do, không tắt)

| Case | Thay đổi | Lý do (Ticket-02) |
|---|---|---|
| C3 | `--night 2` không còn là lỗi; dùng `--night 4` | v1.1 nhận 1, 2, 3 |
| G1 | Nhặt không còn cộng điểm | Điểm chuẩn: +10 mỗi đom đóm **nạp** |
| G3, G11 | Điểm kỳ vọng cộng thêm 10 × số đom đóm nạp | như trên |
| G5 | Bóng ở trong 5 m **3D** (từ chân + 0.8 m); đẩy 4 m trải trong 15 tick | luật Tỏa Sáng chuẩn |
| G7 | Bỏ kỳ vọng "hit lần 2 ngay khi hết bất tử"; kiểm tra bất tử đúng 90 tick bằng scenario riêng | bóng gây hit chuyển `recoil` lùi 2 m |
| G8 | Đom đóm rơi ở vành 1.5–2.5 m (trước: đúng 2.5 m), có `kind` và `ttl_s` | luật bị đánh chuẩn |
| G12 | Đo từ tick 30 | bóng đặt sẵn trong vùng sáng bị đẩy ra trong 30 tick (B8) |
| G13 | Bóng bắt đầu cách 10 m (trước: 20 m) | bỏ đuổi ở > 18 m |
| G14 | Lịch sinh 2 con ở tick 300, rồi mỗi 480 tick, tối đa 6; 20 đom đóm lúc đầu | lịch sinh chuẩn |
| G16 | Bỏ phần "bị chặn ở mép đảo" (chuyển sang P17) | `fall_enabled = true` |
