# Nội dung bảng việc GitHub tuần 2

Bản chuẩn bị để nhập vào Issues/Projects; chưa có nghĩa là Issue đã được tạo.
Nguyên quản lý Milestone `v0.1.0 — 25/10/2026`.
Projects nên có cột: Backlog → Đang làm → Chờ review → Chờ nghiệm thu → Xong.
Link issue/PR/CI được điền vào `ke-hoach-tuan-2.md` sau khi tạo thật.

## W2-01 — Khung kho mã và bảng việc

Nguyên chính, Quyền hỗ trợ. Nhãn: `w2`, `PoF`.
- [ ] LICENSE/REUSE/README/CHANGELOG/CONTRIBUTING và templates đầy đủ.
- [ ] Có Issues, Projects, milestone và phân công đủ 12 việc.
- [ ] Review bằng danh sách PoF; kho truy cập công khai.

## W2-02 — CI build, test, REUSE

Nguyên chính, Quyền hỗ trợ. Nhãn: `w2`, `nền tảng`, `PoF`.
- [ ] Build/test API và web bằng lockfile.
- [ ] REUSE, Compose, APISIX, shellcheck, TN-02 và stack CI chạy.
- [ ] PR được duyệt và CI xanh trên commit sẽ gộp.

## W2-03 — Tầng 1 và ứng dụng chạy một lệnh

Nguyên chính, Quyền hỗ trợ. Nhãn: `w2`, `nền tảng`.
- [ ] Người khác clone, copy .env, chạy up, dịch vụ healthy.
- [ ] Các image ghim phiên bản; không phơi database/S3/ClamAV ra host.
- [ ] Up lần hai giữ dữ liệu, migration không chạy trùng.

## W2-04 — Import workflow và credentials n8n

Nguyên chính, Quyền hỗ trợ. Nhãn: `w2`, `P`.
- [ ] Workflow hello tự import/publish và trả JSON qua APISIX.
- [ ] Webhook còn chạy sau restart.
- [ ] Có quy trình credentials, không lưu secret vào Git.
- [ ] ADR 0006 và log kiểm chứng.

## W2-05 — Realm Keycloak

Nguyên chính, Séc hỗ trợ. Nhãn: `w2`, `H`.
- [ ] Có 3 vai trò, 4 user mẫu, client web/API/Appsmith.
- [ ] Web PKCE và token audience đúng.
- [ ] Import vào môi trường mới, login thực, logout redirect hoạt động.

## W2-06 — Schema v1 và RLS

Quyền chính, Nguyên hỗ trợ. Nhãn: `w2`, `D`.
- [ ] Đủ 7 bảng, constraint/index/reference seed.
- [ ] Migration tự động, có checksum, không sửa lịch sử đã áp dụng.
- [ ] Test RLS, fake owner/state, Critical và audit.
- [ ] ADR 0002 và tài liệu dữ liệu.

## W2-07 — NestJS API và TN-02

Quyền chính, Séc hỗ trợ. Nhãn: `w2`, `P`, `D`.
- [ ] JWT/JWKS, database login riêng, claims trong transaction.
- [ ] API và PostgREST dùng cùng chính sách, kiểm thử tự động.
- [ ] Rollback và connection pool không lẫn danh tính.
- [ ] OpenAPI, ADR 0003, log kiểm chứng và giới hạn môi trường.

## W2-08 — React và OIDC

Séc chính, Nguyên hỗ trợ. Nhãn: `w2`, `H`.
- [ ] React/Vite/Tailwind, đăng nhập Keycloak bằng PKCE.
- [ ] API qua APISIX, token memory và refresh/logout đúng.
- [ ] Loading/empty/error/offline và responsive, không hiển thị dữ liệu giả.
- [ ] Build, tests, browser smoke và demo đăng nhập thật.

## W2-09 — TN-01 / QĐ-1

Séc chính, Quyền hỗ trợ. Nhãn: `w2`, `P`.
- [ ] Đối chiếu yêu cầu Appsmith CE với tài liệu và runtime khả dụng.
- [ ] Không dùng tài khoản chung để lách yêu cầu token người dùng.
- [ ] Ghi quyết định React fallback hoặc bằng chứng Appsmith đạt.
- [ ] ADR 0004 phân biệt rõ kiểm chứng tài liệu với chạy thực tế.

## W2-10 — TN-05 vòng 1

Séc chính, Nguyên hỗ trợ, Quyền phối hợp. Nhãn: `w2`, `I`.
- [ ] Đo RAM Tầng 1 khi healthy, model 1.5B/3B/4B trên máy demo 16 GB.
- [ ] Có metadata máy, digest model, warmup, ba lượt đo và đơn vị.
- [ ] JSON/CSV và ADR 0005 dùng số liệu thật.

## W2-11 — Xác nhận hạn nộp

Nguyên chính. Nhãn: `w2`, `PoF`.
- [ ] Hỏi BTC qua kênh Telegram của cuộc thi.
- [ ] Lưu câu trả lời và ngày giờ, cập nhật kế hoạch nếu có thay đổi.

## W2-12 — v0.1.0

Nguyên chính, cả đội hỗ trợ. Nhãn: `w2`, `PoF`.
- [ ] Demo 24/10, kiểm thử độc lập, PR đã duyệt và CI xanh.
- [ ] CHANGELOG/release notes đúng tính năng đã làm và giới hạn.
- [ ] Tag và gói `.tar.gz` khớp commit đã nghiệm thu.
- [ ] GitHub Release và báo cáo thầy ngày 25/10.
