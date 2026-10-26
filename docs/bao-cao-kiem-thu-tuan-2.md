# Báo cáo kiểm thử và bàn giao tuần 2

**Cập nhật:** 21/10/2026. **Nhánh:** `develop-quyennnv`.
**Kết luận:** phần mã tuần 2 đã được triển khai cho ba thành viên và kiểm chứng
ở các lớp khả dụng trên máy này. Chưa nghiệm thu toàn stack và chưa phát hành v0.1.0.
Theo dõi công việc tại [kế hoạch có ô tick](ke-hoach-tuan-2.md).

## Những gì đã kiểm chứng

- [x] API: `npm ci`, build TypeScript/NestJS thành công; **6/6 unit tests**.
- [x] API + PostgreSQL 17.10 + PostgREST 16.4: **8/8 integration tests**.
  Hai Employee tách dữ liệu, Agent/Manager đọc theo quyền, Critical chỉ Manager,
  chặn giả requester/status, audit tự sinh, rollback nguyên tử và 24 request
  xen kẽ qua pool 2 connection không lẫn danh tính.
- [x] JWT sai chữ ký/issuer/audience/hết hạn/chưa tới `nbf` và roles sai kiểu
  bị từ chối trên API và PostgREST.
- [x] Migration runner qua Git Bash + psql 17.10 + PostgreSQL 17.10: **4/4 kiểm tra đạt**.
  Chạy lần đầu/lần hai, giữ dữ liệu và timestamp ledger, chặn checksum thay đổi,
  rollback DDL/ledger khi SQL lỗi rồi chạy lại thành công.
- [x] Frontend: `npm ci`, build production thành công; **35/35 tests**.
  Có kiểm thử form, payload gửi API, lỗi/empty state, 401, refresh thất bại,
  phản hồi cũ sau mất phiên và phân trang khi trang cuối rỗng.
- [x] Chromium: **7/7 nhóm kiểm tra UI** trên desktop 1440 px và mobile 390 px.
  Kiểm tra offline, menu/Escape/focus, tạo phiếu, Critical bị khóa với Employee,
  chi tiết/lịch sử, gửi thiết bị, 401 xóa dữ liệu và không có lỗi JavaScript chưa xử lý.
- [x] SSO native: **10/10 kiểm tra đạt**, lượt mới nhất 21/10/2026 lúc
  06:57:18-06:58:03 UTC (13:57-13:58 giờ Việt Nam). Keycloak 26.8.1 + JDK 25,
  PostgreSQL 17.10, NestJS, PostgREST 16.4 và Chromium thật, database riêng.
  Kiểm import realm, Authorization Code + PKCE S256, ticket/audit, ba vai trò,
  RLS hai Employee trên API/PostgREST, Critical, tạo thiết bị `pending`, refresh,
  không lưu token vào web storage, logout xóa dữ liệu và không lỗi JS chưa xử lý.
  Trang thiết bị mobile 390 px được kiểm tự động không tràn ngang; phiên tiếp tục
  không duyệt ảnh trực quan do công cụ hiện tại không đọc được ảnh.
- [x] `npm audit`: 0 vulnerabilities tại thời điểm kiểm tra cho API, web và tools/testing.
- [x] Compose 2.40.3 portable: `config -q` thành công; đây là kiểm cấu hình.
- [x] ShellCheck 0.11.0: 5 script shell thành công.
- [x] Kiểm YAML, tham chiếu route/service, env, mapper audience, dependency lockfile.
- [x] REUSE: snapshot mã nguồn không gồm dependencies đạt; không thiếu license/SPDX.
- [x] `git diff --check` thành công.

## Bằng chứng tại máy

Các file dưới `.local/` được Git ignore, không chứa token đăng nhập:

- `.local/reports/web-tests.json`: kết quả 35 tests frontend.
- `.local/reports/integration.json` và `integration.tap`: kết quả TN-02.
- `.local/reports/browser.json`: từng kiểm tra trình duyệt và trạng thái.
- `.local/reports/web-desktop-offline.png`, `web-mobile-offline.png`.
- `.local/reports/web-mobile-ticket-form.png`, `web-mobile-ticket-created.png`.
- `.local/reports/web-desktop-ticket.png`, `web-mobile-ticket-detail.png`.
- `.local/reports/migrations.json`: kết quả 4/4 kiểm tra runner migration.
- `.local/reports/native-sso.json`: kết quả 10/10 SSO thật, không chứa token.
- `.local/reports/native-sso-ticket.png`, `native-sso-device-mobile.png`: ảnh luồng thật.

