# Nhật ký dùng AI

Công cụ: **Claude Code** (VS Code extension), model Claude Opus 5.5. Harness: `AGENTS.md` / `CLAUDE.md`, hook `.claude/settings.json` (chạy test sau khi sửa `src/` và `tests/`, chặn kết thúc khi test đỏ), skill `.claude/skills/verify`.

## Phase 1

| Bước | Lời nhắc / việc | Kết quả |
|---|---|---|
| 1 | "đọc file và tổng hợp": tóm tắt 6 file tài liệu lab | Nắm lịch 4 giờ, rubric, quy định |
| 2 | "đọc cả file và link rồi làm theo yêu cầu": đọc lab board (PRD-0 + Test Contract v1.0) | Chọn Node.js + Three.js; tách lõi `src/sim` (tất định) khỏi `web/` |
| 3 | Viết lõi sim + CLI headless, chạy thử với scenario/inputs mẫu trong contract | Nhặt mote ở tick 38 = tính tay (3.8 m ÷ 0.1 m/tick); tất định; JSON hỏng → mã thoát 2 |
| 4 | Viết 21 case kiểm chứng gọi CLI thật | Lần đầu 19/21. 2 case sai là **lỗi của test do AI viết** (xem dưới), sửa xong 21/21 |
| 5 | Client 3D, chụp ảnh bằng Chrome headless và tự mở ảnh xem | HUD, đèn, vòng an toàn, Bóng Mực hiển thị đúng |
| 6 | Harness: hook test-gate (thử với test đỏ tạm thời → exit 2, chặn đúng), skill verify, CI | |

### Lỗi của AI và cách phát hiện

1. **Test đọc snapshot không tồn tại** (G2): đọc tick 5 trong khi `--snapshot-every` mặc định là 10. Phát hiện nhờ test đỏ (`undefined.player`). Sửa test, không sửa game.
2. **Kỳ vọng sai trong test G14**: AI giả định có Bóng Mực thứ 2 ở tick 1500, nhưng người chơi đứng yên đã bị bắt chết ở tick 1080, nên game kết thúc trước. Game đúng, test sai. Sửa: cho người chơi đứng trong vùng an toàn của một đèn đã thắp.
3. **Map phím trái/phải**: ở yaw = 0 camera nhìn theo +Z, nên bên phải màn hình là −X. Nếu map D → x = +1 thì đi ngược. Kiểm tra bằng tích có hướng, map D → x = −1. Ghi vào comment trong `web/main.js`.
4. Code client ban đầu có dòng thừa `keys.has('KeyE') && false` (E đã dùng để xoay camera). Phát hiện khi đọc lại diff, đã xóa.

Điều chỉnh harness: AGENTS.md ghi rõ "giá trị kỳ vọng lấy từ TUNING hoặc tính tay, không copy output của game" (tránh test luôn đạt), và "web/ không chứa luật".

### Đánh giá Phase 1

- **Đạt:** toàn bộ bàn giao của PRD-0. 21/21 case contract và gameplay; bot thắng trọn Đêm 1 ở 3 seed, phát lại qua headless khớp từng tick; clone sạch → `npm install` → `npm test` xanh.
- **Chưa có:** video hoặc ghi hình chơi tay (để Phase 4); âm thanh.
- **Quan sát:** bot thắng trong khoảng 56–64 s mà không bị chạm lần nào, vì Bóng Mực xuất hiện chậm (tick 300, rồi cứ 20 s một con). Có thể game hơi dễ. Chưa chỉnh vì PRD không đặt độ khó; ticket sau có thể quy định số liệu.
- **Harness cần chỉnh:** chưa thấy agent lặp lỗi. Nếu ticket đổi contract thì cập nhật AGENTS.md (phiên bản contract) và chạy lại toàn bộ case.

### Token / chi phí (ước tính)

- Phase 1: khoảng **350k token input (phần lớn là ngữ cảnh được cache) + 45k token output** trong một phiên Claude Code. Con số chính xác xem bằng `/cost` hoặc trên trang usage.
- Cách tiết kiệm: đọc lab board một lần rồi lưu text; chỉ trích đoạn contract cần thiết thay vì cả HTML (180 KB); test và proof dùng chung một file case (không viết hai lần); kiểm chứng bằng CLI ngay từ đầu nên ít vòng sửa.

## Phase 2

