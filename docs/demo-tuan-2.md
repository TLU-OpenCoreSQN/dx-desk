# Kịch bản demo và nghiệm thu tuần 2

## Chuẩn bị

- [ ] Máy người khác clone branch/commit được review.
- [ ] Sao chép `.env.example` thành `.env`.
- [ ] Chạy `node scripts/dxdesk.mjs up`, đủ bảy dịch vụ Tầng 1 và API/web healthy.
- [ ] Ghi hệ điều hành, RAM, phiên bản Docker/Compose và commit vào biên bản.
- [ ] Chạy `node scripts/stack-test.mjs --restart-n8n`, lưu `.local/reports/stack.json`.

## Demo trình duyệt

1. Mở `http://localhost:9080`, đăng nhập `employee.a` qua Keycloak.
2. Kiểm tra web hiển thị đúng username và vai trò.
3. Tạo một ticket VPN đủ nội dung; ticket mới ở trạng thái `new`, có audit tạo.
4. Thử dữ liệu thiếu, kiểm tra thông báo lỗi và không ghi một ticket lỗi.
5. Đăng xuất, mở phiên riêng cho `employee.b`; không thấy ticket của A.
6. Đăng nhập `manager.1`; thấy ticket của A và tạo được mức Critical.
7. Mở trang xin cấp thiết bị trong cùng ứng dụng; tạo yêu cầu, trạng thái pending.
8. Đăng xuất, xác nhận dữ liệu người cũ biến mất và API yêu cầu đăng nhập.
9. Mở DevTools để xác nhận request đến `/api` qua APISIX, không sao chép token vào biên bản.

## Nền tảng và dữ liệu

- [ ] `/healthz` và `/api/health` trả thành công.
- [ ] `/webhook/dxdesk-hello` chạy sau import và sau restart n8n.
- [ ] API ghi ticket, PostgREST đọc lại cùng token; user khác không đọc được.
- [ ] Chạy `up` lần hai, ticket vừa tạo vẫn còn.
- [ ] `make migrate`/lệnh Node chạy lại không nhân đôi dữ liệu tham chiếu.
- [ ] REUSE, build/test và CI đạt.

## Biên bản

- Commit:
- Người chạy độc lập:
- Máy / RAM / hệ điều hành:
- Ngày giờ:
- Lệnh và kết quả:
- Lỗi còn lại:
- Link CI / PR:
- TN-01: đánh giá tài liệu và phương án React, nêu rõ chưa thử Appsmith runtime.
- TN-02: ghi rõ môi trường portable và full stack nếu đã chạy.
- TN-05: đính kèm số đo thật, nếu chưa có ghi “chưa đo”.

Chưa demo AI, dashboard, tự phân công/SLA hoặc quét upload trong tuần 2.
