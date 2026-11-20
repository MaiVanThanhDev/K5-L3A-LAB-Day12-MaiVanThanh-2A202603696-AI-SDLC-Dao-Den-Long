# Bằng chứng Phase 2: Ticket-02 "Ba hòn đảo" (Contract v1.1)

Tiêu chí nghiệm thu chi tiết từng mục: [docs/spec/phase-2.md](../../spec/phase-2.md). Kết quả tự động: [results.md](results.md) (**49/49 case đạt**, sinh bởi `npm run proof -- 2`, mỗi case chạy CLI headless thật).

| Yêu cầu Ticket-02 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Phần 1: số chuẩn thay mọi số tự chọn | So `tuning` với bảng ticket | P1 trong [results.md](results.md) | Đạt |
| Phần 1: di chuyển, nhảy, Lướt | Scenario tính tay (vel tick 1 = 6; đỉnh nhảy 1.167 m; lướt 2.8 m / 12 tick; hồi 90 tick; giữ độ cao trên không) | P4–P6, C4, G15 | Đạt |
| Phần 1: đom đóm, đèn, vùng an toàn, Tỏa Sáng | Scenario tính tay | P3, P9–P13, G1–G6, G11, G12 | Đạt |
| Phần 1: Bóng Mực (tốc độ, 12/18 m, chạm, recoil, lịch sinh), bị đánh, rơi khỏi đảo | Scenario tính tay (rơi ở tick 64, hồi sinh tick 124) | P14–P17, P26, G7–G10, G13, G14 | Đạt |
| Phần 1: thứ tự xử lý trong một tick | 12 bước của `Game.step()` theo đúng thứ tự; các case đụng tới thứ tự: cướp trước hit (P21), hit trước sinh (G14), pause dừng ngay (P24) | [src/sim/game.js](../../../src/sim/game.js) | Đạt |
| Phần 1: thắng/thua sau mỗi tick | Hết lửa + đèn sáng hết → thua; thắp đèn cuối đúng tick hết giờ → thắng | P25 | Đạt |
| Phần 2: bản đồ chuẩn 3 Đêm | Vị trí đèn, điểm sinh, bùa; đi qua cầu, rơi khỏi cầu; bục nhảy Đêm 2 đáp tick 84 trên đảo B; vách, dốc, bục, tháp Đêm 3; gió 30 s / 5 s / 2 m/s | P2, P18–P20 + ảnh | Đạt |
| Phần 3: Gió Lạc | Chase / cướp / flee / removed; Tỏa Sáng lúc chase và lúc flee; chỉ Đêm 2, 3; tối đa 2 | P21–P23, [img/night2-bridge-pad.png](img/night2-bridge-pad.png) | Đạt |
| Phần 3: Bùa Gió | Nhặt, 7.2 m/s, lướt không hồi, xuất hiện lại | P7, P8, [img/night2-bridge-pad.png](img/night2-bridge-pad.png) | Đạt |
| Phần 3: chuỗi 3 Đêm, Bình Minh, chơi lại khi thua | Ảnh từng màn | [menu](img/menu.png), [intro Đêm 2](img/intro-night2.png), [kết quả thua](img/result-lost.png), [Bình Minh](img/dawn.png) | Đạt |
| Phần 3: tạm dừng | Headless: `tick` tăng, `sim_tick`/giờ/hồi chiêu/spawn đứng yên; client: menu 4 nút | P24, [img/pause.png](img/pause.png) | Đạt |
| Phần 3: cài đặt (âm lượng, độ nhạy chuột, lưu lại) | Ảnh + code (`localStorage`) | [img/settings.png](img/settings.png) | Đạt (lưu giữa các lần mở: kiểm tra bằng code và chơi thử) |
| Phần 3: âm thanh (nhạc nền + 10 loại hiệu ứng) | Code `web/audio.js`, gọi trong `onEvent` | — | Đạt theo code; chưa có ghi âm/ghi hình |
| Phần 3: HUD đầy đủ | Ảnh: lửa trên trái, đồng hồ đỏ ≤ 30 s, đèn và điểm trên phải, thanh 10 ô, hồi chiêu dưới phải, nhắc "E — Nạp ánh sáng (4/10)", mũi tên chỉ đèn | [img/danger-clock-prompt.png](img/danger-clock-prompt.png), [img/night3-tiers-wind.png](img/night3-tiers-wind.png) | Đạt |
| Phần 3: bảng màu chuẩn, ánh sáng môi trường 0.15 + 0.55 × tiến độ | Hex đặt nguyên giá trị trong code; ảnh 3 Đêm | [img/night1-3lit.png](img/night1-3lit.png), [img/night3-launch.png](img/night3-launch.png) (sau bục nhảy, đã đáp lên tầng 2 cạnh tháp chuông) | Đạt |
| Phần 4: contract v1.1 (trường, sự kiện, scenario, tên trạng thái, mã thoát) | Case format | P2, P24, P27, C1–C5 | Đạt |
| Phần 4: một Đêm 21.600 tick ≤ 30 s | Đo thời gian thật | P28: Đêm 1 0.36 s · Đêm 2 0.45 s · Đêm 3 0.51 s | Đạt |
| DoD: test ẩn Phase 1 vẫn đạt với số chuẩn | Chạy lại 21 case Phase 1; case nào luật mới làm đổi thì sửa kèm lý do | C1–C5, G1–G16; [assumptions.md](../../notes/assumptions.md) | Đạt |
| DoD: ≥ 30 FPS trung bình ở 1280×720 | `scripts/fps-bench.js`: Chrome + GPU thật, ép viewport 1280×720, đo 14 s mỗi Đêm khi đang chơi | [fps.json](fps.json): 57.4 / 58.4 / 58.2 FPS; Đêm 3 với 6 đèn sáng: 58.5 FPS (Intel UHD 620) | Đạt |
| Tất định khi chạy dài | Seed 42 chạy 2 lần, so từng byte | [out/](out/) | Đạt |
| E2E: bot chơi từ đầu, không dựng scenario | `scripts/bot.js` sinh inputs rồi phát lại qua CLI | [e2e/](e2e/): seed 2 · Đêm 1 thua (4/5 đèn, 815 điểm) · Đêm 2 thua (1/6) · Đêm 3 thua (0/7). Phát lại khớp từng tick | **Chưa đạt**: bot tham lam chưa thắng được với số chuẩn. Phát lại khớp chứng minh client và headless dùng chung một lõi. |

## Chạy lại

```bash
npm test                         # 49 case
npm run proof -- 2               # bảng results.md + 2 lần chạy tất định
PORT=5199 npm start &            # cho ảnh và FPS
CHROME="/path/to/chrome" node scripts/screens.js docs/proof/phase-2/img
CHROME="/path/to/chrome" node scripts/fps-bench.js 15 docs/proof/phase-2/fps.json
node scripts/bot.js 2 b.json 1 && node src/headless.js --seed 2 --night 1 --inputs b.json --ticks 21600 --out o.jsonl && tail -1 o.jsonl
```
