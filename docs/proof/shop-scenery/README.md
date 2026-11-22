# Bằng chứng: làng trên đảo + cửa hàng phụ kiện (nhánh `feature/shop-scenery`, sau v1.0.0)

`npm test`: 71 case Phase 1–4 đạt (70 case cũ không đổi + R9 sửa lỗi đẩy Bóng Mực) và 5 case cửa hàng (SH1–SH5).
SH5 chạy trên PostgreSQL thật (`docker compose up -d db`, `SHOP_TEST_DATABASE_URL=postgres://ddl:ddl@localhost:5433/ddl`); không có biến này thì SH5 được bỏ qua và báo lý do.

| Hạng mục | Bằng chứng |
|---|---|
| Sửa lỗi: đẩy Bóng Mực ra mép vùng an toàn không thả xuống biển mây hay vào tháp chuông | Case R9 (kỳ vọng tính tay). Tái hiện trước khi sửa: Đêm 3, L6 sáng, Bóng Mực ở (21.49, 1, −37.6) → bị đẩy tới r = 46.31 (ngoài đảo 45 m); L1 sáng, Bóng Mực ở (0, 7, 1.5) → (0, 7, 0) trong tháp. Sau khi sửa: (25.791, 1, −36.571), r = 44.75. Soak 10 Đêm: 0 crash, RSS 36.2 → 38.2 MB. Bot → headless phát lại khớp (Đêm 1 thắng 1063, Đêm 3 thua 220). |
| Làng Đêm 1: nhà tranh có cửa sổ sáng, sân (chum, đống rơm, bụi hoa, đèn đá), cổng làng, giếng, cây bàng, cây cau, đường đá dẫn tới từng đèn, đèn trời bay lên | [img/village-n1.png](img/village-n1.png), [img/village-n1-close.png](img/village-n1-close.png) |
| Làng Đêm 2 (Đảo Cau): nhà sàn mái ngói, hàng cau quanh hai đảo, đèn đá hai đầu cầu | [img/village-n2.png](img/village-n2.png) |
| Làng Đêm 3: nhà trên tầng 0, cổng làng phía nam, cây quanh mép đảo | [img/village-n3.png](img/village-n3.png) |
| Nhà và đồ vật chặn Mây (chỉ ở client) | Qua DevTools trong client thật (Đêm 1): 89 vật cản, 5 nhà; chạy thẳng vào nhà thì dừng ở 2.25 m = bán kính nhà 1.85 + Mây 0.4. Headless không có vật cản (R8). |
| Cảnh bench vẫn chuẩn: không nhà, không đèn trời, không đường đá | [img/bench-scene.png](img/bench-scene.png) |
| Menu có nút "Cửa hàng phụ kiện" | [img/menu.png](img/menu.png) |
| Cửa hàng: số xu, 4 ô (Nón, Áo, Quần, Giày), mua, mặc, lưu PostgreSQL; Mây xem trước 3D bên phải | [img/shop.png](img/shop.png): 2400 xu − nón quai thao 600 − áo đỏ 400 = 1400; đang mặc cả hai |
| Mặc thử món chưa mua (áo gấm + mũ gấm), nút Mua mờ khi chưa đủ xu | [img/shop-tryon.png](img/shop-tryon.png) |
| Nhận xu sau mỗi Đêm (kể cả thua) | [img/result-xu.png](img/result-xu.png): Đêm thua với 345 điểm → "+345"; bảng `shop_earnings` trong PostgreSQL có dòng `Xu_Check 345`, `/api/shop/profile` trả `balance 345, storage postgres` |
| Cả stack Docker | `docker compose up -d --build`: container `game` in "Cửa hàng: lưu ở PostgreSQL", `GET /` 200, `GET /api/shop/profile` trả `storage: "postgres"` |

## Hiệu năng

Cấu hình đo: laptop Intel UHD 620, Chrome thật (GPU), 1280×720; trong lúc đo Docker Desktop (PostgreSQL + container game) và một dev server vẫn chạy.

- Chơi thật (vsync bật, có làng): [fps.json](fps.json) 51.7–52.6 FPS cho cả 4 cảnh, cùng khoảng 51–54 FPS của bản `ui-upgrade`.
- Cảnh bench chuẩn (vsync tắt, làng tắt): [bench.json](bench.json) là lần đo số 5 dưới đây. Đo xen kẽ với `ui-upgrade` (worktree tạm, cùng máy, cùng lúc):

| Lần | Nhánh này: FPS / 1 % low | `ui-upgrade`: FPS / 1 % low |
|---|---|---|
| 1 (lạnh, chạy đầu tiên) | 109.1 / **21.9** | — |
| 2 | 124.8 / **28.4** | 125.3 / 32.8 |
| 3 | 127.2 / 31.6 | 128.4 / 33.4 |
| 4 | 125.0 / 31.2 | 124.1 / 30.2 |
| 5 | 125.0 / 31.6 | 127.2 / 31.3 |

Trung bình FPS hai bên như nhau (124–128). 1 % low dao động 28–34 ở **cả hai** bản; lần 1 và lần 2 của nhánh này dưới ngưỡng 30. Khi đảo thứ tự chạy (lần 4–5, nhánh này chạy trước), nhánh này ngang hoặc cao hơn. Cảnh bench chạy đúng đường code cũ: `decorate()` trả về sớm khi `?bench`, không nạp hồ sơ cửa hàng, không đổi trang phục. Vì vậy tôi coi phần chênh là dao động của máy, không phải do thay đổi này. Không chỉnh số nào để qua ngưỡng.
