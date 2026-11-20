# Đảo Đèn Lồng

> 🎬 **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Day 12 · AI SDLC Lab · Tác giả: Mai Văn Thành (2A202603696)

Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá. Qua **3 Đêm, 3 hòn đảo** (Đảo Bến, Đảo Cau, Đảo Chuông), gom đom đóm và thắp lại các Đèn Lồng Lớn trước khi trời sáng. Né **Bóng Mực** tím đen và giữ đom đóm trước **Gió Lạc**.

## Cài đặt & chạy (macOS / Linux / Windows, cần Node.js ≥ 20)

```bash
npm install        # build_cmd
npm start          # run_cmd → mở http://localhost:5173
npm test           # chạy toàn bộ kiểm chứng (49 case)
```

Headless (Test Contract **v1.1**):

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
| `E` | Nạp ánh sáng vào đèn gần nhất (trong 2 m) |
| `Q` / chuột trái | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `F3` | Hiện FPS |

## Ba Đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm mới |
|---|---|---|---|---|
| 1 | Đảo Bến: đảo tròn 40 m | 5 | 5:00 | |
| 2 | Đảo Cau: 2 đảo nối bằng cầu tre không lan can | 6 | 5:30 | Bục nhảy bắn qua biển mây, Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông: 3 tầng, 2 dốc, tháp chuông | 7 | 6:00 | Gió mạnh mỗi 30 s (lá bay báo trước 2 s), Bóng Mực nhanh hơn |

Menu chính → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì hiện màn **Bình Minh** với tổng điểm. Thua thì chơi lại Đêm đó.

## Luật & cách tính điểm (số chuẩn Ticket-02)

- Mây có **3 Ngọn Lửa**, hồi đầy đầu mỗi Đêm. Bóng Mực chạm → mất 1 lửa, rơi một nửa số đom đóm đang mang (nhặt lại được trong 8 s), bất tử 1.5 s. Rơi khỏi đảo → mất 1 lửa và **toàn bộ** đom đóm, hồi sinh ở điểm xuất phát sau 1 s.
- Mang tối đa **10** đom đóm. Mỗi đèn cần **10** đom đóm, nạp nhiều lần được.
- Đèn đã sáng tạo vùng an toàn **6 m**: Bóng Mực không vào được.
- **Gió Lạc** đuổi theo khi bạn mang ≥ 5 đom đóm, chạm vào thì cướp 3 con rồi bay đi. Tỏa Sáng trúng nó để đòi lại.
- **Bùa Gió** (lá bùa đỏ viền vàng): trong 10 s chạy 7.2 m/s và lướt không cần hồi.
- Thắp hết đèn → **thắng**. Hết lửa hoặc trời sáng → **thua**.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi lần, kể cả con đang choáng) | +5 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game = tổng điểm các Đêm đã thắng. Mọi con số nằm trong [game.contract.json](game.contract.json) (game đọc trực tiếp từ file này). Bản đồ chuẩn ở [src/sim/maps.js](src/sim/maps.js). Spec và tiêu chí nghiệm thu: [docs/spec/phase-2.md](docs/spec/phase-2.md). Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md).

**Các khóa thêm trong `tuning`:** ngoài các khóa ticket yêu cầu, file còn khai báo mọi số chuẩn khác mà game dùng (trọng lực, chiều cao nhặt, lịch sinh, Gió Lạc, Bùa Gió, gió…), để không có số "ẩn" trong code.

## Kiểm chứng

- `npm test`: **49 case**, mỗi case chạy **CLI headless thật** và kiểm tra JSONL. Gồm 21 case Phase 1 (chạy lại với số chuẩn, [tests/cases.js](tests/cases.js)) và 28 case Phase 2, có ít nhất 1 scenario cho mỗi tính năng mới ([tests/cases2.js](tests/cases2.js)).
- `npm run proof -- 2`: sinh bảng truy vết yêu cầu → [docs/proof/phase-2/](docs/proof/phase-2/) (kèm ảnh client thật và đo FPS).
- Một Đêm đầy đủ 21.600 tick chạy headless trong khoảng 0.5 s (yêu cầu ≤ 30 s). Client đạt khoảng 58 FPS ở 1280×720 trên GPU tích hợp Intel UHD 620.
- CI (GitHub Actions, Ubuntu + macOS, file [.github/workflows/ci.yml](../.github/workflows/ci.yml) ở gốc repo) chạy test và kiểm tra tất định 3 Đêm mỗi lần push.

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

Toàn bộ chỉ nằm ở `web/` (hiển thị và âm thanh). Headless không import `web/`, nên đầu ra contract không đổi. Bằng chứng: `npm test` đạt 49/49, gồm cả 21 case Phase 1.

- **Ông Đăng** dẫn chuyện ở màn giới thiệu mỗi Đêm, có lời nhắc riêng cho cầu tre, Gió Lạc và gió mạnh.
- **Hạt tiến độ trên đèn**: 10 hạt quanh cột đèn sáng dần theo số đom đóm đã nạp.
- **Vòng sáng an toàn**: đèn đã thắp vẽ vòng vàng đúng bằng `safe_radius`.
- **Đèn lồng nhỏ trên nón Mây** sáng hơn khi mang nhiều đom đóm. Khăn đỏ bay theo tốc độ chạy.
- Bóng Mực mới sinh **trồi lên** từ nhỏ tới lớn, bị choáng thì xẹp và nhạt màu. Gió Lạc là dải lụa uốn lượn, phình to khi đang giữ đom đóm cướp được. Đom đóm rơi **nhấp nháy** 2 s trước khi biến mất.
- **Chuông trên tháp** đung đưa. Bục nhảy có mũi tên vàng chỉ hướng bay.
- **Nhạc nền tổng hợp** (không cần file âm thanh), mỗi Đêm một giọng.
