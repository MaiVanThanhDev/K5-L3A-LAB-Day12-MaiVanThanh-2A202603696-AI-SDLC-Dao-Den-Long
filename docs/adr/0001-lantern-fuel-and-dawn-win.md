# ADR 0001: Đèn có nhiên liệu, Bóng Mực hút dầu, thắng ở bình minh

- **Trạng thái:** Đã chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", contract v1.2)
- **Thay thế:** luật "đèn đã sáng là sáng mãi", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi mọi đèn sáng" (Phase 1–2)

## Bối cảnh

Theo playtest, người chơi giỏi thắp hết đèn trong khoảng 2 phút và Đêm kết thúc sớm. Ticket-03 đổi mục tiêu thành "giữ đảo sáng tới bình minh". Đèn có thể tắt, Bóng Mực tấn công đèn yếu, và thắng chỉ được xét ở tick cuối.

## Quyết định

### 1. Mô hình trạng thái đèn

Trước đây đèn chỉ có `lit: bool` cùng `deposited`, và `lit` không bao giờ quay về `false`. Giờ đèn là một máy trạng thái hai trạng thái, kèm bộ nhớ:

```
                 nạp đủ (10 lần đầu / 5 nếu ever_lit)
   ┌────────┐  ─────────────────────────────────────▶  ┌──────────────────────┐
   │  TẮT   │                                          │  SÁNG (fuel 0–100)   │
   │ fuel 0 │  ◀─────────────────────────────────────  │  zone khi fuel ≥ 30  │
   └────────┘        fuel ≤ 0 (ngay sau bước 2)        └──────────────────────┘
                     → deposited = 0, lantern_out          ▲   │ châm dầu (refuel)
                                                           └───┘
```

| Trường | Ý nghĩa | Ghi chú triển khai |
|---|---|---|
| `lit` | đang sáng | |
| `fuel` | 0–100, chỉ có nghĩa khi sáng | lưu bằng **số nguyên đơn vị 1/60** (`FU`), 100 = 6000 FU; hao 1 FU/tick, mỗi con hút 5 FU/tick, 1 đom đóm = 600 FU. Chỉ làm tròn (1 chữ số) khi xuất snapshot/event. Không có sai số số thực: đèn đầy tắt đúng tick 6000 (case F2). |
| `deposited` | tiến độ thắp khi đang tắt | về 0 khi tắt |
| `everLit` | đã từng sáng | quyết định giá thắp (10 hay 5) và điểm (+100 hay +40) |
| `relitCount` | số lần thắp lại | chỉ để xuất snapshot |

**Vùng an toàn** không còn là thuộc tính của "đèn sáng" mà là hàm `hasZone(L) = L.lit && L.fuel ≥ 30 FU·60`. Mọi chỗ trước đây hỏi `L.lit` để chặn Bóng Mực (di chuyển, đẩy lùi, điểm sinh, đẩy ra khỏi vùng) đều được đổi sang `hasZone`. Như vậy luật "fuel < 30 mất vùng" được áp dụng ở **một chỗ duy nhất**.

**Tương tác** chọn trong tập "đèn nhận được" (`!lit || fuel < max`), gần nhất, hòa thì id nhỏ. Hai nhánh: nạp (đèn tắt) hoặc châm dầu (đèn sáng). Châm dầu lên ≥ 30 thì gọi lại cơ chế "đẩy ra khỏi vùng trong 30 tick" của Ticket-02, không viết cơ chế mới.

### 2. Trạng thái `drain` của Bóng Mực

Thêm `drain` vào máy trạng thái hiện có. Bóng Mực mang thêm `drainId` (đèn đang hút) và `targetId` (đèn đích do scenario chỉ định):

```
 spawning ─▶ wander ──(Mây ≤ 12 m)──▶ chase ──(> 18 m)──▶ wander
               │  ▲                                    
  (đèn yếu ≤ 2 m)│  │(đèn tắt / fuel ≥ 30 / > 2 m)       stunned ─(hết choáng)─▶ wander
               ▼  │                                        ▲
              drain ──(Mây ≤ 6 m)──▶ chase                 │ (Tỏa Sáng trúng ở bất kỳ trạng thái nào)
```

- Đích của `wander`: đèn đích của scenario (nếu yếu hoặc tắt), nếu không thì đèn sáng yếu gần nhất, nếu không nữa thì đèn tắt gần nhất (`wanderTarget()`). Không có đích nào thì lượn ngẫu nhiên như Phase 2.
- Lượng dầu bị hút được trừ ở **bước 2** theo trạng thái lúc đầu tick, xét các con theo id tăng dần. Đèn có fuel ≤ 0 tắt **ngay sau bước 2**, trước khi Mây kịp châm ở bước 5. Đây đúng là thứ tự ticket bắt buộc.

### 3. Luật thắng

`step()` bước 11 được viết lại. Hết Ngọn Lửa luôn thua (`no_flames`) trước tiên. Ở tick bình minh (`sim_tick ≥ dawnTick`): số đèn đang sáng ≥ `ceil(win_ratio × tổng)` thì thắng `dawn_survived`, ngược lại thua `dawn`. Bỏ hẳn nhánh `all_lit`. Điểm bình minh chỉ cộng khi thắng.

### 4. Số liệu

Mọi số mới nằm trong `game.contract.json` (`fuel_*`, `relight_cost`, `win_ratio`, `drain_*`, `low_fuel_threshold`, `capacity_*`, bảng `score` mới). Sức chứa là một getter `capacity = min(20, 10 + 2 × successfulLights)`, không lưu riêng.

## Các phương án đã cân nhắc

| Phương án | Vì sao không chọn |
|---|---|
| Lưu fuel bằng số thực, so sánh có epsilon | Ticket khuyến nghị đơn vị nguyên 1/60. Số thực làm lệch tick tắt đèn và lệch ngưỡng 30 khi cộng dồn hao và hút. |
| Thêm trạng thái `dim` (fuel < 30) cho đèn | Ticket chỉ định nghĩa sáng/tắt. `dim` là hàm của fuel nên tính ra (`hasZone`) thay vì lưu, tránh hai nguồn sự thật. |
| Viết cơ chế đẩy riêng cho "châm dầu lên ≥ 30" | Ticket nói "giống khi đèn vừa thắp", nên dùng lại đúng cơ chế đó để hai trường hợp không lệch nhau. |
| Giữ `all_lit` làm lý do kết thúc phụ | Ticket bỏ thắng sớm và bỏ `all_lit`. Giữ lại sẽ làm sai contract v1.2. |

## Hệ quả

- Các test Phase 1–2 dựa trên luật bị thay đã được sửa, có ghi lý do (xem [CHANGELOG.md](../../CHANGELOG.md) và [docs/notes/assumptions.md](../notes/assumptions.md) mục C). Không case nào bị skip.
- Bóng Mực ở trạng thái wander giờ tụ về đèn tắt và đứng canh ở đó. Thắp lại một đèn đã tắt trở nên nguy hiểm hơn hẳn (đúng ý ticket). Bot e2e tham lam hiện sống tới bình minh ở Đêm 1 nhưng chỉ giữ được 2/5 đèn.
- Client dùng chung `hasZone`, `capacity`, `winNeed` từ lõi, nên HUD và vòng an toàn không tự tính lại luật.
