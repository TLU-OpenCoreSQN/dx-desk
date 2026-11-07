# Kịch bản demo tuần 4 — luồng VPN (M3)

Dùng cho demo nội bộ 07/11/2026 và làm khung cho demo giám khảo. Kiểm thử tự động tương ứng:
`tools/testing/week4-stack.mjs` và `tools/testing/week4-browser.mjs` (CI job
"nghiệm thu stack và browser OTP tuần 3").

## Chuẩn bị

- [ ] Sao chép `.env.example` thành `.env`, giữ `COMPOSE_PROFILES=demo-light`, `AUTOMATION_ENABLED=true`.
- [ ] Chạy `node scripts/dxdesk.mjs up`; mọi dịch vụ healthy.
- [ ] Mở sẵn ba phiên trình duyệt riêng (Employee, Agent, Manager) và một tab Mattermost `http://localhost:18065`.
- [ ] Ghi commit, máy, RAM và hệ điều hành vào biên bản. Số đo RAM tham khảo: [tai-nguyen.md](tai-nguyen.md).

## Cảnh 1 — Đăng nhập một cửa (SSO)

1. Mở `http://localhost:9080`, đăng nhập `employee.a` qua Keycloak (realm `dxdesk`).
2. Wiki.js (từ tuần 5, W5-08): ở **Tạo phiếu**, chọn danh mục *Kết nối VPN* — khung "Thử tự xử lý
   trước khi gửi phiếu" hiện bài *Kết nối VPN từ xa vào mạng nội bộ*. Bấm tiêu đề bài: Wiki.js mở ở tab mới,
   bấm **Đăng nhập** một lần, Keycloak không hỏi lại mật khẩu và quay về đúng bài. Quay lại DX-Desk,
   bấm **Đã tự xử lý được**: hệ thống ghi một lượt tự phục vụ, không tạo phiếu.
3. **Không** đăng nhập Mattermost bằng Keycloak. Mattermost Team Edition không có SSO
   trong bản nguồn mở (QĐ-2, [ADR 0008](adr/0008-sso-keycloak-cho-ung-dung-co-san.md));
   Mattermost chỉ là kênh bot thông báo, xuất hiện ở cảnh 3 với tài khoản nội bộ.

Câu nói gợi ý: "SSO áp dụng cho ứng dụng do đội phát triển và ứng dụng có SSO trong bản
miễn phí. Mattermost Team Edition không có SSO miễn phí nên đội chỉ dùng làm kênh thông báo."

## Cảnh 2 — Employee gửi phiếu VPN

1. `employee.a` mở **Tạo phiếu**, chọn danh mục VPN, điền đủ trường bắt buộc, đính kèm ảnh lỗi.
2. Phiếu được tạo; tệp đính kèm được quét ClamAV ("đã được quét và lưu an toàn").

## Cảnh 3 — Phân công tự động và thông báo

1. n8n phân loại theo `routing_rules` và gán phiếu cho Network Team.
2. Chuyển sang tab Mattermost: bot đăng phiếu vào kênh riêng của team.

## Cảnh 4 — Agent nhận và xử lý

1. `agent.1` mở `/work-queue`, thấy phiếu trong hàng đợi team, bấm **Nhận**.
2. Chuyển trạng thái qua hộp xác nhận; lịch sử phiếu ghi audit.

## Cảnh 5 — Manager phê duyệt

1. `employee.a` tạo phiếu **Cấp quyền hệ thống** → trạng thái `pending_approval`.
2. `manager.1` mở `/approvals`, **Duyệt phiếu** và xác nhận.
3. `employee.a` mở `/work-queue` → bị từ chối ("Không có quyền truy cập").

## Biên bản

- Commit / link CI:
- Máy / RAM / hệ điều hành / Docker:
- Người chạy, ngày giờ:
- Cảnh lỗi hoặc bỏ qua (ghi rõ lý do, ví dụ Wiki.js SSO chưa nối):
