# Hoàn thiện tuần 3 — 30/10/2026

Nhánh `week3-complete` kế thừa `sec-dev` (PR #4). PR tuần 3 so với `sec-dev`
chỉ chứa phần mới, không tự merge PR nền. Đối chiếu W3-01…W3-09/M2:

| Mã | Khoảng thiếu đã xử lý |
|---|---|
| W3-01/02/09 | Test 17 cạnh × 3 vai trò × chủ/không chủ × API/REST; không đổi row/audit khi bị từ chối; hai chuyển tiếp xung đột chỉ một thành công; lỗi audit rollback status |
| W3-03 | Nhiều lần waiting/cancel cộng pause; reopen giữ due date gốc; helper tính cả pause đang mở và không xóa breach có từ trước |
| W3-04 | Chọn ảnh/tệp, tạo ticket rồi upload; upload lỗi giữ ID để retry, không tạo phiếu trùng |
| W3-05 | Metadata/trạng thái quét và tải file clean; đủ mọi nút DB cho phép, kể cả staff tự tạo phiếu; fields/kết quả đã có trong PR #4 |
| W3-06 | URL ký HMAC cùng origin hạn 120 giây; RLS khi cấp, clean khi cấp/đọc; kiểm chữ ký/expiry/ID; stream Filer nội bộ, attachment/nosniff/no-store; kiểm file sau startup lần hai |
| W3-07 | Gateway kiểm RS256/issuer/audience bằng public key đã sync; rate limit cả API/REST; kiểm runtime 429/413; browser enrollment và đăng nhập OTP đúng/sai/cũ |
| W3-08 | PoC Wiki.js 2.5.315, Mattermost **Team Edition** 12.0.1, Metabase **OSS** 0.64.3; bootstrap/login/module Keycloak và fallback webhook/tài khoản nội bộ |

Migration 001…006 giữ nguyên; chỉ thêm 007. Quyền Agent/Manager duyệt, Manager từ
chối về new, assigned_to chưa phân công thật giữ theo contract, không tự đổi nghiệp vụ.

SLA 24/7: deadline hiệu lực = due_at + pause đã chốt + phần chờ đang mở
(`max(0, now-waiting_since)`). DB cộng pause khi thoát waiting_user. Chờ sau khi
đã breach không xóa breach. Pending approval vẫn tính SLA; reopen tiếp tục deadline
cũ. pg trả bigint dạng chuỗi: consumer chuyển Number trong giới hạn safe integer.
Giờ hành chính, response_minutes và dashboard breach thuộc tuần 4.

## Kiểm chứng

Đã chạy tại máy: API 44 unit, web 70 unit, integration 19 nhóm PostgreSQL/PostgREST
thật, browser fixture 7 nhóm, gateway container thật 6 nhóm, build web/check-config.
Clamd/Filer trong integration là giả để kiểm lỗi; chỉ job stack/browser stack được
coi là engine/store thật. CI có 12 job: 9 nền và 3 PoC TN-04. Job stack chạy Node
up, CLI, browser, Make up rồi kiểm dữ liệu/tệp còn nguyên. Artifact JSON/ảnh không
lưu token, password, TOTP secret hay URL ký. **Chỉ kết luận đạt runtime khi job của
đúng SHA success**, không lấy sự tồn tại của script làm bằng chứng đã chạy.

~~~sh
npm test --prefix apps/api
npm run build --prefix apps/web
npm test --prefix apps/web
node tools/testing/run-integration.mjs
node tools/testing/migration-test.mjs
node tools/testing/browser-smoke.mjs
node tools/testing/gateway-test.mjs
node tools/testing/check-config.mjs
# Cần stack Docker, .env và Chromium của tools/testing:
node scripts/dxdesk.mjs up
node scripts/stack-test.mjs --restart-n8n
node tools/testing/stack-browser.mjs
make up
node scripts/stack-test.mjs --verify-preserved
~~~

PoC chạy từng profile, project riêng, chỉ localhost, không nối DB ticket:

~~~sh
export TN04_PROJECT=dxdesk-tn04-wikijs
docker compose -p "$TN04_PROJECT" -f infra/compose/tn04.yml --profile wikijs up -d
node tools/testing/tn04-runtime.mjs wikijs
docker compose -p "$TN04_PROJECT" -f infra/compose/tn04.yml --profile wikijs down -v
~~~

Thay cả project/profile/argument bằng mattermost hoặc metabase. Metabase H2 chỉ
dùng PoC tạm. Full Wiki.js SSO, nhóm/quyền Wiki, n8n→Mattermost và báo cáo có phạm
vi dữ liệu là tích hợp tuần 4 theo ADR 0008; bootstrap không phải tích hợp sản phẩm.

## Còn cần người/môi trường nghiệm thu

- Review PR và demo độc lập bởi thành viên khác; không tự ký thay người review.
- TN-05 trên máy demo 16 GB, gồm peak upload/browser/ứng dụng nền; CI không thay thế.
- Xác nhận BTC về giấy phép/phạm vi n8n; PoC chạy được không thay thế xác nhận.
- Tag/release sau quyết định merge/snapshot. Đợt này tạo PR, chưa merge/tag.

Không tick các mục này bằng việc CI xanh.