| Bước | Lời nhắc / việc | Kết quả |
|---|---|---|
| 1 | "commit lên nhưng không mở được folder dao-den-long" | `dao-den-long/` có `.git` riêng nên bị commit thành gitlink (mode 160000). Chuyển `.git` con ra bản sao lưu, add lại file thật. |
| 2 | Gửi link Phase 1 kèm "làm tiếp phase 2" | Trang đó chỉ có PRD-0 + contract v1.0. AI **không bịa** yêu cầu Phase 2 mà hỏi lại Ticket-02. |
| 3 | Dán Ticket-02 | Đọc lại contract v1.0 gốc để giữ tương thích. Tách bản đồ ra `src/sim/maps.js`, viết lại `step()` theo đúng 12 bước của ticket, đưa mọi số vào `game.contract.json`. |
| 4 | Chạy lại 21 case Phase 1 với số chuẩn | 19/21 → sửa → 21/21. Mỗi case đổi đều có lý do (assumptions.md, bảng "Case Phase 1 bị luật mới làm thay đổi"). |
| 5 | Viết 28 case Phase 2, kỳ vọng tính tay | 25/28 lần đầu. Cả 3 case đỏ đều là **lỗi của test** (xem dưới). |
| 6 | Client: menu, 3 Đêm, pause, cài đặt, âm thanh, HUD, bảng màu | Ảnh chụp bằng Chrome qua DevTools protocol (GPU thật). Mở từng ảnh xem: phát hiện lưới phím điều khiển trên menu bị vỡ và đồng hồ nhấp nháy bị chụp đúng lúc tắt, đã sửa. |
| 7 | Đo FPS | SwiftShader cho 1–2 FPS (CPU, không đại diện). Viết `scripts/fps-bench.js` dùng GPU + ép viewport 1280×720: khoảng 58 FPS cả 3 Đêm. |
| 8 | Bot e2e cho 3 Đêm | Bot tham lam **không thắng** với số chuẩn (xem đánh giá). Phát lại input của bot qua CLI khớp từng tick. |

### Lỗi của AI và cách phát hiện

1. **Lỗi luật thật (G12)**: Bóng Mực được scenario đặt sẵn trong vùng sáng thì đi lại tự do trong đó, vì code chỉ chặn bóng *từ ngoài đi vào*. Test đỏ phát hiện. Sửa luật: mọi bóng ở trong vùng sáng đều bị đẩy ra trong 30 tick (giả định B8).
2. **Lệch 1 tick ở bất tử (G7)**: AI kỳ vọng snapshot tick 90 đã hết bất tử. Thật ra hit ở bước 0 đặt bộ đếm 90, nên tick 1…90 đều bất tử. Sau đó lại thấy cờ bật ở tick 91 vì có **lần chạm mới hợp lệ**. Tách phép kiểm tra ra scenario không có Bóng Mực.
3. **Kỳ vọng sai hướng (P6)**: AI cho rằng sau khi lướt trên không thì Mây rơi xuống. Nhưng vận tốc dọc lúc đó vẫn đang đi lên và chỉ bị đóng băng, nên Mây tiếp tục bay lên. Debug bằng snapshot từng tick rồi sửa test (luật đúng theo B10).
4. **Chạy thiếu tick (P8)** và **người chơi chết trước khi đo (P16)**: thiết kế test sai, game đúng.
5. Python ghi file trên Windows đổi LF → CRLF. `.gitattributes` chuẩn hóa lại khi commit, không ảnh hưởng.

Điều chỉnh harness: AGENTS.md ghi rõ 12 bước/tick, `tick` khác `sim_tick`, quy ước góc của bản đồ, "kỳ vọng tính tay phải ghi phép tính trong comment", "không đo FPS bằng SwiftShader". Skill verify thêm bước chụp ảnh và đo FPS qua CDP, và nhắc mô hình tick.

### Đánh giá Phase 2

- **Đạt:** 49/49 case (21 regression + 28 mới, mỗi tính năng mới ≥ 1 scenario). Contract v1.1 đủ trường, sự kiện và trạng thái. 21.600 tick chạy trong khoảng 0.5 s mỗi Đêm. Client khoảng 58 FPS ở 1280×720. Spec có AC cho từng mục Phần 3.
- **Chưa đạt / rủi ro:** bot tham lam không thắng được Đêm nào với số chuẩn: tốt nhất Đêm 1 thắp 4/5, Đêm 2 4/6, Đêm 3 1/7 (Bóng Mực 4–4.5 m/s, tới 10 con, phát hiện 12 m). Vì vậy **chưa có bằng chứng tự động rằng 3 Đêm thắng được từ đầu tới cuối mà không dựng scenario**. Đường thắng được chứng minh từng phần qua scenario (G11, P25, màn Bình Minh). Âm thanh và cài đặt chỉ kiểm tra bằng code và chơi thử, chưa ghi hình.
- **Harness cần chỉnh:** cần một bot tốt hơn (tránh bóng theo vùng an toàn, đi đường nhiều tầng) hoặc ghi hình chơi tay ở Phase 4.
