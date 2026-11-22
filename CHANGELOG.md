# Changelog

Ghi theo phase (tag git). Mục **BREAKING** liệt kê thay đổi phá vỡ tương thích với contract, scenario, output headless hoặc test của phase trước.

## [Unreleased] — nhánh `feature/boss-android` (tách từ `feature/shop-scenery`, không thuộc bài nộp)

Quyết định: [ADR 0002](docs/adr/0002-banish-skill-and-shade-boss.md) · giả định D22–D29 · spec X-6…X-11.

### Không BREAKING với contract

Mọi luật mới nằm sau cờ `extras`: client bật khi chơi, headless chỉ bật khi scenario có `"extras": true`. Khi cờ tắt, đầu ra headless giống hệt v1.3 từng byte (case X1; `cmp` ba Đêm × 3000 tick trước và sau khi đổi). 76 case cũ không đổi. Bảng `score` chuẩn giữ nguyên; điểm mới nằm ở `extras_score`.

### Thêm

- **Diệt Bóng** (nút `banish`; phím `F`, chuột phải, nút cảm ứng ⚔): xóa mọi Bóng Mực đang choáng trong 3 m. Tốn 2 đom đóm, hồi 1 s, +20 điểm mỗi con. Chạy ở bước 7b, nên Tỏa Sáng + Diệt Bóng cùng tick là một combo.
- **Boss Chúa Bóng Mực**: xuất hiện ở giây 60 mỗi Đêm, HP 3/4/5. Đuổi Mây; Tỏa Sáng làm choáng 1.5 s, Diệt Bóng trừ 1 HP (+50), hạ boss +300. Hai skill luân phiên mỗi 12 s, báo trước 1.5 s và ngắt được bằng Tỏa Sáng: **Triệu Hồi** (gọi 2 Bóng Mực) và **Nhật Thực** (đèn trong 14 m mất 25 dầu, Mây trong 5 m bị đánh).
- Event `banish`, `boss_spawned`, `boss_cast`, `boss_skill`, `boss_stunned`, `boss_hit`, `boss_defeated`. Snapshot có `banish_cd_s` và `boss` (chỉ khi bật extras). Scenario có `extras`, `random_boss`, `boss`, `player.banish_cd_ticks` (`io.js` kiểm tra; sai thì mã thoát 2).
- Client: boss vẽ bằng mesh riêng (vương miện tím, mắt đỏ, xúc tu, vòng báo skill trên đất); thanh máu và thanh niệm trên HUD; mũi tên chỉ boss; hiệu ứng nổ khi diệt; âm thanh tổng hợp mới; chấm boss trên bản đồ nhỏ; phím Diệt Bóng đổi được trong Cài đặt.
- **Chơi trên Android**:
  - **điều khiển cảm ứng**: joystick nổi, kéo để xoay camera, 5 nút có vòng hồi chiêu, rung nhẹ khi bấm;
  - UI gọn cho màn hình thấp;
  - **PWA** (`manifest.webmanifest`, `/sw.js` để chơi offline, icon thường + maskable sinh bằng `scripts/make-icons.js`);
  - **app Capacitor** `android-app/`: chạy offline, immersive, xoay ngang;
  - workflow `android.yml` build APK debug trên GitHub Actions;
  - server in thêm địa chỉ LAN để mở game từ điện thoại cùng Wi-Fi.
- 12 case `tests/cases-extras.js` (X1–X12), kỳ vọng tính tay.
- `scripts/screens.js`: kích thước màn hình riêng cho từng ảnh (ảnh điện thoại), thêm ảnh boss, Diệt Bóng và cảm ứng.

## [Unreleased] — nhánh `feature/shop-scenery` (tách từ `ui-upgrade`, không thuộc bài nộp)

### Sửa lỗi (đầu ra headless đổi ở trường hợp biên)

| # | Thay đổi | Trước | Sau |
|---|---|---|---|
| F1 | Đẩy Bóng Mực ra mép vùng an toàn | Đẩy thẳng ra xa đèn, không xét địa hình: ở Đêm 3, Bóng Mực trong vùng L6/L7 bị thả ra biển mây (r 46.3 > 45), trong vùng L1 bị đẩy vào tháp chuông; độ cao giữ nguyên khi qua tầng | Chỗ mép thẳng hướng ra bị chặn thì lấy chỗ mép trống gần nhất (bước 15°); độ cao bám theo địa hình. Giả định D17, case R9. 70 case cũ không đổi. |

- Comment `SHADE_CLIMB` bị dính vào dòng `PLAYER_RADIUS` được tách lại; header `headless.js`, `game.js`, `io.js` ghi Contract v1.3.

### Thêm

