# 0003. TN-02 — JWT claims trong giao dịch NestJS

- Trạng thái: TN-02 portable đạt 8/8 integration tests ngày 21/10/2026; chờ nghiệm thu toàn stack.
- Ngày: 21/10/2026.
- Người phụ trách: Quyền (TV2), Séc hỗ trợ.
- Mã: W2-07, TN-02.

## Câu hỏi

API NestJS có thể dùng cùng RLS với PostgREST khi ghi PostgreSQL không?

## Cách triển khai

API kiểm chữ ký RS256 bằng JWKS, issuer, audience `dxdesk-api`, thời hạn,
UUID `sub`, role database `authenticated` và vai trò nghiệp vụ.
Một connection được mượn từ pool cho toàn bộ giao dịch:

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', $1, true);
-- Queries with positional parameters.
COMMIT;
```

`set_config(..., true)` tương đương SET LOCAL nhưng cho phép tham số hóa JSON.
Lỗi bất kỳ gây ROLLBACK. Nếu rollback lỗi, connection bị loại khỏi pool.
Không sử dụng SET ở cấp session. Không chạy query nghiệp vụ ngoài transaction.

PostgREST kiểm chữ ký và audience, sau đó chạy `private.check_request` kiểm issuer,
định danh và thời hạn bắt buộc. Kiểm tra exp bổ sung giúp API và PostgREST từ chối
token hết hạn nhất quán, kể cả khi thư viện PostgREST có độ lệch thời gian cho phép.
`nbf` nếu có phải là số và đã tới thời điểm hiệu lực; roles phải là mảng chuỗi
trên cả hai đường truy cập. Không chấp nhận object có khóa Manager thay cho mảng role.

## Thử nghiệm tái lập

```sh
npm ci --prefix apps/api
npm run build --prefix apps/api
npm ci --prefix tools/testing
npm run integration --prefix tools/testing
```

Harness tạo PostgreSQL 17.10 portable độc lập, PostgREST 16.4 chính thức (SHA-256
kiểm chứng), JWKS RSA thử nghiệm và ứng dụng NestJS thật qua HTTP.
Không dùng mock database, mock PostgREST hay bỏ qua xác thực.
JWT được ký bằng khóa fixture, không phải token từ Keycloak thực.

Các trường hợp: hai Employee chỉ thấy dữ liệu của mình trên cả hai đường; staff
đọc được; Critical chỉ Manager; cấm giả chủ sở hữu/trạng thái; audit tự sinh;
rollback không giữ bản ghi; 24 request xen kẽ qua pool 2 connection không lẫn claims;
token sai chữ ký/issuer/audience/hết hạn bị từ chối.

## Giới hạn và nghiệm thu tiếp theo

Kết quả thực tế: 8/8 bài kiểm thử đạt, gồm RLS trên cả hai đường truy cập,
token không hợp lệ, chống giả chủ sở hữu, audit, rollback và pool đồng thời.
Giữ phương án dùng chung RLS. Lượt TN-02 này dùng JWT fixture, không xác nhận
đăng nhập Keycloak thực. Kiểm thử bổ sung `tools/testing/native-sso.mjs` đã đạt
10/10 ngày 21/10/2026 với Keycloak 26.8.1 thật: trình duyệt đăng nhập PKCE,
tạo ticket/thiết bị, cùng token kiểm RLS API/PostgREST, refresh và logout.
Hai bộ kiểm thử bổ sung cho nhau, không thay thế phạm vi của nhau.

Compose ghim PostgreSQL 17.11; bản portable kiểm thử là 17.10.
Máy hiện chưa có Docker nên chưa kiểm chứng đường đi Keycloak/APISIX xuyên suốt.
Harness native dùng Vite proxy thẳng NestJS và không khởi chạy APISIX/n8n.
Chạy `node scripts/stack-test.mjs --restart-n8n` sau `make up` để đóng tiêu chí này.
CI có job riêng cho stack, kết quả chỉ được coi là đạt sau khi GitHub chạy thật.

Nếu TN-02 thất bại trong môi trường mục tiêu và không sửa được trong thời hạn,
phương án dự phòng theo slide là kiểm quyền trong API, giữ RLS cho PostgREST và ghi
rõ nguyên nhân. Chưa bật phương án dự phòng vì cần giữ một nguồn quy tắc quyền.

Tham khảo: [PostgREST transactions](https://postgrest.org/en/stable/references/transactions.html).
