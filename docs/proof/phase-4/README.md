# Bằng chứng Phase 4: Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Tiêu chí nghiệm thu: [docs/spec/phase-4.md](../../spec/phase-4.md). Kết quả tự động: [results.md](results.md) (**69/69 case đạt**, `npm run proof -- 4`).

Máy tham khảo (không phải máy chấm): Windows 10, Intel i5-8265U, Intel UHD 620 (GPU tích hợp), 8 GB RAM, Chrome 157, Node 26.

| Yêu cầu Ticket-04 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| 1. Benchmark: cửa sổ 1280×720, vsync tắt, cảnh chuẩn, camera bay vòng, 3 s khởi động + 30 s đo, tự thoát mã 0 | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (cửa sổ Chrome thật) | [bench.json](../../../bench.json): **avg 123.1 FPS · 1 % low 36.0 · p95 12.1 ms · 3693 khung · load 1747 ms · peak 743 MB**; R5, R6; [img/bench-scene.png](img/bench-scene.png) | Đạt ngưỡng (≥ 60 / ≥ 30 / ≤ 10000) trên máy tham khảo |
| Bench trước khi tối ưu | Lần chạy đầu | 36.4 FPS / 1 % low 8.2 (khoảng 1000 draw call) → instancing + HUD cache → 117 → 123 FPS | Ghi lại để thấy tác dụng |
| 2. Soak 10 Đêm trong một tiến trình | `node scripts/soak.js --seed 7 --nights 10 --out soak.json` | [soak.json](../../../soak.json): **0 crash, RSS 41.6 → 43.3 MB (1.04×), heap JS 4.8 → 5.1 MB**, 1.1 s; R7 | Đạt (≤ 1.2×) |
| Soak: chứng minh không rò rỉ | 30 và 60 Đêm không cố định V8: RSS có trần khoảng 52 MB, heap JS khoảng 5 MB không đổi | [assumptions.md D8](../../notes/assumptions.md) | Không rò rỉ (phần tăng là khởi động của V8) |
| 3. Bảng xếp hạng: nhập tên sau Bình Minh/khi thua, luật tên, 5 trường, top 10, thứ tự, lưu đĩa, màn hình, xuất | Unit + server thật + lệnh xuất | R2–R4; [img/result-lost.png](img/result-lost.png) (ô nhập tên), [img/leaderboard.png](img/leaderboard.png) (2 mục 420 điểm theo thứ tự lưu) | Đạt |
| 4. Đổi phím (báo trùng, khôi phục mặc định, lưu) | Ảnh client: Nhảy và Tương tác cùng là E → tô đỏ + cảnh báo | [img/settings-a11y.png](img/settings-a11y.png) | Đạt |
| 4. Phụ đề / chỉ báo hình ảnh | Ảnh: "⚠ Bóng Mực xuất hiện" + mũi tên tím ở mép màn hình; "🏮 Đèn L1 sắp cạn dầu" | [img/captions-arrow.png](img/captions-arrow.png), [img/large-text.png](img/large-text.png) | Đạt (gió và 10 s cuối: theo code, cùng cơ chế) |
| 4. Giảm chuyển động | Code: tắt rung camera, `#flash`, nhấp nháy đồng hồ | `web/main.js` (`settings.reducedMotion`) | Đạt theo code |
| 4. Chữ ≥ 18 px, ×1.25 | CSS `:root{font-size:18px}`, mọi cỡ chữ ≥ 1rem; ảnh chữ lớn | [img/large-text.png](img/large-text.png) | Đạt |
| 5. Clone sạch → 3 lệnh → chơi được | Clone vào thư mục mới → `npm install` → `npm start` (trang 200, three.js 200, API 200) → `npm test` 69/69 | lần chạy ngày 2026-11-20 | Đạt |
| 5. README, CHANGELOG 4 phase, CREDITS, LICENSE | — | [README.md](../../../README.md), [CHANGELOG.md](../../../CHANGELOG.md), [CREDITS.md](../../../CREDITS.md), [LICENSE](../../../LICENSE) | Đạt |
| 5. Release v1.0.0 có bản chạy được | Zip kèm three.js (`node server.js`, không cần cài) + Dockerfile | GitHub Release v1.0.0 | Zip: đạt. **Docker image chưa build thử** (Docker Desktop không chạy trên máy này) |
| 6. Contract v1.3 + v1.0–v1.2 giữ nguyên | R1 + 62 case Phase 1–3 không đổi | results.md | Đạt |
| 7. Retro | — | [docs/notes/retro.md](../../notes/retro.md) | Đạt (token là ước tính, cần điền số thật từ `/cost`) |
| 7. Video demo < 5 phút | — | — | **Chưa có**: cần người chơi quay màn hình |
| Hiệu năng chơi thật sau thay đổi | `scripts/fps-bench.js` Phase 3 | [../phase-3/fps.json](../phase-3/fps.json) | khoảng 55–58 FPS (vsync bật) |

## Chạy lại

```bash
npm test && npm run proof -- 4
node scripts/bench.js --seed 42 --duration 30 --out bench.json
node scripts/soak.js --seed 7 --nights 10 --out soak.json
PORT=5199 npm start &   # rồi: CHROME=<chrome> node scripts/screens.js docs/proof/phase-4/img
```
