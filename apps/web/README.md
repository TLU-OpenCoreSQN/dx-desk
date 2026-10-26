# DX-Desk Web (Giao diện Tuần 2)

Giao diện người dùng cho hệ thống tiếp nhận và xử lý yêu cầu IT nội bộ **DX-Desk**, xây dựng trên nền tảng **DX-OS Open-Core** theo mô hình H-P-D-I (TLU-OpenCoreSQN).

## Công nghệ sử dụng

- **React 18** + **TypeScript** (Strict mode)
- **Vite 7** (Dev server cổng `5173`, proxy `/api` và `/rest` tới `http://localhost:9080`)
- **Tailwind CSS 4** (Navy `#0F172A` / Teal `#0D9488`, font hệ thống, không tải font bên ngoài)
- **React Router 7** (định tuyến phía trình duyệt)
- **keycloak-js** (Chuẩn OIDC Authorization Code + PKCE S256, không lưu token vào localStorage/sessionStorage, tự động làm mới `updateToken(30)`)
- **Vitest** + **@testing-library/react** (Kiểm thử đơn vị và tích hợp cho auth, api client, form validation, role permissions)
- **Nginx Alpine** (Phục vụ production tại cổng 80, hỗ trợ SPA fallback và health check `/healthz`)

## Biến môi trường

Sao chép `.env.example` thành `.env` nếu cần tuỳ biến:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_KEYCLOAK_URL` | `http://localhost:8080` | URL máy chủ Keycloak OIDC |
| `VITE_KEYCLOAK_REALM` | `dxdesk` | Realm xác thực |
| `VITE_KEYCLOAK_CLIENT_ID` | `dxdesk-web` | Client ID công khai (public client, PKCE S256) |
| `VITE_API_BASE_URL` | `/api` | Đường dẫn gốc API (cùng nguồn thông qua APISIX) |
| `VITE_PROXY_TARGET` | `http://localhost:9080` | Cổng APISIX khi chạy dev proxy |

## Hướng dẫn cài đặt và phát triển

```bash
cd apps/web

# Cài đặt chính xác các phụ thuộc từ package.json
npm ci

# Chạy môi trường phát triển (cổng 5173)
npm run dev

# Chạy bộ kiểm thử tự động
npm test

# Kiểm tra kiểu và đóng gói production
npm run build
```

## Đóng gói Docker Production

Docker image được xây dựng theo mô hình multi-stage (`node:22.22.0-alpine` + `nginx:1.28.0-alpine`):

```bash
# Build Docker image
docker build -t dx-desk-web:0.1.0 .

# Kiểm tra riêng static web (cổng này không có gateway API)
docker run -d --name dx-desk-web -p 127.0.0.1:8081:80 dx-desk-web:0.1.0

# Kiểm tra sức khoẻ container
curl http://localhost:8081/healthz
```

## Chức năng triển khai (Tuần 2)

1. **Trang giới thiệu khi chưa đăng nhập (Signed-out Home)**:
   - Hiển thị đầy đủ thông tin dịch vụ, tình trạng kết nối API (`/api/health`).
   - Nút đăng nhập tường minh qua Keycloak SSO.
   - Vẫn hiển thị ổn định kể cả khi máy chủ xác thực Keycloak tạm thời gián đoạn.

2. **Xác thực OIDC & Quản lý phiên**:
   - Sử dụng Flow Authorization Code với PKCE S256.
   - Không lưu access token hay refresh token vào persistent storage; token chỉ nằm trong bộ nhớ.
   - Tự động gọi `updateToken(30)` trước mọi yêu cầu API nghiệp vụ.
   - Hiển thị tên người dùng và vai trò (`Employee`, `Agent`, `Manager`).
   - Đăng xuất an toàn và điều hướng về cùng nguồn gốc (`window.location.origin`).

3. **Danh sách phiếu yêu cầu (Ticket List)**:
   - Tải dữ liệu thực qua `GET /api/tickets?limit=25&offset=0`.
   - Phân trang chuẩn (Trang trước / Trang sau), hiển thị đúng trạng thái rỗng, tải và lỗi.
   - Tuyệt đối không sinh dữ liệu giả, không hiển thị số liệu thống kê bịa đặt.

4. **Tạo mới phiếu yêu cầu (Create Ticket)**:
   - Tải danh mục thực tế từ `GET /api/categories`.
   - Ràng buộc dữ liệu nghiêm ngặt: tiêu đề (5..200 ký tự), nội dung (10..5000 ký tự).
   - Mức độ ưu tiên: `low`, `normal`, `high`, `critical`.
   - Mức `critical` (Khẩn cấp) được giới hạn và chỉ kích hoạt đối với người dùng có vai trò `Manager`.

5. **Chi tiết phiếu & Dòng sự kiện (Ticket Detail & Events)**:
   - Truy vấn thông tin chi tiết qua `GET /api/tickets/:id`.
   - Hiển thị dòng thời gian sự kiện thực qua `GET /api/tickets/:id/events`.
   - Thuyết minh rõ ràng về các tính năng tương lai (chuyển trạng thái, trao đổi, tệp đính kèm) thay vì để nút bấm vô tác dụng.

6. **Xin cấp thiết bị (Device Request - Fallback Proof)**:
   - Tải danh sách yêu cầu thực qua `GET /api/device-requests?limit=25&offset=0`.
   - Gửi yêu cầu mới qua `POST /api/device-requests` với `{device_type, reason, quantity}`.
   - Không gửi các trường trạng thái / phân quyền lên máy chủ theo đúng hợp đồng backend.

## Giấy phép

Kiểm thử hiện tại và giới hạn: [báo cáo tuần 2](../../docs/bao-cao-kiem-thu-tuan-2.md).
Các test UI dùng fixture không thay thế nghiệm thu Keycloak/APISIX thật.
Tailwind 4 yêu cầu trình duyệt hiện đại: Chrome 111+, Safari 16.4+, Firefox 128+.
Xem [hướng dẫn nâng Tailwind](https://tailwindcss.com/docs/upgrade-guide).

Mã nguồn được phân phối theo [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0).
Mỗi tệp nguồn đều có SPDX header tương ứng theo chuẩn REUSE của dự án.
