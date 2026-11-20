# Bằng chứng Phase 1 — kết quả tự động

> Sinh bởi `npm run proof` (không sửa tay). Mỗi dòng chạy **CLI headless thật** (`node src/headless.js …`) và kiểm tra JSONL đầu ra.
> Cùng các case này chạy trong `npm test` và CI. Commit lúc sinh: `62f4039` · Node v26.13.1 · Windows_NT 10.0.19045 · Intel(R) Core(TM) i5-8265U CPU @ 1.60GHz

**Tổng: 21/21 case đạt.**

| ID | Yêu cầu | Kết quả | Quan sát thực tế |
|---|---|---|---|
| C1 | Contract E: snapshot tick 0, mỗi --snapshot-every tick, đủ trường; dòng cuối là end | ✅ PASS | snapshots ở tick 0,5,10,15,20,25; end={"type":"end","ticks":25,"state":"playing","score":0} |
| C2 | Contract E: tất định — cùng seed/scenario/inputs cho output giống hệt (kể cả id tự sinh) | ✅ PASS | seed 42 ×2: 101933 byte giống hệt; seed 43 khác (đúng) |
| C3 | Contract B: inputs/scenario sai định dạng → mã thoát 2 + stderr; thiếu tham số → mã ≠ 0 | ✅ PASS | tick trùng=2, JSON hỏng=2, move ngoài [-1,1]=2, shade thiếu pos=2, thiếu tham số=1, night 2=1 |
| C4 | Contract C: move theo camera (công thức x',z'), chuẩn hóa vector > 1, player_speed | ✅ PASS | 60 tick tiến → z=6; yaw 90° → x=6; chéo → \|v\|=6.001; trường vắng giữ giá trị |
| C5 | Contract B: tick model — sự kiện bước k ghi tick=k+1; --ticks N chạy đúng N bước | ✅ PASS | mote nhặt ở bước 0 → event tick=1; snapshot 0 chưa nhặt; end.ticks=7 |
| G1 | Nhặt đom đóm trong pickup_radius (≤ r), cộng per_mote | ✅ PASS | mote ở 1.2 m được nhặt, ở 1.3 m không; score=10 |
| G2 | Mang tối đa carry_capacity đom đóm | ✅ PASS | 12 mote dưới chân → carried=10, còn lại 2 |
| G3 | Interact trong interact_radius nạp đom đóm; đủ lantern_cost thì thắp (deposit + lantern_lit, +per_lantern) | ✅ PASS | deposit {"lantern_id":"L1","amount":5,"deposited":5} @tick 3, lantern_lit L1, score=100 |
| G4 | Nạp một phần thì chưa thắp; ngoài interact_radius không nạp; giữ nút không nạp lặp (chỉ cạnh false→true) | ✅ PASS | carried 3 → deposited 3, chưa thắp; đứng xa 0.1 m ngoài bán kính → không nạp |
| G5 | Tỏa sáng: tốn pulse_cost, choáng Bóng Mực trong pulse_radius pulse_stun_s giây, đẩy pulse_push_m, +per_stun | ✅ PASS | pulse stunned [S1] (S9 ngoài bán kính); S1 đẩy tới x=10, đứng yên 180 tick; carried 3→1 |
| G6 | Tỏa sáng cần đủ ánh sáng và có hồi chiêu pulse_cooldown_s | ✅ PASS | thiếu ánh sáng → không pulse; bấm lại ở tick 59 bị chặn, tick 61 được (event tick 62) |
| G7 | Bóng Mực chạm (≤ shade_hit_radius) → mất 1 lửa, rơi hit_drop_ratio đom đóm, bất tử invuln_s | ✅ PASS | hit tick 1 (flames 2, dropped 2); hit tiếp theo đúng sau 90 tick bất tử |
| G8 | Đom đóm đánh rơi nằm lại trên đảo và nhặt lại được | ✅ PASS | rơi 2 mote ở vòng 2.5 m quanh người chơi: [[-1.791,0,-1.745],[1.791,0,1.745]] |
| G9 | Thua khi hết lửa: game_over lost/no_flames, dừng sớm, end.state=lost | ✅ PASS | game_over tick 1, end={"type":"end","ticks":1,"state":"lost","score":0} |
| G10 | Thua khi trời sáng (hết giờ): game_over lost/dawn | ✅ PASS | time_left_s=1 → game_over dawn ở tick 60 |
| G11 | Thắng khi thắp hết đèn (all_lit); điểm thưởng thời gian + lửa; đèn đặt sẵn không được điểm | ✅ PASS | won ở tick 1, score=448 (= 100 + 2×99 + 50×3) |
| G12 | Bóng Mực sợ đèn: không vào trong safe_radius của đèn đã thắp | ✅ PASS | 600 tick đứng cạnh đèn đã thắp: khoảng cách nhỏ nhất Bóng Mực–đèn = 5.000 m ≥ 5; không bị chạm |
| G13 | Bóng Mực đuổi người chơi với shade_speed | ✅ PASS | sau 1 s Bóng Mực tiến 3.500 m về phía người chơi |
| G14 | Bóng Mực tự xuất hiện (shade_spawned, id tự sinh) và đom đóm rải rác khi không có scenario | ✅ PASS | 30 mote lúc đầu; shade_spawned: S1@300, S2@1500, S3@2700 |
| G15 | Nhảy: rời mặt đất rồi rơi về Y=0; không ảnh hưởng đầu ra khác | ✅ PASS | độ cao theo snapshot: 0, 0.5, 0.861, 1.083, 1.167, 1.111, 0.917, 0.583, 0.111, 0, 0, 0, 0 |
| G16 | Dựng scenario không phát sự kiện, không cộng điểm; ra khỏi đảo bị chặn (fall_enabled=false) | ✅ PASS | ticks 0: không event, score 0; chạy 10 s ra mép → dừng ở bán kính 40 m, không có player_hit fall |

## Tính tất định (chạy dài)

Lệnh (chạy 2 lần): `node src/headless.js --seed 42 --night 1 --inputs <inputs> --ticks 3600 --out out/seed42-runN.jsonl`

- out/seed42-run1.jsonl và out/seed42-run2.jsonl: **giống hệt từng byte ✅** (157 dòng, dòng cuối `{"type":"end","ticks":1473,"state":"lost","score":20}`)
