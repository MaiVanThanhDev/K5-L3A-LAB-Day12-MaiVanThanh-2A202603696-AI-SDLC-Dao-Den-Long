# Retro: Đảo Đèn Lồng (4 phase, Day 12 AI SDLC)

Tác giả: Mai Văn Thành (2A202603696) · Công cụ: Claude Code (Opus 5.5) trong VS Code · Chi tiết từng bước: [ai-log.md](ai-log.md)

## 1. Tổng hợp Evaluation 4 phase

| Phase | Kết quả | Chưa đạt / rủi ro |
|---|---|---|
| 1. PRD-0, contract v1.0 | 21/21 case. Bot thắng Đêm 1 ở 3 seed (phát lại qua CLI khớp). | Game hơi dễ (bot thắng trong khoảng 60 s). Thư mục game có `.git` riêng nên GitHub không mở được, phát hiện muộn. Tag `phase-1` gắn trễ. |
| 2. Ba hòn đảo, v1.1 | 49/49 case (28 mới). 3 bản đồ, Lướt, Gió Lạc, Bùa Gió, pause, rơi khỏi đảo. Client khoảng 58 FPS. | Bot không thắng được Đêm nào với số chuẩn. Âm thanh chỉ kiểm tra bằng code. |
| 3. Đèn cạn dầu, v1.2 | 62/62 case (13 mới, 7 case cũ sửa có lý do). ADR, CHANGELOG breaking. Chế độ mù màu. | Bot sống tới bình minh nhưng chỉ giữ 2/5 đèn. Đêm 1 khó hơn hẳn (Bóng Mực canh đèn tắt). |
| 4. Phát hành v1.0.0, v1.3 | 69/69 case. Bench 123 FPS / 1 % low 36 / load 1.7 s trên GPU tích hợp. Soak 0 crash, RSS 1.04×. Bảng xếp hạng, trợ năng, Docker, Release. | Docker image chưa build thử (Docker Desktop tắt). Video demo phải tự quay. 1 % low chỉ vượt ngưỡng 30 một chút trên máy yếu. |

## 2. Điều hiệu quả và không hiệu quả khi làm với AI

**Hiệu quả**
- **Một lõi sim tất định dùng chung cho headless và client.** Mỗi luật chỉ viết một lần. Thứ tự 12 bước của ticket nằm thành comment trong `step()`, nên Phase 3 chỉ cần chen thêm "trừ dầu ở bước 2".
- **Test chạy CLI thật, kỳ vọng tính tay.** Mỗi case ghi phép tính (ví dụ "rơi ở tick 64: k(k+1)/360 > 10"). Nhờ vậy test đỏ chỉ đúng chỗ: hoặc test sai (đa số) hoặc game sai (vài lần), và không thể sửa test cho khớp output.
- **Xem ảnh chụp thật** (Chrome qua DevTools protocol) bắt được lỗi mà test không thấy: lưới phím trên menu vỡ, vòng an toàn vẫn vẽ quanh đèn yếu, thanh dầu tàng hình, đồng hồ nhấp nháy bị chụp đúng lúc tắt.
- **Đo trước khi tối ưu.** Bench lần đầu 36 FPS. Chỉ sửa đúng hai chỗ đo được (khoảng 1000 draw call → instancing; HUD ghi DOM mỗi khung hình), lên 117–123 FPS.

**Không hiệu quả**
- **Bot e2e tốn thời gian mà không thắng được** sau khi có số chuẩn (Phase 2–3). Nên dừng sớm hơn và nhờ người chơi thử.
- **Heredoc bash dài** vỡ vì dấu nháy. Chuyển sang ghi script Python ra file trong scratchpad thì ổn định.
- **Gọi API GitHub không đăng nhập** trong vòng lặp chờ CI làm hết lượt gọi, nên mất khả năng xem kết quả CI cả buổi.

## 3. Những lần AI sai và cách phát hiện

