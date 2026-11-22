# ADR 0002: Kỹ năng Diệt Bóng, boss Chúa Bóng Mực, bản chơi trên Android

- **Trạng thái:** Đã chấp nhận (nhánh `feature/boss-android`, sau v1.0.0, không thuộc bài nộp)
- **Liên quan:** [ADR 0001](0001-lantern-fuel-and-dawn-win.md) (máy trạng thái Bóng Mực), giả định D22–D29

## Bối cảnh

Yêu cầu: (1) có app chơi trên điện thoại Android; (2) người chơi diệt được Bóng Mực, không chỉ làm choáng; (3) thêm một boss Bóng Mực có skill đặc biệt.

Các ràng buộc:

- Mọi luật nằm trong `src/sim/game.js` và phải tất định, để headless chạy được và test được.
- Test Contract v1.3 không có các luật này. Đầu ra headless của mọi input/scenario hiện có **không được đổi**: 76 case cũ, CI so sánh hai lần chạy, bộ chấm của lab.
- Số chuẩn của ticket không được đổi. Bảng `score` bị case P1 so sánh nguyên khối.

## Quyết định

### 1. Mọi luật mới đặt sau cờ `extras`

`new Game({ …, extras })`. Cờ chỉ bật khi client truyền `extras: true` (chơi bình thường) hoặc scenario có `"extras": true` (dùng cho test). Cảnh bench luôn tắt cờ này.

Khi cờ tắt:

- nút `banish` bị bỏ qua;
- không có boss;
- snapshot không có thêm trường nào.

Kết quả: JSONL giống hệt từng byte so với trước (case X1; đã so `cmp` ba Đêm × 3000 tick).

Các phương án đã loại:

- *Bật luôn trong contract.* Làm đổi đầu ra headless và phá test của bộ chấm. Phải tăng `contract_version`, việc này không thuộc phạm vi của tôi.
- *Chỉ làm ở `web/`.* Vi phạm quy tắc "không có luật trong client". Không test headless được, và lệch với lõi tất định.

### 2. Diệt Bóng (nút `banish`, phím F, chuột phải, nút cảm ứng ⚔)

Diệt Bóng chạy ở **bước 7b**, ngay sau Tỏa Sáng và trước khi Bóng Mực di chuyển. Vì thế bấm Tỏa Sáng và Diệt Bóng cùng một tick là một combo hợp lệ.

- **Điều kiện:** đang hoạt động (không đang rơi), hồi chiêu = 0, mang ≥ `banish_cost` (2) đom đóm.
- **Hiệu ứng:**
  - xóa mọi Bóng Mực **đang choáng** (`stunned`, không bị đẩy khỏi vùng an toàn) có khoảng cách 3D tới tâm (chân + 0.8 m, giống Tỏa Sáng) ≤ `banish_radius` (3 m);
  - mỗi con +`extras_score.per_banish` (20) điểm;
  - đặt hồi chiêu 60 tick;
  - bấm hụt vẫn tốn 2 đom đóm, giống Tỏa Sáng.
- **Event:** `banish {banished_ids, boss_hit}`.

Chỉ diệt được con đang choáng, nên Diệt Bóng là bước tiếp theo của Tỏa Sáng chứ không thay thế nó. Tỏa Sáng đẩy Bóng Mực lùi 4 m, mà Diệt Bóng chỉ với tới 3 m. Vì vậy người chơi phải bấm cùng lúc hoặc lướt tới trong 2 s choáng. Đây là kỹ năng có chủ ý, không phải lỗi.

Bóng Mực bị diệt được lấy ra khỏi danh sách. Lịch sinh của Ticket-02 sẽ sinh con mới khi số lượng thấp hơn `shadeMax`, nên độ khó của Đêm không sụp.

### 3. Boss Chúa Bóng Mực (`boss`, id `B1`)

```
 spawning(60) ─▶ chase ──(hết 12 s)──▶ cast(90 tick, đứng yên) ──▶ skill ──▶ chase
                  │  ▲                    │ Tỏa Sáng: ngắt, chu kỳ đếm lại
                  │  └── recoil(60) ◀─────┤
       Tỏa Sáng ──▶ stunned(90) ──Diệt Bóng──▶ −1 HP ──▶ recoil / defeated (HP 0)
```

