# Đảo Đèn Lồng

> 🎬 **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Day 12 · AI SDLC Lab · Tác giả: Mai Văn Thành (2A202603696)

Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá. Qua **3 Đêm, 3 hòn đảo** (Đảo Bến, Đảo Cau, Đảo Chuông), gom đom đóm và thắp lại các Đèn Lồng Lớn trước khi trời sáng. Né **Bóng Mực** tím đen và giữ đom đóm trước **Gió Lạc**.

## Cài đặt & chạy (macOS / Linux / Windows, cần Node.js ≥ 20)

```bash
npm install        # build_cmd
npm start          # run_cmd → mở http://localhost:5173
npm test           # chạy toàn bộ kiểm chứng (62 case)
```

Headless (Test Contract **v1.2**):

```bash
node src/headless.js --seed 1 --night 1|2|3 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên | Di chuyển (theo hướng camera) |
| Chuột (bấm vào màn hình để khóa chuột) · `Z` / `C` | Xoay camera |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| `E` | Nạp ánh sáng / thắp lại / châm dầu ở đèn gần nhất (trong 2 m) |
| `Q` / chuột trái | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `F3` | Hiện FPS |

Cài đặt (menu hoặc tạm dừng): âm lượng, độ nhạy chuột, **Bảng màu dễ phân biệt** (mù màu), đều được lưu lại.

## Ba Đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm mới |
|---|---|---|---|---|
| 1 | Đảo Bến: đảo tròn 40 m | 5 (giữ 3) | 4:00 | |
| 2 | Đảo Cau: 2 đảo nối bằng cầu tre không lan can | 6 (giữ 4) | 4:30 | Bục nhảy bắn qua biển mây, Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông: 3 tầng, 2 dốc, tháp chuông | 7 (giữ 5) | 5:00 | Gió mạnh mỗi 30 s (lá bay báo trước 2 s), Bóng Mực nhanh hơn |

Menu chính → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì hiện màn **Bình Minh** với tổng điểm. Thua thì chơi lại Đêm đó.

## Luật & cách tính điểm (Ticket-03 "Đèn cạn dầu", contract v1.2)

**Mục tiêu: giữ đảo sáng tới bình minh.** Thắp hết đèn không kết thúc Đêm. Hết giờ mà Mây còn sống và số đèn **đang sáng** ≥ 60 % (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7) thì **thắng**. Thiếu đèn lúc bình minh hoặc hết Ngọn Lửa thì **thua**.

- **Dầu đèn:** đèn vừa thắp có 100 dầu, cháy 1 dầu/giây. Hết dầu thì đèn tắt. Bấm `E` ở đèn đang sáng để **châm dầu** (mỗi đom đóm = 10 dầu). Thắp lại đèn đã từng sáng chỉ cần **5** đom đóm (lần đầu cần 10).
- **Đèn yếu (dầu < 30)** mất vùng an toàn và nhấp nháy. Bóng Mực tìm tới, đứng cạnh **hút dầu** 5/giây. Tỏa Sáng để đuổi chúng, hoặc châm dầu lên ≥ 30 để vùng sáng đẩy chúng ra.
- **Sức chứa** tăng 2 mỗi lần thắp thành công (kể cả thắp lại), từ 10 tới tối đa 20.
- Mây có **3 Ngọn Lửa**, hồi đầy mỗi Đêm. Bóng Mực chạm → mất 1 lửa, rơi một nửa số đom đóm (nhặt lại được trong 8 s), bất tử 1.5 s. Rơi khỏi đảo → mất 1 lửa và toàn bộ đom đóm.
- **Gió Lạc** đuổi theo khi bạn mang ≥ 5 đom đóm và cướp 3 con. **Bùa Gió**: 10 s chạy 7.2 m/s, lướt không cần hồi.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 (tổng +15 nếu nó đang hút dầu) |
| Bình minh (chỉ khi thắng): mỗi đèn đang sáng | +50 + số dầu còn lại (làm tròn xuống) |
| Bình minh (chỉ khi thắng): mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game = tổng điểm các Đêm đã thắng. Mọi con số nằm trong [game.contract.json](game.contract.json) (game đọc trực tiếp từ file này). Bản đồ chuẩn ở [src/sim/maps.js](src/sim/maps.js). Spec và tiêu chí nghiệm thu: [phase-2](docs/spec/phase-2.md), [phase-3](docs/spec/phase-3.md). Quyết định thiết kế: [docs/adr/](docs/adr/). Thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md). Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md).

**Các khóa thêm trong `tuning`:** ngoài các khóa ticket yêu cầu, file còn khai báo mọi số chuẩn khác mà game dùng (trọng lực, chiều cao nhặt, lịch sinh, Gió Lạc, Bùa Gió, gió…), để không có số "ẩn" trong code.

## Kiểm chứng

- `npm test`: **62 case**, mỗi case chạy **CLI headless thật** và kiểm tra JSONL: 21 case Phase 1 ([tests/cases.js](tests/cases.js)), 28 case Phase 2 ([tests/cases2.js](tests/cases2.js)), 13 case Phase 3 ([tests/cases3.js](tests/cases3.js)). Case bị luật mới thay thế được sửa kèm lý do trong [CHANGELOG.md](CHANGELOG.md).
- `npm run proof -- 3`: sinh bảng truy vết yêu cầu → [docs/proof/phase-3/](docs/proof/phase-3/) (Phase 2: [docs/proof/phase-2/](docs/proof/phase-2/), kèm ảnh client thật và đo FPS).
- Một Đêm đầy đủ 21.600 tick chạy headless trong khoảng 0.5 s (yêu cầu ≤ 30 s). Client đạt khoảng 58 FPS ở 1280×720 trên GPU tích hợp Intel UHD 620.
- CI (GitHub Actions, Ubuntu + macOS, file [.github/workflows/ci.yml](.github/workflows/ci.yml)) chạy test và kiểm tra tất định 3 Đêm mỗi lần push.

## Cấu trúc

```
src/sim/game.js     luật game (tất định, không DOM, 12 bước/tick theo ticket) — dùng chung cho headless & 3D
src/sim/maps.js     3 bản đồ chuẩn + độ cao mặt đất (tầng, dốc, cầu, tháp)
src/sim/io.js       kiểm tra inputs/scenario v1.1 (sai → mã thoát 2)
src/headless.js     CLI Test Contract
web/                client Three.js (render, HUD, menu, âm thanh WebAudio) — không chứa luật
tests/              case kiểm chứng + scenario
scripts/            proof, bot, ảnh chụp và đo FPS qua Chrome DevTools protocol
docs/spec/          spec + tiêu chí nghiệm thu từng phase
docs/notes/         giả định, nhật ký AI
docs/proof/         bằng chứng từng phase
AGENTS.md, CLAUDE.md, .claude/   harness AI (hook chặn khi test đỏ, skill verify)
```

## Sáng tạo của tôi

Toàn bộ chỉ nằm ở `web/` (hiển thị và âm thanh). Headless không import `web/`, nên đầu ra contract không đổi. Bằng chứng: `npm test` đạt 62/62. Phase 3: cài đặt mù màu, thanh dầu, đèn tắt rách giấy là yêu cầu của ticket; phần thêm là Bóng Mực đang hút dầu nghiêng người về phía đèn và viền nhấp nháy, cảnh báo "Bóng Mực đang hút dầu đèn Lx!".

- **Ông Đăng** dẫn chuyện ở màn giới thiệu mỗi Đêm, có lời nhắc riêng cho cầu tre, Gió Lạc và gió mạnh.
- **Hạt tiến độ trên đèn**: 10 hạt quanh cột đèn sáng dần theo số đom đóm đã nạp.
- **Vòng sáng an toàn**: đèn đã thắp vẽ vòng vàng đúng bằng `safe_radius`.
- **Đèn lồng nhỏ trên nón Mây** sáng hơn khi mang nhiều đom đóm. Khăn đỏ bay theo tốc độ chạy.
- Bóng Mực mới sinh **trồi lên** từ nhỏ tới lớn, bị choáng thì xẹp và nhạt màu. Gió Lạc là dải lụa uốn lượn, phình to khi đang giữ đom đóm cướp được. Đom đóm rơi **nhấp nháy** 2 s trước khi biến mất.
- **Chuông trên tháp** đung đưa. Bục nhảy có mũi tên vàng chỉ hướng bay.
- **Nhạc nền tổng hợp** (không cần file âm thanh), mỗi Đêm một giọng.