| Lần sai | Phát hiện bằng | Sửa |
|---|---|---|
| Commit thư mục có `.git` riêng → gitlink, GitHub không mở được | Người dùng báo; `git ls-tree` cho mode 160000 | Chuyển `.git` con ra bản sao lưu, add file thật |
| Định đọc yêu cầu Phase 2 từ link Phase 1 | Đọc trang: chỉ có PRD-0 | Hỏi lại Ticket-02 thay vì bịa |
| Bóng Mực đặt sẵn trong vùng sáng đi lại tự do (lỗi luật thật) | Test G12 đỏ | Mọi bóng trong vùng sáng đều bị đẩy ra trong 30 tick |
| Lệch 1 tick ở bộ đếm bất tử; tưởng lướt trên không thì rơi | Test đỏ + in snapshot từng tick | Sửa kỳ vọng của test, game đúng |
| `target_lantern_id` lạ không bị bắt khi thiếu mảng `lanterns` (lỗi code thật) | Test mã thoát 2 (F13) | Chuyển phép kiểm tra ra ngoài |
| Cho 2 Bóng Mực hút đèn 50 dầu (vẫn còn vùng an toàn) | Test F8 đỏ | Đổi thành 25 dầu |
| Đo FPS bằng SwiftShader (1–2 FPS) | Số vô lý so với cảm nhận | Viết `fps-bench.js` dùng GPU thật |
| Soak vượt ngưỡng RSS 1.26× | Chạy 30 và 60 Đêm + đo heap: heap 5 MB không đổi, RSS có trần → không rò rỉ | Cố định cấu hình bộ nhớ V8 cho soak; ghi heap vào báo cáo |
| Workflow CI đặt trong thư mục con nên chưa từng chạy, README lại ghi "CI chạy mỗi lần push" | Rà lại cấu trúc khi báo cáo | Chuyển workflow ra gốc, sửa README |
| Định dựng lại Songoku theo yêu cầu | Đối chiếu bản quyền + PRD (Mây đội nón lá) | Từ chối, đề xuất tạo hình gốc |

## 4. Harness giúp nhiều nhất

1. **`AGENTS.md`**, nhất là các quy tắc "kỳ vọng tính tay, không copy output", "test cũ đổi phải ghi lý do", "vùng an toàn chỉ qua `hasZone`", "dầu là số nguyên 1/60". Mỗi lần AI sai, một dòng được thêm vào đây, nên lỗi không lặp lại ở phase sau.
2. **Skill `verify`**: một quy trình cố định gồm test → proof → ảnh (mở ra xem) → FPS → e2e. Đây là lý do mỗi phase đều có bằng chứng khớp tag.
3. **`scripts/proof.js`** sinh `results.md` từ chính các case, không có bảng nào sửa tay.
4. **Hook test-gate** (chặn kết thúc khi test đỏ). Lúc đầu nằm trong thư mục con nên chưa từng chạy; chỉ có hiệu lực sau khi game chuyển lên gốc ở Phase 4. Bài học: kiểm tra harness có thật sự được nạp không.

## 5. Token và chi phí AI

- **Số đo thật:** dùng gói Claude theo thuê bao (Claude Code trong VS Code, model Opus 5.5). Gói này không hiện số token, chỉ hiện phần trăm hạn mức: **đã dùng 96 % hạn mức** (đọc ngày 2026-11-20, sau Phase 4 và phần nâng cấp giao diện). Chi phí tiền: phí thuê bao cố định, không tính theo token.
- **Ước tính token** (không có số đo chính xác): một phiên dài cho cả 4 phase, nhiều lần tóm tắt ngữ cảnh. Khoảng 10–15 triệu token đầu vào (phần lớn là ngữ cảnh được cache) và khoảng 0.3–0.4 triệu token đầu ra.
- **Nhận xét:** 96 % hạn mức cho thấy phiên này tiêu tốn nhiều. Phần tốn nhất là các vòng lặp ít giá trị: tối ưu bot e2e (Phase 2–3, không thắng được), chạy bench nhiều lần để so sánh A/B, và mỗi lần đọc lại file lớn như `web/main.js`.
- **Cách đã tiết kiệm:** sửa file bằng script/`Edit` có chỗ neo thay vì viết lại cả file; đọc file theo đoạn (`offset/limit`); chạy test với reporter TAP rồi `grep` chỉ dòng lỗi; ảnh chụp chỉ mở những ảnh cần kiểm tra; không dùng subagent; dừng việc tối ưu bot khi lợi ích thấp.

## 6. Nếu làm lại

- Ngay từ đầu đặt game ở **gốc repo** (contract yêu cầu `game.contract.json` ở gốc), kiểm tra GitHub hiển thị được và hook/CI thật sự chạy.
- Viết bảng số liệu thành **một file cấu hình có kiểu** ngay Phase 1, vì ticket sau thay số liên tục.
- **Instancing từ đầu** cho thực thể nhiều; không để tới khi bench báo 36 FPS.
- Thay bot tham lam bằng **chơi thử bằng người + quay màn hình** mỗi phase. Video Phase 4 sẽ có sẵn tư liệu.
- Đăng nhập `gh` để xem CI, thay vì gọi API không đăng nhập.
