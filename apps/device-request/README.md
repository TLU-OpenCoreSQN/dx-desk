# Xin cấp thiết bị (ứng dụng 2)

Ứng dụng thứ hai trên Tầng 1 của DX-Desk, dùng để chứng minh nền tảng dùng chung: **không có backend
riêng**, chỉ dùng Keycloak + APISIX + PostgREST + RLS sẵn có.

- React 18 + TypeScript + Vite 7 + Tailwind 4, phục vụ bằng Nginx dưới `/thiet-bi/` sau APISIX.
- Đăng nhập: client Keycloak công khai `dxdesk-device` (Authorization Code + PKCE S256), cùng realm và
  cùng phiên với DX-Desk. Token chỉ nằm trong bộ nhớ.
- Dữ liệu: `GET/POST /rest/device_requests`, `POST /rest/rpc/transition_device_request`,
  `GET /rest/device_request_events` bằng token người dùng. Ai thấy và làm được gì do PostgreSQL quyết định
  (migration 018, policy 003); `src/workflow.ts` chỉ chọn nút nào nên hiện.
- Biên bản bàn giao (W5-03): nút "Tải biên bản (PDF)" gọi `POST /api/device-requests/:id/handover-url` của Service
  Desk API dùng chung để lấy URL ký; đây là lời gọi `/api` duy nhất của ứng dụng.

| Vai trò | Màn hình |
|---|---|
| Mọi người có đơn vị | Biểu mẫu đề nghị (loại, số lượng, lý do) và danh sách đề nghị của mình |
| Manager | Hàng chờ duyệt của đơn vị mình: Duyệt / Từ chối (bắt buộc lý do) |
| Agent (IT) | Đề nghị đã duyệt: Bắt đầu chuẩn bị → Xác nhận đã bàn giao |

## Lệnh

```sh
npm ci --prefix apps/device-request
npm run dev --prefix apps/device-request     # http://localhost:5174/thiet-bi/ (cần stack đang chạy)
npm run build --prefix apps/device-request   # tsc + vite build + THIRD-PARTY-LICENSES.txt
npm test --prefix apps/device-request        # vitest
```

Biến môi trường: xem `.env.example`. Luồng duyệt và mã lỗi: `docs/api/contract.md`.
