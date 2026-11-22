# Đảo Đèn Lồng — v1.0.0

> 🎬 **Video demo:** _(chưa có — sẽ đính kèm Release [v1.0.0](../../releases/tag/v1.0.0) hoặc `docs/demo/demo.mp4`)_
> Day 12 · AI SDLC Lab · Tác giả: Mai Văn Thành (2A202603696) · Tài liệu của lab: [docs/lab/](docs/lab/)

Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá. Qua **3 Đêm, 3 hòn đảo** (Đảo Bến, Đảo Cau, Đảo Chuông), gom đom đóm, thắp đèn và **giữ đảo sáng tới bình minh**. Đèn cạn dầu sẽ tắt. Bóng Mực tím đen hút dầu đèn yếu, Gió Lạc cướp đom đóm.

![Đảo Cau: cầu tre, Bùa Gió, Gió Lạc, Bóng Mực](docs/proof/phase-2/img/night2-bridge-pad.png)

| | |
|---|---|
| ![Đèn yếu bị hút dầu, thanh dầu, đèn tắt rách giấy](docs/proof/phase-3/img/p3-fuel-drain.png) | ![Cảnh benchmark: 200 Bóng Mực, 100 đom đóm](docs/proof/phase-4/img/bench-scene.png) |

## Yêu cầu hệ thống

- **Node.js ≥ 22** (macOS, Linux hoặc Windows). Không cần công cụ build nào khác.
- Trình duyệt có WebGL: Chrome/Edge/Firefox/Safari bản mới. Bench cần **Chrome, Chromium hoặc Edge** (tự dò, hoặc `--chrome <đường dẫn>`).
- Máy tham khảo: i5-8265U + Intel UHD 620 (GPU tích hợp), 8 GB RAM, đạt khoảng 123 FPS trong bench.

## Cài đặt & chạy (3 lệnh)

```bash
cd K5-L3A-LAB-Day12-MaiVanThanh-2A202603696-AI-SDLC-Dao-Den-Long   # thư mục vừa clone
npm install        # build_cmd (chỉ tải three.js)
npm start          # run_cmd → mở http://localhost:5173
```

Không muốn cài Node: dùng Docker (xem [Dockerfile](Dockerfile)) hoặc file zip trong [Release v1.0.0](../../releases/tag/v1.0.0) (đã kèm three.js; chỉ cần `node server.js`).

### Cửa hàng phụ kiện + PostgreSQL bằng Docker (nhánh `feature/shop-scenery`)

Chơi xong mỗi Đêm (thắng hay thua) nhận **xu** bằng điểm của Đêm đó. Vào **Cửa hàng phụ kiện** ở menu để mua và mặc cho Mây nón, áo, quần, giày (bấm vào món đồ để mặc thử). Dữ liệu cửa hàng lưu trong PostgreSQL.

```bash
docker compose up --build                 # game + PostgreSQL → http://localhost:5173
# hoặc chỉ chạy database, game chạy bằng Node:
docker compose up -d db
DATABASE_URL=postgres://ddl:ddl@localhost:5433/ddl npm start
```

- Không đặt `DATABASE_URL` thì `npm start` lưu cửa hàng vào `data/shop.json`. Mở bản web tĩnh không có server thì lưu trong trình duyệt.
- PostgreSQL được map ra cổng **5433** của máy (đổi bằng `PG_PORT`) để không đụng PostgreSQL có sẵn ở 5432. Mật khẩu `ddl` chỉ dùng cho máy cá nhân; đổi bằng biến `POSTGRES_PASSWORD`.
- Test cửa hàng trên PostgreSQL thật: `SHOP_TEST_DATABASE_URL=postgres://ddl:ddl@localhost:5433/ddl npm test`.
- API: `GET /api/shop/profile?name=` · `POST /api/shop/earn {name, run_id, score}` · `POST /api/shop/buy {name, item}` · `POST /api/shop/equip {name, item}`.

### Deploy lên VPS

