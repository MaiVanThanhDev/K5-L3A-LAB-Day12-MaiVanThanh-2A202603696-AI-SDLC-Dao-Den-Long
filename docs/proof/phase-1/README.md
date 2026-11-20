# Bằng chứng Phase 1

| Yêu cầu PRD-0 / Contract | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Test Contract v1.0 (định dạng, tick, mã thoát, tất định) | Case C1–C5 chạy CLI thật | [results.md](results.md) | Đạt |
| Nhặt đom đóm, nạp và thắp đèn | Case G1–G4 | [results.md](results.md) | Đạt |
| Bóng Mực đuổi, chạm mất máu; tỏa sáng xua | Case G5–G8, G12–G14 | [results.md](results.md) | Đạt |
| Thắng / thua / điểm | Case G9–G11 | [results.md](results.md) | Đạt |
| Đi lại, nhảy, camera 3D (theo hướng camera) | Case C4, G15 + ảnh | [results.md](results.md), [img/gameplay-3lit.png](img/gameplay-3lit.png) | Đạt |
| Tất định khi chạy dài (3600 tick) | Chạy seed 42 hai lần, so từng byte | [out/seed42-run1.jsonl](out/seed42-run1.jsonl), [out/seed42-run2.jsonl](out/seed42-run2.jsonl) | Đạt |
| HUD (lửa, đom đóm, đèn, thời gian, điểm, trạng thái tỏa sáng) | Ảnh chụp Chrome headless | [img/gameplay-3lit.png](img/gameplay-3lit.png) | Đạt |
| Màn mở đầu / chơi lại | Ảnh màn bắt đầu; nút Chơi lại và phím R trong `web/main.js` `showEnd()` | [img/start.png](img/start.png) | Đạt (chơi lại kiểm tra bằng tay khi chơi) |
| Đảo sáng dần khi thắp đèn | Ảnh scenario 3 đèn đã thắp (trời và sương ấm hơn, vòng sáng) | [img/gameplay-3lit.png](img/gameplay-3lit.png) | Đạt |
| Chơi được Đêm 1 từ đầu tới thắng (không dựng scenario: đom đóm và Bóng Mực ngẫu nhiên) | Bot tham lam `scripts/bot.js` sinh inputs, sau đó **phát lại qua CLI headless thật** | [e2e/](e2e/): seed 1 won @3823 tick, 1452 điểm · seed 2 won @3399, 1526 · seed 3 won @3339, 1568 | Đạt |
| Chơi bằng tay trên trình duyệt | Chơi thử | (sẽ có trong video demo) | Chưa có bằng chứng ghi hình ở Phase 1 |

Chạy lại e2e: `node scripts/bot.js 1 b.json && node src/headless.js --seed 1 --night 1 --inputs b.json --ticks 18000 --out o.jsonl && tail -1 o.jsonl`

**Chạy lại:** `npm test` hoặc `npm run proof -- 1`. Ảnh: xem skill [.claude/skills/verify/SKILL.md](../../../.claude/skills/verify/SKILL.md) bước 4 (scenario `tests/scenarios/screenshot-3lit.json`, seed 3).