Ảnh có tiền tố `web-` dùng tài khoản `employee.fixture`, có dữ liệu fixture
được chặn tại HTTP/module trong harness. Fixture không nằm trong ứng dụng production.
Đây là bằng chứng UI, không phải bằng chứng SSO hay dữ liệu vận hành thật.
Ảnh `native-sso-*` dùng `employee.a`, Keycloak và dữ liệu test thật, không mock
xác thực/HTTP. Vite proxy trực tiếp tới NestJS, không đi qua APISIX; không dùng
kết quả native để tick nghiệm thu Docker, n8n hoặc toàn bộ Tầng 1.
TN-02 dùng PostgreSQL/PostgREST thật nhưng JWT RSA fixture; Compose dùng PostgreSQL
17.11, khác bản portable 17.10 đã kiểm.

## Phần bàn giao theo thành viên

- **Nguyên:** Compose/API gateway/realm được bổ sung web và API, lệnh chạy Windows,
  migration runner, n8n reload/import credentials, CI app/database/browser/stack,
  12 Issue mẫu, checklist phát hành và bản hỏi BTC.
- **Quyền:** 7 bảng, RLS và grant theo cột, audit, dữ liệu tham chiếu, NestJS/JWT,
  transaction claims, ticket/device endpoints, OpenAPI, TN-02 và tài liệu dữ liệu.
- **Séc:** web React tiếng Việt, OIDC/PKCE, các trang tuần 2, xử lý phiên/lỗi,
  responsive, kiểm thử UI; ADR chọn React dự phòng TN-01 và công cụ đo TN-05.

Đã review scope frontend worker chỉ sửa `apps/web`, sau đó Codex tích hợp,
sửa auth/typing/phân trang/dependency và tự chạy các kiểm tra ở trên.
Các tài liệu ADR 0002–0006 giải thích quyết định và giới hạn của từng thử nghiệm.

## Chưa đạt nghiệm thu — không đánh dấu hoàn thành

- [ ] Máy hiện chưa có Docker Engine/Desktop và WSL chưa cài: chưa khởi chạy 7 dịch vụ
  Tầng 1 cùng web/API, chưa build image hay xác nhận các container healthy.
- [ ] Chưa đăng nhập Keycloak bằng trình duyệt và kiểm token qua APISIX trên
  stack Docker. Đăng nhập Keycloak native thật đã đạt, không đóng tiêu chí gateway.
- [ ] Chưa thử n8n webhook/restart/import credentials thật.
- [ ] TN-05 chưa có số đo RAM/token/s trên máy demo 16 GB. Không chốt model.
- [ ] TN-01 mới đánh giá tài liệu chính thức về OIDC Enterprise và triển khai React
  dự phòng; chưa chạy Appsmith CE runtime. Cần đội review/chấp nhận ADR 0004.
- [ ] Chưa push, mở PR, chạy GitHub Actions, tạo Projects/Milestone/Issue hoặc release/tag.
- [ ] Chưa gửi Telegram cho BTC và chưa có câu trả lời hạn nộp.

## Tiếp tục nghiệm thu

1. Có Docker Linux containers: làm theo [cài đặt](cai-dat.md), chạy `node scripts/dxdesk.mjs up`.
2. Chạy `node scripts/stack-test.mjs --restart-n8n`; kiểm trình duyệt bằng user mẫu.
3. Chạy `up` lần hai rồi `node scripts/stack-test.mjs --verify-preserved` để kiểm dữ liệu cũ.
4. Có `psql` và `sh`: chạy lại `node tools/testing/migration-test.mjs` trên môi trường đích.
5. Đo TN-05 trên máy demo theo [ADR 0005](adr/0005-tn05-tai-nguyen.md).
6. Cập nhật checkbox trong kế hoạch; sau review/CI mới thực hiện checklist phát hành.

Có thể tạo gói review cục bộ bằng `node scripts/package-review.mjs`. Gói chỉ gồm
mã nguồn không bị Git ignore và bằng chứng đã chọn, có SHA-256 và nhãn
**review snapshot, chưa phải release**. Không chứa `.env`, dependency hay Git history.
