# Bằng chứng: nâng cấp giao diện (nhánh `ui-upgrade`, sau v1.0.0)

Không đổi luật, số liệu, contract hay headless: `npm test` 70/70 (69 case cũ không đổi + R8 cho vật cản chỉ có ở client).

| Hạng mục | Bằng chứng |
|---|---|
| Menu: logo, nút có icon, thẻ 3 Đêm, camera bay vòng phía sau | [menu.png](menu.png) |
| Màn giới thiệu Đêm kiểu chương truyện, chip mục tiêu | [intro-night2.png](intro-night2.png) |
| Đồ họa: trời, biển mây, đảo đá, cây nhiều tầng, cỏ, quầng sáng đèn, bóng tiếp đất; Mây mới (nón lá, khăn đỏ) | [night2-bridge-pad.png](night2-bridge-pad.png), [night3-tiers-wind.png](night3-tiers-wind.png), [p3-fuel-drain.png](p3-fuel-drain.png) |
| HUD: vòng thời gian, bảng trạng thái đèn, hồi chiêu dạng vòng, bản đồ nhỏ xoay theo camera | [p3-fuel-drain.png](p3-fuel-drain.png) (L1 đỏ < 30 dầu; trên bản đồ nhỏ L2 nằm bên trái, khớp màn hình) |
| Va chạm cây/đá trong client thật | Chạy qua DevTools: 75 vật cản (25 cây) được truyền vào sim; chạy thẳng vào cây thì dừng ở 0.70 m = bán kính cây + 0.4. Case R8 (headless không có vật cản) |
| Cảnh bench vẫn chuẩn (không cây/cỏ/đom đóm trang trí/bản đồ nhỏ) | [bench-scene.png](bench-scene.png) |
| Hiệu năng | [bench.json](bench.json): 116.4 FPS · 1 % low 30.2 · p95 12.6 ms · load 2252 ms; [fps.json](fps.json): chơi thật 51–54 FPS ở 1280×720 |

Đo xen kẽ (cùng điều kiện nhiệt) v1.0.0 và bản nâng cấp: v1.0.0 118–120 FPS / 1 % low 28–33; bản nâng cấp sau tối ưu 109–117 / 27–36. 1 % low trên laptop này dao động mạnh theo nhiệt độ ở **cả hai** bản. Nguyên nhân từng làm giảm FPS và cách sửa: bản đồ nhỏ vẽ 200 chấm (tắt trong bench), trời và biển phủ toàn màn hình được vẽ trước vật thể (chuyển sang vẽ sau, early-z).
