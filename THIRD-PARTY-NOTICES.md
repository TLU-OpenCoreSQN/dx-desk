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

## Thư viện ứng dụng tuần 2

Web/API dùng thư viện npm, ngoài các dịch vụ Docker ở trên. Phiên bản chính xác,
dependency bắc cầu và integrity được lưu trong `apps/*/package-lock.json`.
Metadata kiểm tại dependency đã cài ngày 21/10/2026:

- React/React DOM 18.3.1, React Router 7.18.4: MIT.
- keycloak-js 26.2.4: Apache-2.0.
- lucide-react 0.453.0: ISC.
- NestJS 11.2.7, pg 8.16.3, jose 6.1.0: MIT.
- RxJS 7.8.2: Apache-2.0.

Build web tạo `dist/THIRD-PARTY-LICENSES.txt` từ LICENSE/NOTICE của toàn bộ cây
runtime dependency đã cài và đóng gói cùng static assets. Docker API giữ LICENSE
trong cây `node_modules` production. Giấy phép mã do đội viết không thay thế
giấy phép các thư viện này. Công cụ phát triển/kiểm thử được ghi riêng trong lockfile.
