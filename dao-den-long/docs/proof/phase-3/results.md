# Bằng chứng Phase 3 — kết quả tự động

> Sinh bởi `npm run proof` (không sửa tay). Mỗi dòng chạy **CLI headless thật** (`node src/headless.js …`) và kiểm tra JSONL đầu ra.
> Cùng các case này chạy trong `npm test` và CI. Commit lúc sinh: `4e967b1` · Node v26.13.1 · Windows_NT 10.0.19045 · Intel(R) Core(TM) i5-8265U CPU @ 1.60GHz

**Tổng: 62/62 case đạt.**

| ID | Yêu cầu | Kết quả | Quan sát thực tế |
|---|---|---|---|
| C1 | Contract E: snapshot tick 0, mỗi --snapshot-every tick, đủ trường; dòng cuối là end | ✅ PASS | snapshots ở tick 0,5,10,15,20,25; end={"type":"end","ticks":25,"state":"playing","score":0} |
| C2 | Contract E: tất định — cùng seed/scenario/inputs cho output giống hệt (kể cả id tự sinh) | ✅ PASS | seed 42 ×2: 412368 byte giống hệt; seed 43 khác (đúng) |
| C3 | Contract B: inputs/scenario sai định dạng → mã thoát 2 + stderr; thiếu tham số → mã ≠ 0 | ✅ PASS | tick trùng=2, JSON hỏng=2, move ngoài [-1,1]=2, shade thiếu pos=2, thiếu tham số=1, night 4=1 (v1.1: night 2, 3 hợp lệ) |
| C4 | Contract C: move theo camera (công thức x',z'), chuẩn hóa vector > 1, player_speed | ✅ PASS | 60 tick tiến → z=6; yaw 90° → x=6; chéo → \|v\|=6.001; trường vắng giữ giá trị |
| C5 | Contract B: tick model — sự kiện bước k ghi tick=k+1; --ticks N chạy đúng N bước | ✅ PASS | mote nhặt ở bước 0 → event tick=1; snapshot 0 chưa nhặt; end.ticks=7 |
| G1 | Nhặt đom đóm trong pickup_radius (≤ r); v1.1: nhặt không cộng điểm | ✅ PASS | mote ở 1 m được nhặt, ở 1.1 m không; nhặt không cộng điểm (v1.1: điểm khi nạp) |
| G2 | Mang tối đa carry_capacity đom đóm | ✅ PASS | 12 mote dưới chân → carried=10, còn lại 2 |
| G3 | Interact trong interact_radius nạp đom đóm; đủ lantern_cost thì thắp (deposit + lantern_lit, +per_lantern, +per_mote mỗi con nạp) | ✅ PASS | deposit {"lantern_id":"L1","amount":10,"deposited":10} @tick 3, lantern_lit L1, score=150 |
| G4 | Nạp một phần thì chưa thắp; ngoài interact_radius không nạp; giữ nút không nạp lặp (chỉ cạnh false→true) | ✅ PASS | carried 3 → deposited 3, chưa thắp; đứng xa 0.1 m ngoài bán kính → không nạp |
| G5 | Tỏa sáng: tốn pulse_cost, choáng Bóng Mực trong pulse_radius (3D từ chân+0.8 m) pulse_stun_s giây, đẩy pulse_push_m trong 15 tick, +per_stun | ✅ PASS | pulse stunned [S1] (S9 ngoài bán kính); S1 x: 4.5 → 4.767 (tick 1) → 8.5 (tick 15), choáng 120 tick; carried 4→1 |
| G6 | Tỏa sáng cần đủ ánh sáng và có hồi chiêu pulse_cooldown_s | ✅ PASS | thiếu ánh sáng → không pulse; bấm lại ở tick 179 bị chặn, tick 181 được (event tick 182) |
| G7 | Bóng Mực chạm (≤ shade_hit_radius) → mất 1 lửa, rơi hit_drop_ratio đom đóm, bất tử invuln_s, bóng chuyển recoil | ✅ PASS | hit tick 1 (flames 2, dropped 2); bất tử tick 1…90; S1 recoil |
| G8 | Đom đóm đánh rơi nằm lại trên đảo (vành 1.5–2.5 m, sống 480 tick) và nhặt lại được | ✅ PASS | rơi 2 mote ở khoảng cách 1.50, 2.48 m, kind dropped, ttl 8 s |
| G9 | Thua khi hết lửa: game_over lost/no_flames, dừng sớm, end.state=lost | ✅ PASS | game_over tick 1, end={"type":"end","ticks":1,"state":"lost","score":0} |
| G10 | Thua khi trời sáng (hết giờ): game_over lost/dawn | ✅ PASS | time_left_s=1 → game_over dawn ở tick 60 |
| G11 | v1.2: thắp hết đèn không kết thúc Đêm; thắng ở bình minh (dawn_survived) với điểm 50 + floor(fuel) mỗi đèn sáng + 50 mỗi lửa; đèn đặt sẵn không được điểm thắp | ✅ PASS | 5/5 đèn sáng 30 tick vẫn playing; 3/5 sáng tới bình minh → won dawn_survived tick 60, điểm 597 (= 3×(50+99) + 150) |
| G12 | Bóng Mực sợ đèn: không vào trong safe_radius của đèn đã thắp | ✅ PASS | S1 đặt trong vùng sáng bị đẩy ra trong 30 tick; từ đó tới tick 600 khoảng cách nhỏ nhất Bóng Mực–đèn = 6.000 m ≥ 6; không bị chạm |
| G13 | Bóng Mực đuổi người chơi với shade_speed | ✅ PASS | sau 1 s Bóng Mực tiến 4.000 m về phía người chơi |
| G14 | Bóng Mực tự xuất hiện (shade_spawned, id tự sinh) và đom đóm rải rác khi không có scenario | ✅ PASS | 20 mote lúc đầu; shade_spawned: S1@300, S2@300, S3@780, S4@1260, S5@1740, S6@2220 (tối đa 6) |
| G15 | Nhảy: rời mặt đất rồi rơi về Y=0; không ảnh hưởng đầu ra khác | ✅ PASS | độ cao theo snapshot: 0, 0.5, 0.861, 1.083, 1.167, 1.111, 0.917, 0.583, 0.111, 0, 0, 0, 0 |
| G16 | Dựng scenario không phát sự kiện, không cộng điểm | ✅ PASS | ticks 0: không event, score 0 (đèn đặt sẵn lit không được điểm) |
| P1 | Phần 1/4: tuning khớp số chuẩn của ticket (v1.2: thời lượng 240/270/300, điểm mới), có khóa dash_* và night2/3_duration_s | ✅ PASS | 27 khóa tuning + score khớp bảng số chuẩn |
| P2 | Phần 2/4: --night 1|2|3; snapshot có night, wind, player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}, motes/drifters/charms; đèn, thời lượng, 20 đom đóm ở 20 điểm chuẩn khác nhau | ✅ PASS | Đêm 1: 5 đèn, 240 s, 0 bùa; Đêm 2: 6 đèn, 270 s, 1 bùa; Đêm 3: 7 đèn, 300 s, 2 bùa |
| P3 | Phần 1: đom đóm sinh thêm 1 tại tick 240, 480… ở điểm trống; hết điểm trống thì bỏ lượt | ✅ PASS | số đom đóm theo tick 0/240/480/960/1200: 20/21/22/24/24; mote mới M21 ở [23.335,0,-23.335] (điểm chuẩn, trước đó trống) |
| P4 | Phần 1: chạy 6 m/s đạt tốc độ ngay (≤ 0.1 s) và dừng ngay; nhảy 7 m/s, g −20, chỉ nhảy khi chạm đất | ✅ PASS | vel tick 1 = [0,0,6], thả phím → [0,0,0]; nhảy: đỉnh 1.167 m, bấm nhảy giữa không trung bị bỏ qua, chạm đất trước tick 43 |
| P5 | Lướt: 14 m/s trong 0.2 s (12 tick) theo hướng nhân vật quay mặt khi đứng yên; hồi chiêu 1.5 s từ lúc bắt đầu; event dash | ✅ PASS | dash event tick 1, vel 14, 12 tick → z=2.8; bấm lại ở tick 89 bị chặn, tick 90 được; khi đang chạy lướt theo hướng chạy |
| P6 | Lướt trên không giữ nguyên độ cao; không bất tử khi lướt | ✅ PASS | độ cao giữ 0.861 m từ tick 10 tới 22; lướt xuyên Bóng Mực vẫn bị chạm (tick 4) |
| P7 | Bùa Gió: nhặt như đom đóm → charm_picked {charm_id, charm_ticks:600}; chạy 7.2 m/s; xuất hiện lại sau 2700 tick | ✅ PASS | nhặt C1 tick 1, respawn_s 45, charm_s 10; 60 tick chạy được 7.200 m; bùa hết hiệu lực thì về 6 m/s |
| P8 | Bùa Gió: Lướt không hồi chiêu nhưng vẫn phải nhấn lại; nhấn khi đang lướt bị bỏ qua; vẫn 14 m/s trong 12 tick | ✅ PASS | dash ở tick 1, 13, 31 (bấm lúc đang lướt ở tick 5 bị bỏ qua); 3 lần × 2.8 m |
| P9 | Phần 1: nhặt khi XZ ≤ 1.0 m VÀ chênh cao chân Mây – mặt đất đặt đom đóm ≤ 1.5 m | ✅ PASS | mote cao 1.5 m được nhặt, mote cao 1.6 m không |
| P10 | Phần 1: nạp vào đèn gần nhất trong 2.0 m; bằng nhau thì id nhỏ hơn; v1.2: đèn sáng chưa đầy dầu nhận châm dầu | ✅ PASS | L1/L2 cách đều → L1; L5/L2 cách đều → L2; L1 đang sáng (99.98 dầu) ở 0.5 m → châm dầu 1 đom đóm thay vì nạp L3 |
| P11 | Vùng an toàn 6 m: bóng đang ở trong lúc đèn vừa thắp bị đẩy ra mép trong ≤ 30 tick, không gây sát thương lúc đó; sau đó bị chặn ở mép | ✅ PASS | S1 cách đèn 0.7 m lúc thắp → 3.35 m (tick 15) → 6.000 m (tick 30); 300 tick không bị chạm dù lúc đầu cách Mây 0.8 m |
| P12 | Tỏa Sáng: đo 3D từ chân+0.8 m (≤ 5 m); +5 mỗi bóng trúng kể cả đang choáng; pulse lại làm mới choáng; trùng vị trí đẩy +X; thiếu 3 đom đóm không kích hoạt | ✅ PASS | trúng [S1 (đúng 5 m 3D), S3 (đang choáng)], trượt S2 (5.01 m); +10 điểm; S3 trùng XZ bị đẩy +X 4 m, choáng làm mới còn 120 tick; carried 2 → không pulse |
| P13 | Tỏa Sáng: đẩy lùi dừng khi gặp vật cản (mép đảo) | ✅ PASS | Bóng Mực ở x=38.5 bị đẩy tới x=39.833 (mép đảo 40 m) thay vì 42.5 |
| P14 | Bóng Mực: phát hiện 12 m / bỏ đuổi 18 m; tên trạng thái spawning, wander, chase, recoil, stunned | ✅ PASS | wander 12.5 m → wander, 11.9 m → chase; chase 17.9 m → chase, 18.1 m → wander; bóng mới sinh ở trạng thái spawning |
| P15 | Chạm: XZ ≤ 1 m và chênh cao ≤ 1.5 m; tối đa 1 lần mất lửa mỗi tick (xét id tăng dần); bóng gây hit lùi 2 m trong 60 tick | ✅ PASS | 2 bóng chạm cùng tick → 1 hit do S1 (id nhỏ hơn); S1 recoil tới x=-2.433 sau 60 tick; bóng dưới vách (chênh 3 m) không gây hit |
| P16 | Bị đánh: rơi floor(mang/2) đom đóm ra vành 1.5–2.5 m, tồn tại 480 tick; bất tử 90 tick | ✅ PASS | mang 7 → rơi 3, còn 4; ttl_ticks 3 → mất ở tick 3; TTL mặc định 480 tick (còn ở tick 479, mất ở tick 480) |
| P17 | Rơi khỏi đảo (Y < −10): 1 lần, −1 lửa, mất hết đom đóm (player_hit by fall + lost); chờ 60 tick rồi hồi sinh ở điểm xuất phát, bất tử 90 tick | ✅ PASS | rơi ở tick 64 (tính tay), lost 4; tick 124 hồi sinh tại (0,0,0), vel 0, bất tử; còn 1 lửa thì thua ngay (no_flames), không hồi sinh |
| P18 | Đêm 2: cầu tre x∈[26,44], z∈[−2,2] không lan can; bục nhảy bắn lên vy 14, 24 m/s về tâm đảo kia, giữ tới khi chạm đất (~1.4 s), phím di chuyển không ghi đè | ✅ PASS | đi bộ qua cầu 600 tick không rơi; bước ra mép cầu → rơi; bục (20,0,18) → đáp tick 84 tại [51.237,0,6.755] (đảo B), phím di chuyển không đổi quỹ đạo |
| P19 | Đêm 3: vách tầng không đi lên được; dốc 30°/150° lên tầng 1 (Y=3); bục (0,3,13) đáp lên tầng 2 (Y=6); tháp chuông r 2 m chặn | ✅ PASS | đi vào vách tầng 1 dừng ở z=12; dốc: Y=1.5 giữa dốc, Y=3 trên tầng 1; bục → [0,6,6.467] (tầng 2); tháp chặn ở z=2 |
| P20 | Đêm 3 gió mạnh: mỗi 30 s một cơn 5 s, hướng ngẫu nhiên, đẩy 2 m/s; snapshot wind {active, dir_deg}; wind_enabled:false tắt | ✅ PASS | gió bật tick 1800–2099, hướng 332°, đẩy Mây đứng yên đúng 10 m theo hướng đó; wind_enabled:false đứng yên; Đêm 1 không có gió |
| P21 | Gió Lạc: idle → chase khi mang ≥ 5 và cách ≤ 15 m; chạm XZ ≤ 1.2 m cướp min(3, mang) (drifter_steal); flee 240 tick rồi removed; bất tử không ngăn bị cướp | ✅ PASS | mang 6 → chase; cướp 3 ở tick 76 (tính tay 76), dù đang bất tử, không mất lửa; flee tới tick 315, removed tick 316; mang 4 → vẫn idle |
| P22 | Gió Lạc + Tỏa Sáng: trúng lúc chase → flee không cướp; trúng lúc flee có mang đồ → thả lại toàn bộ (drifter_drop), biến mất sau 120 tick | ✅ PASS | chase + pulse → flee, không cướp (carried 9−3 = 6); flee mang 3 + pulse → drifter_drop 3, 3 đom đóm rơi, removed ở tick 120 |
| P23 | Gió Lạc chỉ ở Đêm 2, 3: sinh tại tick 1200, 2400… (id D1, D2…), tối đa 2 | ✅ PASS | Đêm 2: D1 ở tick 1200, D2 ở tick 2400, tick 3600 không có D3 (đã đủ 2); Đêm 1 không có Gió Lạc |
| P24 | Tạm dừng: tick vẫn tăng nhưng sim_tick, thời gian, hồi chiêu, spawn đứng yên; snapshot state "paused"; event paused/resumed; nút khác bị bỏ qua | ✅ PASS | paused tick 11, resumed tick 31; tick 20: state paused, sim_tick 10, giờ và hồi chiêu đứng yên; Bóng Mực sinh ở tick 400 (= sim_tick 300 + 100 tick dừng); nhảy lúc dừng bị bỏ qua |
| P25 | v1.2 thắng/thua sau mọi cập nhật của tick: hết lửa luôn thua no_flames (kể cả tick bình minh); bình minh với ≥ 3/5 đèn sáng → thắng, 2/5 → thua dawn | ✅ PASS | lửa 0 + 5/5 đèn ở tick bình minh → lost/no_flames; 3/5 → won/dawn_survived; 2/5 → lost/dawn |
| P26 | Lịch sinh Bóng Mực Đêm 2 (mỗi 7 s, tối đa 8) và Đêm 3 (mỗi 6 s, tối đa 10), cách người chơi ≥ 15 m, tại điểm chuẩn; Đêm 3 tốc độ 4.5 m/s | ✅ PASS | Đêm 2: 300,300,720,1140; Đêm 3: 300,300,660,1020; mọi bóng mới ở điểm chuẩn, cách Mây ≥ 15 m; Đêm 3 bóng đi 4.5 m/s |
| P27 | Contract v1.1: tất định ở Đêm 2, 3; input dash/pause là boolean; scenario sai (state lạ, drifters không phải mảng) → mã 2 | ✅ PASS | Đêm 2, 3: 2 lần chạy giống hệt từng byte; 5 input/scenario sai → mã 2 |
| P28 | Chạy headless một Đêm đầy đủ (21.600 tick) xong trong ≤ 30 giây | ✅ PASS | 21.600 tick (đủ Bóng Mực, Gió Lạc, gió): Đêm 1: 0.83 s, Đêm 2: 1.23 s, Đêm 3: 1.93 s |
| F1 | Contract v1.2: contract_version 1.2, tuning fuel_max 100, fuel_decay_per_s 1, fuel_per_mote 10, relight_cost 5, win_ratio 0.6, drain_per_s 5, low_fuel_threshold 30, capacity_max 20; thời lượng 240/270/300 | ✅ PASS | 11 khóa đúng; đèn lit không ghi fuel → 100; đèn tắt fuel 0; player.capacity 10 |
| F2 | Hao dầu 1.0/giây khi sáng, tính bằng đơn vị nguyên 1/60 (100 → 0 đúng ở tick 6000); snapshot fuel 1 chữ số thập phân | ✅ PASS | fuel ở tick 60/600/3000/5970 = 99/90/50/0.5; lantern_out đúng tick 6000 (6000 FU × 1 FU/tick, không trôi số thực) |
| F3 | Hết dầu: đèn tắt, deposited = 0, lantern_out, ever_lit vẫn true; ánh sáng/đếm đèn giảm | ✅ PASS | fuel 0.5 → tắt ở tick 30 (tính tay), deposited 0, ever_lit true |
| F4 | Thắp lại: đèn ever_lit chỉ cần 5 đom đóm; lantern_lit {relight:true}; +5/đom đóm +40; relit_count +1; fuel = 100 | ✅ PASS | nạp 5 → thắp lại, fuel 100, relit_count 1, carried 7→2, điểm 65 (= 5×5 + 40) |
| F5 | Châm dầu: used = min(mang, ceil((100 − fuel)/10)), fuel = min(100, fuel + 10·used); event refuel {lantern_id, amount, fuel}; +5/đom đóm | ✅ PASS | fuel 25 + mang 10 → dùng 8, fuel 100, +40 điểm; fuel 40 + mang 3 → dùng 3, fuel 70.0 |
| F6 | Đèn fuel < 30 mất vùng an toàn; đúng 30 vẫn còn | ✅ PASS | tick 1–30 (fuel ≥ 30) Bóng Mực bị chặn ở 6 m; từ tick 31 (29.98) đi vào, chạm Mây ở tick 106 |
| F7 | Bóng Mực wander đi tới đèn sáng fuel < 30 gần nhất (ưu tiên hơn đèn tắt); không có thì về đèn tắt gần nhất | ✅ PASS | S1 bỏ qua L1 tắt (10 m), tiến 2 m/0.5 s về L2 yếu (22 m); không có đèn yếu → về đèn tắt L1 và đứng chờ cách 1 m, vẫn wander |
| F8 | drain: cách đèn yếu ≤ 2 m thì đứng yên hút 5 fuel/giây (cộng dồn nhiều con, đèn vẫn tự hao 1/giây); fuel_drain mỗi 60 tick | ✅ PASS | S1 vào drain ở tick 46, đứng yên; đèn mất 6.0/giây; fuel_drain cách nhau 60 tick; 2 con hút: 25 → 14.0 sau 60 tick (11 FU/tick) |
| F9 | Rời drain: Mây vào trong 6 m → chase; trúng Tỏa Sáng → stunned (+15 điểm); đèn tắt → wander | ✅ PASS | Mây 5.5 m → chase (6.1 m → vẫn drain); pulse → stunned, +15; đèn tắt ở tick 2 → wander |
| F10 | Châm dầu lên ≥ 30 khi có Bóng Mực trong 6 m: con đó về wander, bị đẩy ra mép trong ≤ 30 tick, không gây sát thương | ✅ PASS | refuel 2 → 39.9; S1 (đang drain, cách Mây 3 m) về wander, ra mép 6 m ở tick 30, không chạm Mây trong 120 tick |
| F11 | Luật thắng mới theo Đêm: bình minh cần ceil(0.6 × tổng đèn) đang sáng — Đêm 2 cần 4/6, Đêm 3 cần 5/7 | ✅ PASS | Đêm 1: 3/5 thắng, 2/5 thua; Đêm 2: 4/6 thắng, 3/6 thua; Đêm 3: 5/7 thắng, 4/7 thua |
| F12 | Sức chứa = 10 + 2 × successful_lights (tối đa 20); thắp lại cũng tính; đèn đặt sẵn không tính | ✅ PASS | thắp 1 đèn → 12; successful_lights 6 → 20 (trần); 2 đèn đặt sẵn → 10; sức chứa 12 → nhặt 12/14; thắp lại → 12 |
| F13 | Contract v1.2 scenario: fuel ngoài [0,100], drain thiếu target_lantern_id, target_lantern_id lạ, successful_lights âm → mã 2 | ✅ PASS | 5 scenario sai kiểu v1.2 → mã thoát 2 |

## Tính tất định (chạy dài)

Lệnh (chạy 2 lần): `node src/headless.js --seed 42 --night 1 --inputs <inputs> --ticks 3600 --out out/seed42-runN.jsonl`

- out/seed42-run1.jsonl và out/seed42-run2.jsonl: **giống hệt từng byte ✅** (199 dòng, dòng cuối `{"type":"end","ticks":1876,"state":"lost","score":0}`)