| Mục | Luật |
|---|---|
| Xuất hiện | Một lần mỗi Đêm, ở `sim_tick` = `boss_spawn_s` × 60 (giây 60). Vị trí: điểm sinh xa Mây nhất, không nằm trong vùng an toàn; hòa thì lấy điểm đứng trước trong bản đồ. Không dùng `rng`. |
| HP | `boss_hp_base` + số Đêm → 3 / 4 / 5 |
| Di chuyển | 3.2 m/s về phía Mây khi Mây ở trong 30 m; nếu không thì về đèn đang sáng gần nhất. Dùng chung `moveShade`, nên cũng không vào được vùng an toàn, không ra biển mây, không leo tường. Bị đẩy ra khỏi vùng vừa sáng giống Bóng Mực (bước 6). |
| Chạm | ≤ 1.6 m (chiều cao ≤ 2 m) khi đang `chase` hoặc `cast`, Mây không bất tử → mất 1 lửa, rơi nửa số đom đóm (dùng chung `hitPlayer`). Đang `chase` thì boss bị đẩy lùi 2 m trong 60 tick. Chỉ xét sau Bóng Mực, nên mỗi tick tối đa một cú đánh. |
| Choáng | Tỏa Sáng trong 5 m → choáng 90 tick, không bị đẩy, +5 điểm. Đang niệm thì **ngắt skill**: event `boss_stunned {interrupted: true}`, mất skill đó, chu kỳ đếm lại 12 s. |
| Sát thương | Diệt Bóng khi boss đang choáng và cách ≤ `boss_reach_m` (4 m, vì boss to hơn) → −1 HP, +50. HP 0 → `defeated`, +300, boss đứng yên không làm gì nữa. |
| Skill | Cứ 12 s (đếm trong `chase`/`recoil`) chuyển sang `cast` 90 tick, có báo trước (`boss_cast`). Hai skill luân phiên: **Triệu Hồi** → **Nhật Thực** → … |
| Triệu Hồi | Gọi 2 Bóng Mực (`spawning`) ở vòng tròn 2.5 m quanh boss, góc k·360°/2. Bỏ chỗ là biển mây, tháp hoặc vùng an toàn. Tổng số Bóng Mực tối đa `shadeMax` + 4. |
| Nhật Thực | Mỗi đèn sáng trong 14 m mất 25 dầu, ≤ 0 thì tắt ngay (`lantern_out`). Mây trong 5 m bị sóng xung kích đánh (`player_hit {by: "boss_shock"}`). Đứng ở tâm đèn (cách mép vùng 6 m) là an toàn trước sóng. |

**Event mới:** `boss_spawned`, `boss_cast`, `boss_skill`, `boss_stunned`, `boss_hit`, `boss_defeated`; `player_hit.by` có thêm `boss`, `boss_shock`.

**Snapshot khi bật extras:** `banish_cd_s`, `boss: {id, pos, state, hp, hp_max, skill, next_skill, skill_in_s, cast_left_s} | null`.

**Scenario:** `extras`, `random_boss`, `boss: {pos, state, hp, state_ticks_left, skill_ticks_left, next_skill}`, `player.banish_cd_ticks`. Tất cả do `io.js` kiểm tra; sai định dạng thì mã thoát 2 (case X11).

### 4. Số liệu

Mọi số nằm trong `game.contract.json`: các khóa `banish_*` và `boss_*` (số tự chọn) cùng object riêng `extras_score`. Bảng `score` chuẩn giữ nguyên, nên case P1 không đổi.

### 5. Android

Gồm hai đường, dùng chung một client:

1. **PWA:** `manifest.webmanifest` (fullscreen, landscape, icon thường + maskable), service worker `/sw.js` (ưu tiên mạng, có cache để chơi offline). Mở bằng Chrome Android → "Cài đặt ứng dụng". Cần HTTPS hoặc `localhost`; qua `http://<IP LAN>` thì chơi được trong trình duyệt nhưng không cài được.
2. **App Capacitor** (`android-app/`, `package.json` riêng để `npm install` của game vẫn nhẹ):
   - `copy-web.js` chép client vào `www/` giữ nguyên đường dẫn tuyệt đối (`/web`, `/src`, `/node_modules/three`), nên `index.html` chạy không cần sửa;
   - activity ở chế độ immersive, `sensorLandscape`, giữ màn hình sáng;
   - không có server: bảng xếp hạng và cửa hàng dùng bộ nhớ máy, cùng luật `src/*-rules.js`;
   - APK debug được build trên GitHub Actions (`.github/workflows/android.yml`), vì runner Ubuntu đã có Android SDK còn máy dev thì không.

**Điều khiển cảm ứng** (`web/main.js`, chỉ là input, không có luật):

- joystick nổi ở nửa trái, kéo nửa phải để xoay camera;
- 5 nút hành động có vòng hồi chiêu;
- một lần chạm ngắn hơn 1 tick vẫn được giữ tới khi sim đọc xong (`touchAfterStep`);
- tự bật khi con trỏ là loại thô (`pointer: coarse`), hoặc ép bằng `?touch`.

## Hệ quả

- **Tốt:**
  - contract và mọi test cũ giữ nguyên;
  - luật mới tất định, có 12 case headless (X1–X12) với kỳ vọng tính tay;
  - client không chứa luật.
- **Đánh đổi:**
  - điểm khi bật extras cao hơn khi tắt, vì có thêm điểm diệt và điểm boss, nên bảng xếp hạng giữa hai chế độ không so sánh trực tiếp được (D27);
  - `?noextras` cho phép chơi đúng luật v1.0.0.
- **Rủi ro:**
  - boss ra ở giây 60 của Đêm 1 có thể khó với người mới (HP 3, skill báo trước 1.5 s, ngắt được);
  - cân bằng mới chỉ dựa trên tính tay và ảnh chụp, chưa có playtest với người thật (D28).
