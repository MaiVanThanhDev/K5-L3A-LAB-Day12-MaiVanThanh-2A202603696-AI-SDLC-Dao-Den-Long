# CREDITS

## Nội dung game

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Nhân vật, bối cảnh, tên gọi (Mây, Ông Đăng, Đảo Đèn Lồng, Bóng Mực, Gió Lạc, Bùa Gió), bảng màu và số liệu chuẩn | Đề bài lab Day 12 AI SDLC (PRD-0, Ticket-02…04) | theo lab |
| Thư viện 3D | [three.js](https://threejs.org) r160, npm package `three` | MIT |
| Mô hình 3D (Mây, đèn, Bóng Mực, đảo, tháp chuông, cây, đá…) | Tự dựng bằng khối hình học cơ bản của three.js trong `web/main.js` | MIT (repo này) |
| Âm thanh: nhạc nền và mọi hiệu ứng | Tổng hợp thời gian thực bằng WebAudio (oscillator + nhiễu) trong `web/audio.js`; không có file âm thanh | MIT (repo này) |
| Phông chữ | Phông hệ thống của máy (`system-ui`, "Segoe UI"…); không nhúng phông | — |
| Ảnh chụp trong `docs/proof/` | Chụp từ chính game bằng Chrome qua DevTools protocol (`scripts/screens.js`) | MIT (repo này) |

Không dùng asset hình ảnh, âm thanh hay mô hình nào tải từ bên ngoài.

## Công cụ AI

| Công cụ | Dùng để | Ghi chú |
|---|---|---|
| Claude Code (Anthropic), model Claude Opus 5.5, trong VS Code | Viết code (sim, client, test, script), tài liệu (spec, ADR, changelog, giả định, retro), kịch bản ảnh chụp và đo hiệu năng | Nhật ký từng phase: [docs/notes/ai-log.md](docs/notes/ai-log.md) |

Không có hình ảnh, âm thanh hay video nào do AI tạo sinh. Lời thoại Ông Đăng và chữ trong game do AI viết theo bối cảnh của đề.

## Công cụ khác

Node.js, Google Chrome (chụp ảnh, đo FPS và bench), Git/GitHub, GitHub Actions (CI).
