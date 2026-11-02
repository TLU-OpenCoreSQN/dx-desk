# Nhật ký thay đổi

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]

## [0.1.0] - 2026-11-02

### Thêm
- W2-06: bảy bảng nghiệp vụ, dữ liệu tham chiếu, RLS dùng chung, audit tạo ticket, migration ledger/checksum.
- W2-07: API NestJS/TypeScript, JWT Keycloak/JWKS, transaction claims và kiểm thử TN-02 bằng PostgreSQL/PostgREST thật.
- W2-08: web React/Vite/Tailwind, OIDC PKCE, danh sách/tạo/chi tiết yêu cầu và trang xin thiết bị tối thiểu.
- Route APISIX cho web/API, audience mapper, Dockerfile ứng dụng và lệnh vận hành Windows bằng Node.
- Script nghiệm thu stack, kiểm tra n8n restart và công cụ đo RAM/tốc độ Ollama TN-05.
- ADR 0002–0006, OpenAPI, tài liệu dữ liệu/cài đặt/demo và kế hoạch tuần 2 có checklist.
- CI build/test thực cho API/web, job TN-02 và nghiệm thu stack. Kết quả CI cần chạy trên GitHub sau push.
- W3-01/02/09: máy trạng thái ticket 8 trạng thái với `PATCH /api/tickets/:id/status`, Poka-yoke (Critical chỉ Manager, access vào pending_approval, trường bắt buộc theo danh mục, resolution note) ở cả API và DB; test RLS/máy trạng thái trong CI.
- W3-03: lưu `sla_due_at` lúc tạo, cộng dồn thời gian chờ người dùng, reopen giữ hạn gốc.
- W3-04/05: form tạo ticket có trường động theo danh mục và tệp đính kèm, màn chi tiết có dòng thời gian, kết quả xử lý và nút chuyển trạng thái theo vai trò.
- W3-06: đính kèm quét ClamAV trước khi lưu SeaweedFS, tải tệp bằng URL ký HMAC hạn 120 giây (ADR 0007, 0009); migration 004, 006, 007.
- W3-07: APISIX kiểm JWT RS256/issuer/audience bằng public key đồng bộ từ Keycloak, rate limit cho `/api` và `/rest`; realm OTP tùy chọn.
- W3-08: PoC TN-04 cho Wiki.js, Mattermost Team Edition và Metabase OSS (ADR 0008), có job CI runtime riêng.
- CI 12 job, gồm nghiệm thu stack thật với browser OTP, EICAR và khởi động lần hai bằng `make up`.
- W4: outbox sự kiện bền vững có lease, tối đa 8 lần thử rồi quarantine, replay bằng `scripts/replay-outbox.mjs`; workflow n8n `ticket-events`/`ticket-sla` (#12).
- W4: định tuyến tự động theo team, roster đồng bộ từ Keycloak, Agent nhận phiếu bằng `POST /tickets/:id/claim`, `expected_version` chống ghi đè; migration 008–011 (#12).
- W4: nhắc SLA ở 80% và đánh dấu `sla_breached`, thông báo vào kênh Mattermost riêng của nhóm hỗ trợ (#12).
- W4: bảng việc Agent `/work-queue` và hàng đợi phê duyệt Manager `/approvals`; endpoint service `/system/*` dùng client `dxdesk-automation` và guard riêng (#12).
- W4: seed dữ liệu tổng hợp `scripts/seed-synthetic.mjs` (mặc định dry-run) và đo tài nguyên `scripts/benchmark-stack.mjs`; kiểm thử `week4-stack`/`week4-browser` (#12).
- Giao diện web mới: header/sidebar, trang danh sách và chi tiết phiếu, chủ đề sáng/tối tùy chỉnh.

### Sửa
- Sau review: bảo vệ trạng thái khởi tạo, trường động, SLA và kết quả xử lý trên cả API/PostgREST; giữ note từng lần resolve và hiển thị dữ liệu trên chi tiết.
- Sửa Filer listener, ghi intent upload trước PUT và DELETE bù trừ khi lỗi; thêm nghiệm thu ClamAV/SeaweedFS thật trong stack test.
- Dùng chung runner cho Make/Node, sửa mount OTP và dữ liệu kiểm thử native SSO.
- Vá body-parser/multer bằng override có lockfile; thêm audit production trong CI. Xem docs/sec-dev-fixes.md.
- Lấy JWKS trước khi bật PostgREST; quoting thông tin role/database bằng biến psql.
- Kiểm issuer/exp ở pre-request PostgREST để đồng nhất với API.
- Restart APISIX sau mỗi lần `up` để cổng không giữ IP cũ của container api (flake CI #10).
- Giữ mã lỗi 4xx của client thay vì trả 500, chặn tệp vượt giới hạn kích thước ở cả cổng và API (#12).
- Gateway chỉ công khai webhook hello PoC; webhook nghiệp vụ chỉ gọi trong mạng Compose và kiểm secret (#12).
- Chủ đề, bố cục responsive và điều khiển truy cập được (aria) trên web (#12).
- Browser smoke khớp giao diện mới: trường động theo danh mục, nút gửi, chọn loại thiết bị (#13).

### Nền tảng có sẵn
- Khung kho mã: giấy phép Apache-2.0, REUSE, README, CONTRIBUTING, mẫu Issue và pull request.
- Docker Compose Tầng 1: Keycloak, APISIX (standalone), PostgreSQL, PostgREST, SeaweedFS, ClamAV, n8n; `Makefile` với `make up`, `down`, `reset`.
- Realm Keycloak `dxdesk` với ba vai trò Employee/Agent/Manager, người dùng mẫu và ba client.
- Nạp tự động workflow n8n mẫu khi khởi chạy.
- GitHub Actions: `reuse lint` và kiểm tra Docker Compose.
- `scripts/check-apisix.sh` và job CI `kiểm tra apisix.yaml`: nạp `apisix.yaml` bằng image APISIX, báo lỗi nếu thiếu `#END`, sai cú pháp, sai schema route hoặc route không được nạp.
- ADR 0001 (APISIX standalone).

[Chưa phát hành]: https://github.com/TLU-OpenCoreSQN/dx-desk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TLU-OpenCoreSQN/dx-desk/releases/tag/v0.1.0
