# 0002. Vai trò CSDL và phân quyền RLS

- Trạng thái: Đã triển khai, chờ review đội.
- Ngày: 21/10/2026.
- Người phụ trách theo kế hoạch: Quyền (TV2), Nguyên hỗ trợ.
- Mã: W2-06.

## Quyết định

PostgREST đăng nhập bằng `authenticator`; NestJS dùng `api_login`.
Cả hai là NOINHERIT, NOBYPASSRLS, không phải superuser.
Mỗi giao dịch chuyển sang `authenticated`, lấy danh tính từ JWT đã kiểm chứng.
Database owner dùng riêng cho migration, không đưa vào API runtime.

Employee đọc ticket/device request của mình. Agent và Manager được đọc tất cả
để phục vụ hỗ trợ IT. Chỉ Manager tạo ticket Critical. Các bảng tham chiếu chỉ đọc,
routing rules chỉ dành cho staff. Trạng thái mới, người tạo và timestamp do database
quyết định. Chỉ cấp INSERT trên các cột nghiệp vụ cho phép.
Tuần 2 chưa cấp UPDATE/DELETE, chưa triển khai workflow chuyển trạng thái.

Tất cả bảy bảng bật ENABLE/FORCE RLS. Audit tạo ticket do trigger SECURITY DEFINER
có search_path cố định sinh ra. Schema private không được PostgREST expose.
Migration chạy bằng tài khoản postgres của môi trường development; trigger owner
có quyền ghi audit. Khi đổi migration owner phải kiểm tra lại quyền trigger dưới FORCE RLS.

## Căn cứ và phạm vi

Slide chỉ yêu cầu “RLS ban đầu”, chưa mô tả ranh giới team.
Quy tắc staff đọc tất cả là quyết định triển khai tuần 2, cần đội review trước
khi thêm phân công/team ở tuần 3. JWT `sub` được xem là UUID theo realm Keycloak hiện tại.
Không dựng bảng user chứa mật khẩu trong database ứng dụng.

## Kiểm chứng

`npm run integration --prefix tools/testing` dùng PostgreSQL thật và PostgREST thật.
Bao gồm hai Employee độc lập, Agent, Manager, cấm giả chủ sở hữu/trạng thái, audit,
quyền metadata đính kèm và giới hạn Critical.
Kết quả từng lần chạy được tổng hợp trong `docs/ke-hoach-tuan-2.md`.

## Hệ quả

API và PostgREST dùng cùng một bộ policy. API chỉ truyền claims của token đã xác thực.
Không nhận claims/requester từ request body.
Sau này thêm workflow, upload hoặc approval phải bổ sung endpoint, grant và policy
theo nguyên tắc tối thiểu quyền, kèm test trên cả đường API và PostgREST.