- **VPS Windows** (từ PowerShell 4 / Windows Server 2012 R2 trở lên, không cần Docker). Server 2016 trở lên dùng Node 22 và Caddy mới nhất; Windows cũ hơn tự dùng Node 16.20.2 và Caddy 2.6.4 (Node 18+ và Go 1.21+ không còn chạy trên đó). Mở PowerShell bằng **Run as Administrator**:

  ```powershell
  Set-ExecutionPolicy -Scope Process Bypass -Force
  Invoke-WebRequest https://raw.githubusercontent.com/MaiVanThanhDev/K5-L3A-LAB-Day12-MaiVanThanh-2A202603696-AI-SDLC-Dao-Den-Long/feature/boss-android/deploy/windows/install.ps1 -OutFile install.ps1
  .\install.ps1 -Domain game.example.com   # chưa có tên miền: .\install.ps1  → http://<IP VPS>
  ```

  Script cài Node portable, code game, Caddy (HTTPS tự động) và tác vụ tự khởi động, rồi mở cổng 80/443. Chạy lại lệnh đó để cập nhật. Dữ liệu nằm ở `C:\ddl\data`.
- **VPS Linux** (Docker): `cp deploy/env.example deploy/.env`, sửa `DOMAIN` và `POSTGRES_PASSWORD`, rồi `sh deploy/deploy.sh`. Stack gồm game, PostgreSQL và Caddy.

### Chơi trên điện thoại Android (nhánh `feature/boss-android`)

Màn hình cảm ứng tự bật điều khiển cảm ứng: **joystick** ở nửa trái, **kéo** nửa phải để xoay camera, các nút **Nạp đèn · Diệt Bóng · Tỏa Sáng · Lướt · Nhảy**, nút ❚❚ để tạm dừng. Có ba cách chơi:

1. **Trình duyệt trên điện thoại, cùng Wi-Fi:** `npm start` in ra địa chỉ LAN (ví dụ `http://192.168.1.25:5173`). Mở địa chỉ đó bằng Chrome trên điện thoại. Nếu Windows hỏi tường lửa cho Node.js, chọn "Cho phép" với mạng riêng.
2. **Cài như ứng dụng (PWA):** game có manifest và service worker (chơi offline). Mở bằng Chrome Android qua **HTTPS** (hoặc `localhost`), rồi chọn menu ⋮ → **Cài đặt ứng dụng**. Qua `http://<IP LAN>` thì chỉ chơi được trong trình duyệt, không cài được.
3. **App APK (Capacitor, chạy offline, không cần server):** project ở [android-app/](android-app/).
   - **Không cần cài gì:** đẩy code lên GitHub, vào tab **Actions → android-apk** (hoặc bấm "Run workflow"), tải artifact `dao-den-long-apk` về, rồi cài `app-debug.apk` lên máy (cho phép "cài ứng dụng không rõ nguồn gốc").
   - **Build trên máy** (cần Android Studio hoặc Android SDK và JDK 21):

     ```bash
     npm install                     # ở gốc repo (three.js)
     cd android-app && npm install
     npm run apk                     # chép game vào www/, cap sync, gradlew assembleDebug
     # → android-app/android/app/build/outputs/apk/debug/app-debug.apk
     npm run open                    # hoặc mở bằng Android Studio để chạy trên máy ảo / điện thoại
     ```

   Trong app, bảng xếp hạng và cửa hàng lưu trên máy (không có server).

## Điều khiển (đổi được trong Cài đặt)

| Phím mặc định | Hành động |
|---|---|
| `W A S D` | Di chuyển theo hướng camera |
| Chuột (bấm vào màn hình để khóa chuột) · `Z` / `C` | Xoay camera |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| `E` | Nạp ánh sáng / thắp lại / châm dầu ở đèn gần nhất (trong 2 m) |
| `Q` / chuột trái | Tỏa Sáng: tốn 3 đom đóm, choáng và đẩy lùi Bóng Mực trong 5 m |
| `F` / chuột phải | **Diệt Bóng**: tốn 2 đom đóm, xóa Bóng Mực **đang choáng** trong 3 m (hồi 1 s). Tỏa Sáng đẩy chúng lùi 4 m, nên bấm `Q`+`F` cùng lúc hoặc lướt tới rồi bấm `F`. Cũng là cách duy nhất làm Chúa Bóng Mực mất máu. |
| `P` / `Esc` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `F3` | Hiện FPS |

