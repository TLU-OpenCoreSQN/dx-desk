# 0004. TN-01 / QĐ-1 — Ứng dụng xin cấp thiết bị dùng React

- Trạng thái: Chọn phương án dự phòng React theo slide; chờ review đội.
- Ngày: 21/10/2026.
- Người phụ trách theo kế hoạch: Séc (TV3), Quyền hỗ trợ.
- Mã: W2-09, TN-01, QĐ-1.

## Tiêu chí

Appsmith Community phải đăng nhập Keycloak, gọi APISIX/PostgREST bằng token của
chính người dùng, RLS chặn dữ liệu của người khác và cấu hình xuất JSON được.
Không sử dụng tài khoản chung để thay thế danh tính của người dùng.

## Bằng chứng tài liệu

Ngày 21/10/2026, [tài liệu OIDC chính thức](https://docs.appsmith.com/getting-started/setup/instance-configuration/authentication/openid-connect-oidc)
gắn nhãn Enterprise. [Trang tính năng các gói](https://www.appsmith.com/pricing)
đặt SAML/OIDC SSO trong Enterprise. Điều này không đáp ứng cách tích hợp native OIDC
trên Community mà kế hoạch yêu cầu.

Đây là đánh giá tài liệu, **chưa phải kết quả đăng nhập thử Appsmith runtime**.
Máy không có Docker; không có bản export Appsmith giả hay tuyên bố RLS Appsmith đã đạt.
Không suy rộng thành mọi hình thức custom auth của Appsmith đều bất khả thi.

## Quyết định triển khai

Áp dụng phương án dự phòng đã nêu ở slide 16: trang “Xin cấp thiết bị” trong cùng
ứng dụng React và phiên Keycloak với DX-Desk. Dùng API `/api/device-requests`,
RLS giống PostgREST. Khung tối thiểu cho phép tạo và xem yêu cầu của mình.
Quy trình duyệt/fulfillment thuộc tuần 5, chưa triển khai trong tuần 2.

Phần này dùng lại Keycloak, APISIX và PostgreSQL của Tầng 1, không dựng hệ thống
đăng nhập hoặc dữ liệu riêng. Test backend kiểm chứng Employee B không đọc được
yêu cầu của A. Harness SSO native ngày 21/10/2026 đã tạo thiết bị `pending` qua
trình duyệt với Keycloak thật, kiểm quyền API/PostgREST của hai Employee và staff.
Nghiệm thu qua APISIX/container và thử Appsmith runtime vẫn chưa thực hiện.

## Hệ quả

Không cần gói Enterprise hoặc thêm login dùng chung. Đội mất phần minh chứng
low-code Appsmith, cần trình bày trung thực phương án dự phòng đã chọn.
Giữ client Appsmith mẫu trong realm để có thể khảo sát lại, không đưa client secret
đó vào frontend.
