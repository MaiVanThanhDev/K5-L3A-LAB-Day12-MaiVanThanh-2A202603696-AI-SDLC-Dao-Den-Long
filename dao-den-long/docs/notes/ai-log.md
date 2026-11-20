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