**Cài đặt** (được lưu): âm lượng, độ nhạy chuột, **đổi phím** cho mọi hành động (báo phím trùng, nút "Khôi phục mặc định"), **bảng màu dễ phân biệt** (mù màu), **phụ đề và chỉ báo hình ảnh** (Bóng Mực xuất hiện kèm mũi tên ở mép màn hình, gió sắp thổi, 10 s cuối, đèn dưới 30 dầu), **giảm chuyển động** (tắt rung camera và chớp màn hình), **chữ lớn ×1.25** (chữ UI tối thiểu 18 px).

## Luật chơi (Test Contract v1.3)

**Mục tiêu: giữ đảo sáng tới bình minh.** Hết giờ (Đêm 1/2/3: 4:00 / 4:30 / 5:00) mà Mây còn sống và số đèn **đang sáng** ≥ 60 % (3/5, 4/6, 5/7) thì **thắng**. Thiếu đèn hoặc hết 3 Ngọn Lửa thì **thua** (chơi lại Đêm đó).

- **Dầu đèn:** đèn vừa thắp có 100 dầu, cháy 1 dầu/giây, hết dầu thì tắt. Bấm tương tác ở đèn đang sáng để châm dầu (1 đom đóm = 10 dầu). Thắp lại đèn đã từng sáng chỉ cần 5 đom đóm (lần đầu cần 10).
- **Đèn yếu (< 30 dầu)** mất vùng an toàn 6 m. Bóng Mực tìm tới và hút 5 dầu/giây. Tỏa Sáng hoặc châm dầu lên ≥ 30 để đuổi chúng.
- **Sức chứa** 10, tăng 2 mỗi lần thắp thành công, tối đa 20. Bị Bóng Mực chạm: −1 lửa, rơi nửa số đom đóm. Rơi khỏi đảo: −1 lửa, mất hết đom đóm.
- **Gió Lạc** (Đêm 2, 3) cướp 3 đom đóm khi bạn mang ≥ 5. **Bùa Gió**: 10 s chạy 7.2 m/s, lướt không hồi. **Gió mạnh** (Đêm 3) mỗi 30 s.
- **Chúa Bóng Mực** (boss, nhánh `feature/boss-android`): trỗi dậy ở giây 60 mỗi Đêm, 3/4/5 máu. Nó đuổi theo Mây và không vào được vùng đèn sáng. Mỗi 12 s nó niệm một chiêu trong 1.5 s (vòng đỏ trên đất, thanh niệm trên HUD):
  - **Triệu Hồi** gọi thêm 2 Bóng Mực;
  - **Nhật Thực** hút 25 dầu của mọi đèn trong 14 m và đánh Mây nếu đứng trong 5 m.

  Bấm **Tỏa Sáng** trúng nó lúc đang niệm để **ngắt chiêu**. Làm nó choáng rồi **Diệt Bóng** để trừ 1 máu. Chơi đúng luật v1.0.0 (không Diệt Bóng, không boss): thêm `?noextras` vào URL.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 (tổng +15 nếu nó đang hút dầu) |
| Bình minh (khi thắng): mỗi đèn đang sáng · mỗi Ngọn Lửa | +50 + floor(dầu) · +50 |
| Diệt một Bóng Mực · boss trúng đòn · hạ boss (chỉ khi bật extras) | +20 · +50 · +300 |

Tổng điểm = tổng điểm các Đêm đã thắng. Sau màn **Bình Minh** (thắng Đêm 3) hoặc khi thua, nhập tên (3–12 ký tự, chữ có dấu được) để lưu vào **Bảng xếp hạng** top 10 (menu chính). Mọi con số: [game.contract.json](game.contract.json).

## Kiểm chứng, headless, bench, soak

```bash
npm test                                                    # 69 case (Phase 1–4), mỗi case chạy CLI headless thật
node src/headless.js --seed 1 --night 1 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
node scripts/bench.js --seed 42 --duration 30 --out bench.json   # bench_cmd: cửa sổ Chrome 1280×720, vsync tắt
node scripts/soak.js  --seed 7 --nights 10 --out soak.json       # soak_cmd: 10 Đêm trong một tiến trình
npm start -- --export-leaderboard out.json                  # xuất bảng xếp hạng {"entries": [...]}
npm run proof -- 4                                          # bảng truy vết yêu cầu → docs/proof/phase-4/results.md
```