- **Làng trên đảo** (`web/scenery.js` `village()`, `skyLanterns()`): nhà tranh, nhà sàn (cửa sổ sáng), sân nhà (chum, đống rơm, bụi hoa, đèn đá), cổng làng, giếng, cây bàng, cây cau, đường đá từ điểm xuất phát tới từng đèn, đèn trời bay lên. Mỗi loại đồ vật vẽ bằng instancing theo từng bộ phận. Nhà và đồ vật chặn Mây như cây/đá (chỉ ở client, D21). Tắt trong cảnh bench.
- **Cửa hàng phụ kiện**: chơi xong mỗi Đêm (thắng hay thua) nhận xu bằng điểm của Đêm đó (D18, D19). 18 món ở 4 ô (nón, áo, quần, giày), mua, mặc, mặc thử; Mây có 5 kiểu nón (`web/may.js` `setOutfit`). Màn Cửa hàng có camera xoay quanh Mây. Luật dùng chung ở `src/shop-rules.js`.
- **PostgreSQL bằng Docker**: `docker-compose.yml` (PostgreSQL 16 + game), `src/shop-store.js` (PostgreSQL có transaction, hoặc file `data/shop.json` khi không có `DATABASE_URL`), API `/api/shop/*` trong `server.js` (D20). Thêm dependency `pg`.
- `leaderboard-rules.js`: tách `checkName()` để cửa hàng dùng chung luật tên (hành vi không đổi).
- 5 case cửa hàng (`tests/cases-shop.js`, SH1–SH5). SH5 chạy trên PostgreSQL thật khi có `SHOP_TEST_DATABASE_URL`, không có thì bỏ qua kèm lý do.
- `scripts/screens.js`: ảnh làng, cửa hàng, nhận xu; tham số `?cam=` (chỉ dùng khi chụp ảnh) để đặt camera.
- Bằng chứng: [docs/proof/shop-scenery/](docs/proof/shop-scenery/README.md). Bench đo xen kẽ với `ui-upgrade`: FPS như nhau (124–128); 1 % low 28–34 ở cả hai bản, có 2/5 lần đo của nhánh này dưới 30 (giải thích trong proof).

## [Unreleased] — nhánh `ui-upgrade` (sau v1.0.0, không thuộc bài nộp)

Không đổi luật, số liệu, contract hay đầu ra headless (70/70 case; 69 case cũ không đổi). Bằng chứng: [docs/proof/ui-upgrade/](docs/proof/ui-upgrade/).

- **Đồ họa 3D** (`web/scenery.js`): bầu trời có dải màu, trăng có quầng, sao lấp lánh; biển mây trôi (nhiễu tính theo đỉnh); đảo có vách đá lởm chởm, đáy nhọn, mặt cỏ loang màu; cây nhiều tầng, đá, cỏ (instancing); đom đóm trang trí bay lượn; bóng tiếp đất cho Mây và Bóng Mực; quầng sáng và vũng sáng quanh đèn; tán lá gần camera mờ dần (dither) để không che Mây.
- **Nhân vật Mây** (`web/may.js`): tạo hình gốc mới, vẫn đội nón lá treo đèn lồng nhỏ, áo trắng ngà, khăn đỏ; tay chân có khớp; hoạt ảnh chạy, nhảy, lướt (vệt sáng), đèn lồng đung đưa, khăn bay theo tốc độ.
- **Va chạm đá và cây**: vật cản chỉ có ở client (`Game({ obstacles })`); Mây bị chặn và trượt dọc; đá thấp nhảy qua được; cây cối tránh xa đèn, điểm sinh, bục nhảy, cầu và dốc. Headless không truyền vật cản. Case R8.
- **Menu và màn hình**: khối tiêu đề có logo đèn lồng, nút có icon, 3 thẻ Đêm (đánh dấu Đêm đã thắng kèm điểm), phần điều khiển gập được, camera bay vòng quanh đảo phía sau menu; màn giới thiệu kiểu chương truyện, mục tiêu dạng chip; hiệu ứng chuyển màn (tắt khi giảm chuyển động).
- **HUD**: panel kính tối viền vàng; đồng hồ kèm vòng tiến độ Đêm; bảng trạng thái từng đèn (thanh dầu hoặc tiến độ nạp, nhấp nháy khi < 30); hồi chiêu dạng vòng quét; bản đồ nhỏ xoay theo camera.
- **Hiệu năng**: trời và biển vẽ sau vật thể đục (early-z), bản đồ nhỏ tắt trong cảnh bench (UI sáng tạo). Bench trên UHD 620: 116.4 FPS / 1 % low 30.2 (bản v1.0.0 đo xen kẽ cùng lúc: 118–120 / 28–33). Chơi thật: 51–54 FPS (vsync).

## [phase-4] / v1.0.0 — Ticket-04 "Bình minh: phát hành v1.0.0" · Test Contract v1.3

