# Phát hành v0.1.0

Tài liệu chuẩn bị. Nhánh chuẩn bị là `release-v0.1.0`. Chưa tạo tag, GitHub Release
hoặc gửi báo cáo ra ngoài. Chỉ phát hành sau khi checklist nghiệm thu thực tế đạt.
Danh sách thay đổi đầy đủ ở [CHANGELOG](../CHANGELOG.md#010---2026-11-02).

## Release notes

DX-Desk v0.1.0 là bản đầu tiên của hệ thống tiếp nhận và tự động xử lý yêu cầu IT
nội bộ trên DX-OS Open-Core, gồm kết quả tuần 2 đến tuần 4.

**Nền tảng.** Tầng 1 bằng Docker Compose: Keycloak (SSO, OTP tùy chọn), APISIX kiểm
JWT RS256 và rate limit, PostgreSQL/PostgREST có RLS, SeaweedFS, ClamAV, n8n và
Mattermost Team Edition. Chạy từ máy sạch bằng `cp .env.example .env && make up`
hoặc `node scripts/dxdesk.mjs up` trên Windows.

**Ticket.** Web React đăng nhập SSO, API NestJS dùng JWT và RLS trong transaction.
Máy trạng thái 9 giá trị/17 cạnh với Poka-yoke ở cả API và DB, trường động theo danh
mục, SLA có tạm dừng khi chờ người dùng, dòng thời gian và kết quả xử lý. Tệp đính
kèm được quét ClamAV trước khi lưu, tải bằng URL ký hạn 120 giây.

**Tự động hóa.** Outbox sự kiện bền vững gọi n8n để định tuyến theo team, nhắc SLA
ở 80% và đánh dấu vi phạm, thông báo vào kênh Mattermost riêng. Agent có bảng việc
và nhận phiếu theo team; Manager có hàng đợi phê duyệt. Giao diện mới có chủ đề
sáng/tối.

**Kèm theo.** OpenAPI và hợp đồng API, ADR 0001–0009, CI build/test và nghiệm thu
stack thật, công cụ TN-02/TN-04/TN-05, seed dữ liệu tổng hợp và đo tài nguyên.

**Chưa bao gồm.** Dashboard báo cáo, AI/Ollama trong luồng chính (profile `full`
không tự tải model), tài liệu kiến trúc, vận hành và hướng dẫn sử dụng theo vai trò.
Số đo TN-05 chỉ công bố khi có số đo thật trên máy demo 16 GB. Không ghi “Appsmith
CE đã chạy” khi mới đánh giá tài liệu và chọn React fallback. Giao hàng thông báo
Mattermost là at-least-once, không phải exactly-once.

## Checklist

Ghi SHA, link run CI hoặc tên người nghiệm thu cạnh mỗi mục khi tick.

- [ ] CHANGELOG và tài liệu khớp nội dung sẽ phát hành; sửa ngày `[0.1.0]` nếu tag vào ngày khác.
- [ ] Mở PR `release-v0.1.0` → `main`. CI không chạy khi push nhánh `release-*`, chỉ chạy trên PR.
- [ ] `reuse lint`, Compose/APISIX checks, build/test và nghiệm thu stack (gồm `week4-stack`, `week4-browser`) xanh trên PR.
- [ ] Chạy kịch bản demo trên máy người khác, từ máy sạch bằng `make up`.
- [ ] Hai người review, xác nhận phạm vi tuần 2–4.
- [ ] W2-11 có trả lời BTC, hoặc ghi rõ còn chờ.
- [ ] Rà không có `.env`, credentials, token, thư mục `.local`/`work` trong commit.
- [ ] PR được gộp `main`, ghi SHA trên `main` vào biên bản (squash merge tạo SHA mới khác nhánh release).
- [ ] Tạo annotated tag `v0.1.0` trên SHA đó của `main`: `git tag -a v0.1.0 -m "DX-Desk v0.1.0"`, rồi `git push origin v0.1.0`.
- [ ] `make release VERSION=0.1.0`, kiểm tra tarball không chứa bí mật/file sinh.
- [ ] Tạo GitHub Release từ tag, dán phần release notes ở trên, đính kèm tarball.
- [ ] Lưu link release và báo cáo thầy.

## W2-11 — nội dung hỏi BTC để Nguyên gửi

“Em chào Ban tổ chức. Đội TLU-OpenCoreSQN, Trường Đại học Thủy lợi, xin xác nhận
hạn nộp mã nguồn và hồ sơ nội dung Phần mềm nguồn mở OLP 2026 có phải
17:00 Chủ Nhật 06/12/2026 không ạ? Nhờ BTC xác nhận thêm kênh nộp và các thành phần
hồ sơ cần gửi. Em cảm ơn.”

Người gửi: …; ngày giờ: …; link/ảnh câu trả lời: …; kết luận được xác nhận: …
Thông tin hạn ở trên lấy từ slide họp đội, chưa phải xác nhận mới từ BTC.
