# Bằng chứng Phase 3: Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Tiêu chí nghiệm thu: [docs/spec/phase-3.md](../../spec/phase-3.md). Kết quả tự động: [results.md](results.md) (**62/62 case đạt**, sinh bởi `npm run proof -- 3`, mỗi case chạy CLI headless thật).

| Yêu cầu Ticket-03 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| 1. Nhiên liệu: 100 khi thắp, hao 1/giây (đơn vị nguyên 1/60), châm dầu theo công thức, tắt khi hết, thắp lại 5 | Scenario tính tay: đầy → tắt đúng tick 6000; 0.5 dầu → tắt tick 30; châm 25 + 10 đom đóm → dùng 8, fuel 100 | F2–F5, P10 | Đạt |
| 1. Hiển thị thanh dầu, nhấp nháy 1 Hz khi < 30 | Ảnh client thật | [img/p3-fuel-drain.png](img/p3-fuel-drain.png) | Đạt |
| 2. Mất vùng an toàn khi < 30 (đúng 30 vẫn còn) | Bóng bị chặn ở 6 m tới tick 30 (fuel 30.0), vào được từ tick 31 | F6 | Đạt |
| 2. Wander chọn đèn yếu, drain hút 5/giây cộng dồn, `fuel_drain` mỗi 60 tick | 2 con: 25 → 14.0 sau 60 tick (11 FU/tick) | F7, F8 | Đạt |
| 2. Rời drain (6 m → chase, Tỏa Sáng → stunned +15, đèn tắt → wander); châm lên ≥ 30 đẩy bóng ra 30 tick | Scenario | F9, F10 | Đạt |
| 3. Thời lượng 240/270/300; thắng ở bình minh ≥ 60 % đèn; không thắng sớm; hết lửa xét trước | Scenario cả 3 Đêm, ngưỡng 3/5, 4/6, 5/7 | F1, F11, G11, P25 | Đạt |
| 4. Sức chứa 10 + 2 × lần thắp, tối đa 20 | Scenario + HUD "7/14" | F12, [img/p3-fuel-drain.png](img/p3-fuel-drain.png) | Đạt |
| 5. Bảng điểm mới | Điểm tính tay trong từng case | G3, G11, F4, F5, F9, P12 | Đạt |
| 6. Chế độ mù màu (lưu lại): `#00B3FF` cho Bóng Mực, cảnh báo trắng + ⚠; đèn tắt xẹp 20 % và rách | Ảnh client thật ở cả hai chế độ | [img/p3-colorblind.png](img/p3-colorblind.png), [img/p3-fuel-drain.png](img/p3-fuel-drain.png) | Đạt |
| 7. Contract v1.2: tuning, snapshot, scenario, sự kiện, `dawn_survived` | Case format | F1, F3, F8, F13 | Đạt |
| DoD: ADR | — | [docs/adr/0001-lantern-fuel-and-dawn-win.md](../../adr/0001-lantern-fuel-and-dawn-win.md) | Đạt |
| DoD: changelog breaking changes | — | [CHANGELOG.md](../../../CHANGELOG.md) | Đạt |
| DoD: test cũ bị thay được cập nhật có lý do, không skip | 7 case (G3, G11, P1, P2, P10, P24, P25) | CHANGELOG.md, comment `// v1.2` trong test | Đạt |
| DoD: test Phase 1–2 không bị thay vẫn đạt | `npm test` | 42 case cũ đạt nguyên trạng | Đạt |
| FPS ở 1280×720 sau thay đổi client | `scripts/fps-bench.js` (GPU thật) | [fps.json](fps.json): 55.4 / 58.2 / 57.4 FPS | Đạt |
| E2E: bot chơi từ đầu, không dựng scenario | Bot sinh inputs, phát lại qua CLI khớp từng tick | [e2e/](e2e/): seed 2 · Đêm 1 sống tới bình minh, 3 lửa, nhưng chỉ **2/5** đèn sáng (thua `dawn`, 500 điểm) · Đêm 2 thua · Đêm 3 thua | **Chưa đạt**: bot chưa thắng. Bóng Mực ở trạng thái wander giờ đứng canh đèn tắt, bot né thay vì đánh. |

## Chạy lại

```bash
npm test && npm run proof -- 3
PORT=5199 npm start &
CHROME="/path/to/chrome" node scripts/screens.js docs/proof/phase-3/img p3-fuel-drain p3-colorblind
CHROME="/path/to/chrome" node scripts/fps-bench.js 12 docs/proof/phase-3/fps.json
```