Spec: [docs/spec/phase-4.md](docs/spec/phase-4.md) · Bằng chứng: [docs/proof/phase-4/](docs/proof/phase-4/) · Retro: [docs/notes/retro.md](docs/notes/retro.md)

### BREAKING

| # | Thay đổi | Trước | Sau |
|---|---|---|---|
| B1 | **Cấu trúc repo** | Game nằm trong thư mục con `dao-den-long/`; README gốc là đề lab | Game ở **gốc repo**: `game.contract.json` ở gốc đúng quy định contract; `headless_cmd` chạy từ gốc. Đề lab chuyển vào `docs/lab/`. Lịch sử giữ nguyên (`git mv`). Tag `phase-1…3` vẫn trỏ cấu trúc cũ. |
| B2 | `contract_version` | `"1.2"` | `"1.3"`, thêm `bench_cmd` (`node scripts/bench.js`) và `soak_cmd` (`node scripts/soak.js`). Mọi yêu cầu v1.0–v1.2 giữ nguyên. |
| B3 | Node.js | ≥ 20 | **≥ 22** (bench dùng `WebSocket` có sẵn của Node). CI chuyển lên Node 22. |
| B4 | Phím mặc định | Tạm dừng `Esc`/`P` cố định; mũi tên di chuyển | Mọi hành động đổi được trong Cài đặt (lưu lại). Mặc định WASD, Space, Shift trái, E, Q, P; `Esc` luôn tạm dừng. Phím mũi tên không còn gán sẵn. |
| B5 | Server | Chỉ phục vụ file tĩnh | Thêm `GET/POST /api/leaderboard` và `--export-leaderboard <file>`; dữ liệu ở `data/leaderboard.json` (`$LEADERBOARD_FILE`). |

### Thêm

- **Benchmark** (`bench_cmd`): cửa sổ Chrome 1280×720, vsync tắt, cảnh chuẩn (Đêm 1, 200 Bóng Mực wander rải đều seed 42, 100 đom đóm, L1–L3 sáng fuel 100, camera bay vòng r 30 m / Y 15 m / 15 s), khởi động 3 s, ghi `bench.json` (avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms, peak_mem_mb, vsync_off, renderer, os). Cờ `bench` trong lõi tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm.
- **Soak** (`soak_cmd`): N Đêm trong một tiến trình (1→2→3), seed 7 + i, input ngẫu nhiên theo seed, ghi `soak.json` (kèm heap JS để phân biệt rò rỉ với phần khởi động của V8).
- **Bảng xếp hạng cục bộ**: nhập tên sau Bình Minh hoặc khi thua; top 10, điểm giảm dần, bằng điểm thì ai đạt trước đứng trên; lưu trên đĩa; màn Bảng xếp hạng từ menu; xuất JSON. Không có server thì lưu trong trình duyệt.
- **Trợ năng**: đổi phím (báo trùng, khôi phục mặc định); phụ đề và chỉ báo hình ảnh (Bóng Mực xuất hiện kèm mũi tên ở mép màn hình, gió, 10 s cuối, đèn < 30 dầu); giảm chuyển động (tắt rung camera, chớp màn hình, nhấp nháy đồng hồ); chữ UI tối thiểu 18 px, tùy chọn ×1.25.
- **Hiệu năng**: Bóng Mực và đom đóm vẽ bằng instancing; HUD chỉ ghi DOM khi giá trị đổi. Bench trên UHD 620 tăng từ 36 lên khoảng 123 FPS.
- **Đóng gói**: `Dockerfile`, zip chạy được trong Release v1.0.0, README đủ mục, CREDITS chi tiết.
- 7 case Phase 4 (`tests/cases4.js`, R1–R7). Không case cũ nào bị đổi.

## [phase-3] — Ticket-03 "Đèn cạn dầu" · Test Contract v1.2

Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md) · Spec: [docs/spec/phase-3.md](docs/spec/phase-3.md)

### BREAKING

