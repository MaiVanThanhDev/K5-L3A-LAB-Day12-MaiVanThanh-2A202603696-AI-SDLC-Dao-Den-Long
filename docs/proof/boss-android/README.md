# Bằng chứng — nhánh `feature/boss-android` (Diệt Bóng, Chúa Bóng Mực, Android)

Quyết định: [ADR 0002](../../adr/0002-banish-skill-and-shade-boss.md) · giả định D22–D29 · spec X-6…X-11 ([phase-4.md](../../spec/phase-4.md)).

## 1. Test

`npm test` → **88 test: 87 đạt, 0 lỗi, 1 bỏ qua.** Test bỏ qua là SH5 (PostgreSQL thật, cần `SHOP_TEST_DATABASE_URL`), giống nhánh trước.

- 12 case mới [tests/cases-extras.js](../../../tests/cases-extras.js) (X1–X12) chạy CLI headless thật. Kỳ vọng tính tay, phép tính ghi trong comment.
- Hai kỳ vọng của tôi sai lúc đầu và đã sửa kèm lý do trong comment:
  - **X4:** Diệt Bóng chạy ở bước 7b, nên boss bắt đầu lùi ngay trong bước 8 của cùng tick (tick 1–60, không phải 2–61).
  - **X12:** đường đi bộ dài làm Mây rơi khỏi đảo, mất hết 3 lửa trước khi boss xuất hiện.
- 76 test cũ không đổi.

**Đầu ra contract không đổi:** chạy `node src/headless.js --seed 9 --night N --ticks 3000` cho N = 1, 2, 3, trước và sau khi đổi code (`git stash`). `cmp` cho kết quả giống hệt cả ba Đêm.

## 2. Ảnh client thật (Chrome, GPU)

Mọi ảnh đều đã được mở ra xem.

| Ảnh | Nội dung |
|---|---|
| [boss-eclipse.png](img/boss-eclipse.png) | Chúa Bóng Mực đang niệm Nhật Thực: vòng đỏ 5 m trên đất, thanh máu 2/3 và dòng "Đang niệm Nhật Thực · Tỏa Sáng để ngắt!" trên HUD, ô hồi chiêu Diệt Bóng (F) cạnh Tỏa Sáng (Q). |
| [boss-banish.png](img/boss-banish.png) | Bấm `Q`+`F` cùng tick: "Diệt một Bóng Mực!", điểm 30 (2 lần choáng × 5 + 1 lần diệt × 20), vòng Diệt Bóng quanh Mây, Bóng Mực S1 biến mất. |
| [touch-phone.png](img/touch-phone.png) | Màn hình điện thoại 844×390 @2x, chế độ cảm ứng: 5 nút (Nạp đèn, Diệt Bóng, Tỏa Sáng, Lướt, Nhảy), nút tạm dừng, HUD boss thu gọn, bản đồ nhỏ thu nhỏ. |
| [touch-play-app-bundle.png](img/touch-play-app-bundle.png) | Bản `android-app/www` chạy trên **server tĩnh không có API** (giống trong app): menu → giới thiệu → vào Đêm 1, chạy được không lỗi. Vòng hồi chiêu phủ nút Diệt Bóng/Tỏa Sáng vì đang mang 0 đom đóm. |

**Điều khiển cảm ứng, kiểm tra bằng sự kiện chạm thật** (CDP `Input.dispatchTouchEvent`, màn hình mô phỏng điện thoại):

- kéo joystick lên ~1 s → Mây đi tới **+6.45 m** theo z (6 m/s);
- chạm nhanh nút Tỏa Sáng → Tỏa Sáng kích hoạt (`pulseCd` từ 0 lên 160 sau 300 ms);
- `game.extras = true` khi chơi thật.

## 3. Bench (cảnh chuẩn, cửa sổ Chrome thật 1280×720, vsync tắt)

Cảnh bench tắt extras và cảm ứng; mesh boss có trong scene nhưng ẩn. Đo xen kẽ trên cùng máy (UHD 620), HEAD = commit `ea19e6f` trước khi đổi:

| Lần | Bản | avg FPS | 1 % low | p95 ms |
|---|---|---|---|---|
| 1 | HEAD | 114.9 | 29.9 | 14.8 |
| 1 | boss-android | 114.4 | 31.7 | 15.0 |
| 2 | HEAD | 115.1 | 29.7 | 15.0 |
| 2 | boss-android | 111.9 | 29.7 | 15.4 |

**Kết luận:** chênh 0.5–3 FPS, cùng mức dao động giữa các lần đo; 1 % low như nhau.

- Hôm nay cả hai bản đều thấp hơn số 123–128 FPS ghi ở nhánh trước. Lý do là trạng thái máy khi đo, không phải code: HEAD cũng chỉ đạt 115.
- Lần đo đầu tiên (111.6 FPS) chạy khi còn hai server nền của tôi, nên bị loại.
- File gốc: [bench/](bench/).

## 4. Android

- **PWA:** `/manifest.webmanifest` và `/sw.js` trả về 200 với đúng content-type; icon 192, 512 và maskable 512 sinh bằng `node scripts/make-icons.js`.
- **Capacitor:** `npx cap add android` và `npm run sync` thành công; `assets/public` chứa đủ `index.html`, `web/`, `src/`, `three.module.js`, `game.contract.json`. Manifest được chỉnh `sensorLandscape`; activity immersive, giữ màn hình sáng; icon launcher đủ 5 mật độ.
- **Chưa kiểm chứng trên máy này:** build Gradle ra APK và chạy trên điện thoại thật, vì máy dev không có Android SDK. APK được build bởi workflow [android.yml](../../../.github/workflows/android.yml) trên GitHub Actions (runner có sẵn SDK). Workflow cần được chạy một lần sau khi push để xác nhận.
