# Thành phần bên thứ ba

Các thành phần dưới đây được dùng dưới dạng image Docker chính thức, chạy như dịch vụ độc lập và giao tiếp qua mạng.
Kho mã này không chứa, không sửa và không đóng gói lẫn mã nguồn của chúng. Phiên bản được ghim trong `.env.example`.

| Thành phần | Phiên bản | Giấy phép | Vai trò |
|---|---|---|---|
| Keycloak | 26.8.1 | Apache-2.0 | Định danh, SSO, OTP |
| Apache APISIX | 3.19.0 | Apache-2.0 | Cổng API |
| PostgreSQL | 17.11 | PostgreSQL License | Dữ liệu có cấu trúc |
| PostgREST | 16.4 | MIT | REST API từ CSDL |
| SeaweedFS | 3.99 | Apache-2.0 | Kho tệp, S3 API |
| ClamAV | 1.5.4 | GPL-2.0 | Quét mã độc, chạy container riêng |
| n8n | 2.44.4 | Sustainable Use License (fair-code, không thuộc danh sách OSI) | Tự động hóa quy trình |

## Ghi chú về n8n

n8n dùng giấy phép fair-code nên được để ngoài kho mã và chỉ nạp khi chạy: `docker-compose.yml` kéo image chính thức đã ghim phiên bản,
còn các tệp workflow JSON do đội thiết kế được cấp phép Apache-2.0 và nạp tự động khi khởi chạy. Cách dùng này theo hướng dẫn của Ban tổ chức.
Dự phòng khi cần thay thế: Node-RED hoặc Kestra (Apache-2.0).

## Ghi chú về ClamAV

ClamAV (GPL-2.0) chạy trong container riêng và chỉ giao tiếp qua mạng nội bộ, không liên kết với mã của đội.

Giấy phép của phiên bản đã ghim cần được rà soát lại trước mỗi bản phát hành.
