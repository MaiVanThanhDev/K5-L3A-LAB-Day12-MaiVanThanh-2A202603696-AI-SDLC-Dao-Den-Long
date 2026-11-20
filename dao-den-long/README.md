# Đảo Đèn Lồng

> 🎬 **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Day 12 · AI SDLC Lab · Tác giả: Mai Văn Thành (2A202603696)

Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá. Gom đom đóm, mang về thắp lại 5 Đèn Lồng Lớn của **Đảo Bến** trước khi trời sáng, né những **Bóng Mực** tím đen trong sương.

## Cài đặt & chạy (macOS / Linux / Windows, cần Node.js ≥ 20)

```bash
npm install        # build_cmd
npm start          # run_cmd → mở http://localhost:5173
npm test           # chạy toàn bộ kiểm chứng
```

Headless (Test Contract v1.0):

```bash
node src/headless.js --seed 1 --night 1 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột · `Q` / `E` | Xoay camera |
| `Space` | Nhảy |
| `F` | Nạp đom đóm vào đèn gần nhất (trong 2.5 m) |
| `Shift` | Tỏa sáng: tốn 2 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| `R` | Chơi lại (sau khi thắng/thua) |

## Luật & cách tính điểm

- Mây có **3 ngọn lửa** (máu). Bóng Mực chạm (≤ 1 m) → mất 1 lửa, **rơi 50 %** số đom đóm đang mang (rơi xuống đất quanh Mây, nhặt lại được), bất tử 1.5 s.
- Mang tối đa **10** đom đóm. Mỗi đèn cần **5** đom đóm để thắp.
- Bóng Mực không vào được vòng **5 m** quanh đèn **đã thắp** (vòng sáng vàng).
- Đêm dài **300 s**. Thắp đủ 5 đèn → **thắng**. Hết lửa hoặc trời sáng → **thua**.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi tỏa sáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Mọi con số nằm trong [game.contract.json](game.contract.json) (game đọc trực tiếp từ file này, nên khai báo luôn khớp với game). Giải thích chi tiết và giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md).

**Các khái niệm trong `tuning`:** `fall_enabled = false` vì đảo có rìa chặn, Mây không thể rơi khỏi đảo, nên không bao giờ có sự kiện `player_hit` với `by: "fall"`. Không có `dash` (input `dash` được chấp nhận nhưng bị bỏ qua). Mọi trường khác đều được dùng.

## Kiểm chứng

- `npm test`: 21 case, mỗi case chạy **CLI headless thật** và kiểm tra JSONL ([tests/cases.js](tests/cases.js)).
- `npm run proof -- 1`: sinh bảng truy vết yêu cầu → bằng chứng tại [docs/proof/phase-1/](docs/proof/phase-1/).
- CI (GitHub Actions, Ubuntu + macOS) chạy test + kiểm tra tất định mỗi lần push.

## Cấu trúc

```
src/sim/game.js     luật game (tất định, không DOM) — dùng chung cho headless & 3D
src/sim/io.js       kiểm tra inputs/scenario (sai → mã thoát 2)
src/headless.js     CLI Test Contract
web/                client Three.js (chỉ render + đọc phím)
tests/              case kiểm chứng + scenario
docs/notes/         giả định, nhật ký AI, retro
docs/proof/         bằng chứng từng phase
AGENTS.md, CLAUDE.md, .claude/   harness AI (hook chặn khi test đỏ, skill verify)
```

## Sáng tạo của tôi

Toàn bộ chỉ nằm ở `web/` (phần hiển thị). Headless không import `web/`, nên đầu ra contract không đổi. Bằng chứng: `npm test` vẫn đạt 21/21.

- **Hạt tiến độ trên đèn**: 5 hạt quanh cột đèn sáng dần theo số đom đóm đã nạp.
- **Vòng sáng an toàn**: đèn đã thắp vẽ vòng vàng đúng bằng `safe_radius`, cho người chơi biết chỗ trú.
- **Đèn lồng nhỏ trên nón Mây** sáng hơn khi mang nhiều đom đóm. Bóng Mực bị choáng thì xẹp xuống và nhạt màu.
- **Cả đảo sáng dần**: trời, sương và mặt cỏ chuyển dần sang màu ấm theo số đèn đã thắp.
