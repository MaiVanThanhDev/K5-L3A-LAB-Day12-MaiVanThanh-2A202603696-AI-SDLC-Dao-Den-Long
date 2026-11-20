# Changelog

Ghi theo phase (tag git). Mục **BREAKING** liệt kê thay đổi phá vỡ tương thích với contract, scenario, output headless hoặc test của phase trước.

## [phase-3] — Ticket-03 "Đèn cạn dầu" · Test Contract v1.2

Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md) · Spec: [docs/spec/phase-3.md](docs/spec/phase-3.md)

### BREAKING

| # | Thay đổi | Trước (v1.1) | Sau (v1.2) |
|---|---|---|---|
| B1 | Luật thắng | Thắng ngay khi mọi đèn sáng, `reason: "all_lit"` | Không thắng sớm. Thắng ở bình minh khi số đèn đang sáng ≥ ceil(0.6 × tổng), `reason: "dawn_survived"`. **`all_lit` không còn được phát.** |
| B2 | Thời lượng Đêm | 300 / 330 / 360 s | **240 / 270 / 300 s** (`night*_duration_s`, `time_left_s` ban đầu) |
| B3 | Bảng điểm | +10/đom đóm nạp, +100/đèn, +5/Bóng Mực, +2/giây còn lại, +50/lửa | +5/đom đóm nạp (cả châm dầu), +100 thắp lần đầu, **+40 thắp lại**, +5/Bóng Mực (**+15 nếu đang drain**), bình minh **+50 + floor(fuel)/đèn sáng**, +50/lửa; **bỏ thưởng thời gian** (`per_second_left: 0`) |
| B4 | Đèn đã sáng | Sáng mãi, không nhận thêm đom đóm, tương tác bỏ qua | Có `fuel` 0–100, hao 1/giây, **tắt khi hết dầu** (`lantern_out`, `deposited = 0`); tương tác ở đèn sáng chưa đầy = **châm dầu** (`refuel`) |
| B5 | Vùng an toàn | Mọi đèn sáng | Chỉ đèn sáng có **fuel ≥ 30** |
| B6 | Bóng Mực | Trạng thái: spawning, wander, chase, recoil, stunned; wander lượn ngẫu nhiên | Thêm **`drain`**; wander đi tới đèn sáng yếu gần nhất, không có thì đèn tắt gần nhất |
| B7 | Sức chứa | Cố định 10 | **10 + 2 × successful_lights, tối đa 20** (`player.capacity`) |
| B8 | Snapshot | `lanterns[]`: id, pos, lit, deposited | thêm **`fuel`** (1 chữ số thập phân), **`ever_lit`**, **`relit_count`**; `player` thêm **`capacity`** |
| B9 | Sự kiện | `lantern_lit {lantern_id}` | `lantern_lit {lantern_id, relight}`; mới: `refuel`, `lantern_out`, `fuel_drain` |
| B10 | Scenario | — | `lanterns[].fuel` (mặc định 100 nếu `lit: true`), `lanterns[].ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`; `state: "drain"` bắt buộc có `target_lantern_id`; sai kiểu → mã 2 |
| B11 | `contract_version` | `"1.1"` | `"1.2"`; tuning thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max` (+ khóa phụ `capacity_per_light`, `drain_range_m`, `drain_break_m`, `fuel_drain_event_ticks`) |

### Test bị luật mới làm sai (đã cập nhật, không skip)

| Case | Cập nhật | Lý do |
|---|---|---|
| G3 | `lantern_lit` kỳ vọng thêm `relight: false` | B9 |
| G11 | Viết lại: thắp hết không kết thúc Đêm; thắng ở bình minh với 3/5, điểm 3 × (50 + 99) + 150 | B1, B3 |
| P1 | Thời lượng 240/270/300 và bảng điểm mới | B2, B3 |
| P2 | `time_left_s` ban đầu 240/270/300 | B2 |
| P10 | Đèn sáng ở 0.5 m (99.98 dầu sau bước 2) giờ được chọn để châm dầu, thay vì bị bỏ qua | B4 |
| P24 | `time_left_s` kỳ vọng tính từ `night1_duration_s` | B2 |
| P25 | Viết lại: hết lửa ở tick bình minh → no_flames; 3/5 → dawn_survived; 2/5 → dawn | B1 |

Các case khác của Phase 1–2 vẫn đạt nguyên trạng.

### Thêm

- 13 case Phase 3 (`tests/cases3.js`, F1–F13): dầu hao, tắt, thắp lại, châm dầu, mất vùng < 30, đích của wander, drain cộng dồn và `fuel_drain`, rời drain, đẩy ra khi châm lên ≥ 30, ngưỡng thắng từng Đêm, sức chứa, scenario sai.
- Client: thanh dầu trên đèn, đèn và thanh nhấp nháy 1 Hz khi fuel < 30, đèn tắt xẹp 20 % và có vết rách giấy, vòng an toàn chỉ hiện khi còn vùng, HUD "đang mang/sức chứa", "cần k lúc bình minh", nhắc "Châm dầu / Thắp lại", mũi tên ưu tiên đèn yếu.
- Cài đặt **"Bảng màu dễ phân biệt"** (lưu lại): viền và mắt Bóng Mực `#00B3FF`, cảnh báo UI `#FFFFFF` kèm ⚠.
- ADR 0001, spec Phase 3.

## [phase-2] — Ticket-02 "Ba hòn đảo" · Test Contract v1.1

BREAKING so với phase-1: thay mọi số tự chọn bằng số chuẩn; `--night 2|3`; điểm đom đóm tính khi nạp; Bóng Mực lùi sau khi chạm; rơi khỏi đảo bị phạt (`fall_enabled: true`). Chi tiết và lý do sửa test: [docs/notes/assumptions.md](docs/notes/assumptions.md) mục B.

## [phase-1] — PRD-0 · Test Contract v1.0

Bản đầu tiên: Đêm 1, headless theo contract v1.0.
