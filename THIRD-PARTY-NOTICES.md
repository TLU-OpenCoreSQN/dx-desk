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
| Mattermost Team Edition | 12.0.1 | [Giấy phép binary do Mattermost phát hành và các điều khoản nguồn](https://github.com/mattermost/mattermost/blob/v12.0.1/LICENSE.txt) | Kênh thông báo nhóm hỗ trợ, hồ sơ `full`/`demo-light` (W4-04); Team Edition, không thay bằng Enterprise |
| Wiki.js | 2.5.315 | [AGPL-3.0](https://github.com/requarks/wiki/blob/v2.5.315/LICENSE) | Tri thức tự phục vụ, hồ sơ `full`/`demo-light` (W5-08); chạy image chính thức không sửa, giao tiếp qua GraphQL |
| Metabase OSS | v0.64.3 | [AGPL cho binary OSS; Enterprise có giấy phép khác](https://github.com/metabase/metabase/blob/v0.64.3/LICENSE.txt) | Dashboard Manager, hồ sơ `full` (W5-06); tài khoản nội bộ và static embedding |

## Image PoC, benchmark và build/runtime ứng dụng

Các image sau cũng được ghim trong `infra/compose/tn04.yml`, `.env.example` hoặc
Dockerfile. PoC TN-04 (`tn04.yml`) chạy tách biệt và dùng cùng phiên bản Wiki.js, Mattermost,
Metabase như bảng trên; profile benchmark không tự tải mô hình.

| Image / phiên bản | Metadata giấy phép upstream | Phạm vi |
|---|---|---|
| `ollama/ollama:0.12.6` | [MIT](https://github.com/ollama/ollama/blob/v0.12.6/LICENSE) | Công cụ benchmark tùy chọn; mô hình có giấy phép riêng |
| `node:22.22.0-alpine` | Node.js MIT và notices thành phần đi kèm | Build web và runtime API |
| `nginx:1.28.0-alpine` | Nginx BSD-2-Clause và notices thành phần đi kèm | Phục vụ static web |
| `postgres:17.11-alpine` | PostgreSQL License và notices thành phần đi kèm | DB PoC |

Tag image không thay thế notices trong image và giấy phép từng gói Alpine/dependency.
Khi phân phối hoặc sửa thành phần bên thứ ba, giữ hồ sơ nguồn/license theo đúng bản;
không suy rằng chạy container riêng tự giải quyết mọi nghĩa vụ giấy phép.

## Ghi chú về n8n

n8n dùng giấy phép fair-code nên được để ngoài kho mã và chỉ nạp khi chạy: `docker-compose.yml` kéo image chính thức đã ghim phiên bản,
còn các tệp workflow JSON do đội thiết kế được cấp phép Apache-2.0 và nạp tự động khi khởi chạy.
Chưa có văn bản BTC được lưu trong kho xác nhận phạm vi sử dụng này.
Không coi bảng notices hoặc CI là xác nhận của BTC.
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
- PDFKit 0.20.2 (W5-03, sinh biên bản bàn giao trong API): MIT; dependency bắc cầu trong `apps/api/package-lock.json`.
- Phông Noto Sans Regular/Bold (W5-03): SIL Open Font License 1.1, © 2022 The Noto Project Authors. Tệp `.ttf` nguyên
  bản lấy từ gói npm `@expo-google-fonts/noto-sans` 0.4.2, đặt ở `apps/api/assets/fonts/` kèm `OFL.txt`; biên bản PDF
  nhúng tập con của phông. Văn bản giấy phép: `LICENSES/OFL-1.1.txt`.
- Ứng dụng 2 (`apps/device-request`, W5-01) chỉ dùng React/React DOM 18.3.1 và keycloak-js 26.2.4 cùng phiên bản
  với web; không thêm thư viện runtime mới. Build cũng tạo `dist/THIRD-PARTY-LICENSES.txt`.
- jsonld 9.0.0 (Digital Bazaar): BSD-3-Clause; chỉ là devDependency của API để kiểm
  thử JSON-LD W5-04, không nằm trong image runtime.

Build web tạo `dist/THIRD-PARTY-LICENSES.txt` từ LICENSE/NOTICE của toàn bộ cây
runtime dependency đã cài và đóng gói cùng static assets. Docker API giữ LICENSE
trong cây `node_modules` production. Giấy phép mã do đội viết không thay thế
giấy phép các thư viện này. Công cụ phát triển/kiểm thử được ghi riêng trong lockfile.