| Kết quả tự đo (máy tham khảo) | Giá trị | Ngưỡng ticket |
|---|---|---|
| [bench.json](bench.json): avg / 1 % low / p95 / load | 123.1 FPS / 36.0 FPS / 12.1 ms / 1747 ms | ≥ 60 / ≥ 30 / — / ≤ 10000 |
| [soak.json](soak.json): crashes, RSS đầu → cuối | 0, 41.6 → 43.3 MB | 0, ≤ 1.2 × |
| Headless 21.600 tick (một Đêm đầy đủ) | ~0.5 s | ≤ 30 s |

Ghi chú bench: vsync tắt bằng `--disable-gpu-vsync --disable-frame-rate-limit`. `peak_mem_mb` là RSS của cả cây tiến trình Chrome. Bench mặc định mở cửa sổ thật; `--headless` chỉ dùng cho CI, không dùng để chấm. Ghi chú soak: script tự chạy lại chính nó với cấu hình bộ nhớ V8 cố định (`--max-semi-space-size=1 --no-opt --no-maglev`), để RSS không bị phần khởi động của V8 làm lệch; `heap_used_*` trong soak.json cho thấy heap JS không tăng.

## Cấu trúc

```
game.contract.json  Test Contract v1.3 (tuning, headless_cmd, bench_cmd, soak_cmd)
src/sim/            luật game tất định (game.js), bản đồ (maps.js), cảnh bench (bench.js), IO contract
src/headless.js     CLI headless · src/leaderboard*.js  bảng xếp hạng (lưu data/leaderboard.json)
server.js           server tĩnh + API bảng xếp hạng/cửa hàng + --export-leaderboard; phục vụ /sw.js, /manifest.webmanifest (PWA)
web/                client Three.js: render, HUD, menu, âm thanh WebAudio, cài đặt, điều khiển cảm ứng, PWA — không chứa luật
android-app/        app Android (Capacitor): copy-web.js chép client vào www/, project Gradle ở android/
scripts/            bench, soak, proof, bot, ảnh chụp và đo FPS qua Chrome DevTools protocol
tests/              case Phase 1–4, cửa hàng, extras (Diệt Bóng + boss) + scenario
docs/spec/ docs/adr/ docs/notes/ docs/proof/   spec + tiêu chí nghiệm thu, ADR, giả định + nhật ký AI + retro, bằng chứng từng phase
docs/lab/           đề bài và quy định của lab
AGENTS.md, CLAUDE.md, .claude/    harness AI (hook chặn khi test đỏ, skill verify)
CHANGELOG.md CREDITS.md LICENSE Dockerfile
```

## Sáng tạo của tôi

Toàn bộ nằm ở `web/`. Headless không import `web/`, nên đầu ra contract không đổi (69/69 case đạt). Trong cảnh bench, cây và đá trang trí bị tắt.

- **Ông Đăng** dẫn chuyện ở màn giới thiệu mỗi Đêm. Nhạc nền và mọi hiệu ứng âm thanh được **tổng hợp bằng WebAudio**, không dùng file.
- Hạt tiến độ trên đèn, vòng sáng đúng bằng bán kính vùng an toàn, đèn lồng nhỏ trên nón Mây sáng theo số đom đóm, khăn đỏ bay theo tốc độ.
- **Làng trên đảo** (nhánh `feature/shop-scenery`): nhà tranh và nhà sàn có cửa sổ sáng, sân có chum, đống rơm, bụi hoa, đèn đá; cổng làng, giếng, cây bàng, hàng cau; đường đá dẫn tới từng đèn; đèn trời bay lên quanh đảo. Nhà và đồ vật chặn Mây như cây/đá (chỉ ở client). Vẽ bằng instancing theo từng bộ phận.
- **Cửa hàng phụ kiện**: 18 món ở 4 ô (5 kiểu nón: nón lá, mũ rơm, nón quai thao, khăn vấn, mũ gấm), xem trước trên Mây bằng camera xoay quanh nhân vật.
- Bóng Mực trồi lên khi mới sinh, xẹp khi bị choáng, nghiêng về phía đèn khi hút dầu. Gió Lạc là dải lụa uốn lượn, phình to khi giữ đồ cướp được. Đom đóm rơi nhấp nháy trước khi biến mất. Chuông trên tháp đung đưa.