| # | Thay đổi | Trước (v1.1) | Sau (v1.2) |
|---|---|---|---|
| B1 | Luật thắng | Thắng ngay khi mọi đèn sáng, `reason: "all_lit"` | Không thắng sớm. Thắng ở bình minh khi số đèn đang sáng ≥ ceil(0.6 × tổng), `reason: "dawn_survived"`. **`all_lit` không còn được phát.** |
| B2 | Thời lượng Đêm | 300 / 330 / 360 s | **240 / 270 / 300 s** (`night*_duration_s`, `time_left_s` ban đầu) |
| B3 | Bảng điểm | +10/đom đóm nạp, +100/đèn, +5/Bóng Mực, +2/giây còn lại, +50/lửa | +5/đom đóm nạp (cả châm dầu), +100 thắp lần đầu, **+40 thắp lại**, +5/Bóng Mực (**+15 nếu đang drain**), bình minh **+50 + floor(fuel)/đèn sáng**, +50/lửa; **bỏ thưởng thời gian** (`per_second_left: 0`) |
| B4 | Đèn đã sáng | Sáng mãi, không nhận thêm đom đóm, tương tác bỏ qua | Có `fuel` 0–100, hao 1/giây, **tắt khi hết dầu** (`lantern_out`, `deposited = 0`); tương tác ở đèn sáng chưa đầy = **châm dầu** (`refuel`) |
| B5 | Vùng an toàn | Mọi đèn sáng | Chỉ đèn sáng có **fuel ≥ 30** |
| B6 | Bóng Mực | Trạng thái: spawning, wander, chase, recoil, stunned; wander lượn ngẫu nhiên | Thêm **`drain`**; wander đi tới đèn sáng yếu gần nhất, không có thì đèn tắt gần nhất |
| B7 | Sức chứa | Cố định 10 | **10 + 2 × successful_lights, tối đa 20** (`player.capacity`) |
| B8 | Snapshot | `lanterns[]`: id, pos, lit, deposited | thêm **`fuel`** (1 chữ số thập phân), **`ever_lit`**, **`relit_count`**; `player` thêm **`capacity`** |
| B9 | Sự kiện | `lantern_lit {lantern_id}` | `lantern_lit {lantern_id, relight}`; mới: `refuel`, `lantern_out`, `fuel_drain` |
| B10 | Scenario | — | `lanterns[].fuel` (mặc định 100 nếu `lit: true`), `lanterns[].ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`; `state: "drain"` bắt buộc có `target_lantern_id`; sai kiểu → mã 2 |
| B11 | `contract_version` | `"1.1"` | `"1.2"`; tuning thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max` (+ khóa phụ `capacity_per_light`, `drain_range_m`, `drain_break_m`, `fuel_drain_event_ticks`) |

### Test bị luật mới làm sai (đã cập nhật, không skip)

| Case | Cập nhật | Lý do |
|---|---|---|
| G3 | `lantern_lit` kỳ vọng thêm `relight: false` | B9 |
| G11 | Viết lại: thắp hết không kết thúc Đêm; thắng ở bình minh với 3/5, điểm 3 × (50 + 99) + 150 | B1, B3 |
| P1 | Thời lượng 240/270/300 và bảng điểm mới | B2, B3 |
| P2 | `time_left_s` ban đầu 240/270/300 | B2 |
| P10 | Đèn sáng ở 0.5 m (99.98 dầu sau bước 2) giờ được chọn để châm dầu, thay vì bị bỏ qua | B4 |
| P24 | `time_left_s` kỳ vọng tính từ `night1_duration_s` | B2 |
| P25 | Viết lại: hết lửa ở tick bình minh → no_flames; 3/5 → dawn_survived; 2/5 → dawn | B1 |

Các case khác của Phase 1–2 vẫn đạt nguyên trạng.

### Thêm

- 13 case Phase 3 (`tests/cases3.js`, F1–F13): dầu hao, tắt, thắp lại, châm dầu, mất vùng < 30, đích của wander, drain cộng dồn và `fuel_drain`, rời drain, đẩy ra khi châm lên ≥ 30, ngưỡng thắng từng Đêm, sức chứa, scenario sai.
- Client: thanh dầu trên đèn, đèn và thanh nhấp nháy 1 Hz khi fuel < 30, đèn tắt xẹp 20 % và có vết rách giấy, vòng an toàn chỉ hiện khi còn vùng, HUD "đang mang/sức chứa", "cần k lúc bình minh", nhắc "Châm dầu / Thắp lại", mũi tên ưu tiên đèn yếu.
- Cài đặt **"Bảng màu dễ phân biệt"** (lưu lại): viền và mắt Bóng Mực `#00B3FF`, cảnh báo UI `#FFFFFF` kèm ⚠.
- ADR 0001, spec Phase 3.

## [phase-2] — Ticket-02 "Ba hòn đảo" · Test Contract v1.1

BREAKING so với phase-1: thay mọi số tự chọn bằng số chuẩn; `--night 2|3`; điểm đom đóm tính khi nạp; Bóng Mực lùi sau khi chạm; rơi khỏi đảo bị phạt (`fall_enabled: true`). Chi tiết và lý do sửa test: [docs/notes/assumptions.md](docs/notes/assumptions.md) mục B.

## [phase-1] — PRD-0 · Test Contract v1.0

Bản đầu tiên: Đêm 1 (Đảo Bến, 5 đèn), nhặt đom đóm, nạp và thắp đèn, Bóng Mực đuổi, Tỏa Sáng, thắng/thua/điểm, chơi lại; headless theo contract v1.0 (snapshot/event/end JSONL, mã thoát 2 khi file sai, tất định theo seed); 21 case kiểm chứng; harness (AGENTS.md, hook test-gate, skill verify); CI.
