# Chuẩn bị phát hành v0.1.0

Tài liệu chuẩn bị. Chưa tạo tag, push, PR, GitHub Release hoặc gửi báo cáo ra ngoài.
Chỉ phát hành sau khi checklist nghiệm thu thực tế đạt.

## Release notes dự thảo

DX-Desk v0.1.0 đặt nền móng tuần 2: Tầng 1 bằng Docker Compose, realm Keycloak,
APISIX, PostgreSQL/PostgREST có RLS, kho tệp SeaweedFS, ClamAV và n8n.
Web React đăng nhập SSO, API NestJS dùng JWT và RLS trong transaction.
Có luồng tối thiểu tạo/xem ticket, audit và xin thiết bị để kiểm chứng nền tảng.

Kèm OpenAPI, ADR, CI, công cụ kiểm thử TN-02 và công cụ đo TN-05.
Chưa bao gồm workflow ticket đầy đủ, SLA timer, upload/quét tệp, dashboard hoặc AI.
TN-05 chỉ công bố khi có số đo thật. Không ghi “Appsmith CE đã chạy” khi mới đánh
giá tài liệu và chọn React fallback.

## Checklist

- [ ] Hoàn thành `docs/demo-tuan-2.md` trên máy người khác.
- [ ] `reuse lint`, build/test, Compose/APISIX checks và stack CI xanh.
- [ ] Hai người review thay đổi, xác nhận phạm vi W2-01…W2-10.
- [ ] W2-11 có trả lời BTC, hoặc ghi rõ còn chờ.
- [ ] Rà không có `.env`, credentials, token, thư mục `.local`/`work` trong commit.
- [ ] CHANGELOG tương ứng với commit phát hành.
- [ ] PR được gộp main, ghi SHA vào biên bản.
- [ ] Tạo annotated tag `v0.1.0` trên SHA đã nghiệm thu.
- [ ] `make release VERSION=0.1.0`, kiểm tra tarball không chứa bí mật/file sinh.
- [ ] Đính kèm tarball vào GitHub Release.
- [ ] Lưu link release và báo cáo thầy.

## W2-11 — nội dung hỏi BTC để Nguyên gửi

“Em chào Ban tổ chức. Đội TLU-OpenCoreSQN, Trường Đại học Thủy lợi, xin xác nhận
hạn nộp mã nguồn và hồ sơ nội dung Phần mềm nguồn mở OLP 2026 có phải
17:00 Chủ Nhật 06/12/2026 không ạ? Nhờ BTC xác nhận thêm kênh nộp và các thành phần
hồ sơ cần gửi. Em cảm ơn.”

Người gửi: …; ngày giờ: …; link/ảnh câu trả lời: …; kết luận được xác nhận: …
Thông tin hạn ở trên lấy từ slide họp đội, chưa phải xác nhận mới từ BTC.
