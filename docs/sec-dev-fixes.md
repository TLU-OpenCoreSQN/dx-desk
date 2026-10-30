# Các bản sửa sau review source

Phạm vi: sửa 11 phát hiện kỹ thuật trong review ngày 30/10/2026.
Đây không phải biên bản hoàn thành toàn bộ M2/tuần 3.

## Workflow và dữ liệu ticket — R01, R02, R03, R08, R10

- Migration 005 giữ nguyên checksum lịch sử, kiểm trạng thái khởi tạo và fields tại DB.
  Employee tạo access chỉ được vào pending_approval, kể cả gọi thẳng PostgREST.
- Thu hồi quyền ghi các cột SLA/thời gian; ghi chú chỉ được ghi khi resolve.
  Reopen xóa note hiện tại, event resolved giữ kết quả của từng vòng xử lý.
- Màn chi tiết hiện fields, nhãn danh mục, kết quả và note lịch sử riêng biệt;
  dữ liệu cũ không đúng kiểu không làm hỏng trang, giá trị text được React escape.
- Integration có test âm trực tiếp REST; migration harness kiểm cả nâng từ schema
  tuần 2 có ticket/audit cũ, ngoài bootstrap/checksum/rollback.

## Lưu tệp — R04, R09

- Dùng đúng Filer HTTP 8888, khai báo listener tường minh và chờ health Filer.
- Migration 006 thêm begin/finish nội bộ. Metadata pending phải commit trước PUT;
  chỉ chuyển clean sau khi store và DB hoàn tất.
- Khi lỗi có DELETE bù trừ tối đa ba lần. Nếu store/DB vẫn lỗi, metadata
  pending/failed giữ object_key để đối soát, không coi tệp đó là sẵn sàng đọc.
- Unit/integration kiểm lỗi trước PUT, lỗi hoàn tất DB, DELETE thất bại và metadata
  còn giữ key. Stack test kiểm ClamAV thật chặn EICAR, file sạch được lưu đúng bytes
  trong SeaweedFS, và Employee khác không đọc được metadata.

Chưa bổ sung presigned GET hoặc upload UI trong đợt sửa này; đó là các chức năng
chưa triển khai của M2, không phải kết quả đã được đóng bằng bản sửa endpoint.

## Khởi động và xác thực — R06, R07, R11

- Make và Node dùng cùng runner up, gồm restart/ready check PostgREST và APISIX.
  CI khởi động lần đầu qua Node, lần hai qua Make và kiểm dữ liệu được giữ.
- Overlay OTP resolve tệp realm theo base Compose. CI/check-config kiểm overlay
  và đường dẫn tồn tại; bật enrollment vẫn cần user/realm phù hợp như hướng dẫn.
- Native SSO harness nhập đầy đủ trường VPN và gửi payload Critical hợp lệ.
  Các kết quả native SSO lịch sử không được tự suy thành nghiệm thu OTP hiện tại.
- Tài liệu ghi đúng JWT đang được kiểm tại API/PostgREST, không phải plugin gateway.

## Dependency — R05

Giữ NestJS 11, ghim override body-parser 2.4.0 và multer 2.5.0 để xử lý advisory,
không tự nâng major framework. Lockfile được cập nhật và npm ci chạy lại.
CI kiểm audit production mức High cùng build/test cho API và web.

## Kiểm chứng

Các kiểm tra cục bộ đã chạy trong đợt sửa: API 43 unit, web 66 unit, integration
15 test trên PostgreSQL/PostgREST thật, migration 5 nhóm kiểm và browser fixture
7 nhóm. Audit API sau cập nhật trả 0 vulnerabilities.

Job stack CI là nơi nghiệm thu Linux containers và EICAR thật trên cùng SHA;
chỉ dùng kết quả run thực tế để kết luận runtime. Máy cục bộ đã dựng được stack,
nhưng lượt nghiệm thu bị timeout đăng nhập khi thiếu RAM, không ghi nhận là PASS.

Chạy lại:

~~~sh
npm ci --prefix apps/api
npm test --prefix apps/api
npm audit --prefix apps/api --omit=dev --audit-level=high
npm ci --prefix apps/web
npm run build --prefix apps/web
npm test --prefix apps/web
npm ci --prefix tools/testing
node tools/testing/run-integration.mjs
node tools/testing/migration-test.mjs
node tools/testing/browser-smoke.mjs
node tools/testing/check-config.mjs
~~~

Migration runner cần psql và sh; browser cần Chromium của Playwright.
Không sửa migration đã áp; giữ backup và dùng migrate/up thay vì reset dữ liệu.
