# Nhật ký thay đổi

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm
- W2-06: bảy bảng nghiệp vụ, dữ liệu tham chiếu, RLS dùng chung, audit tạo ticket, migration ledger/checksum.
- W2-07: API NestJS/TypeScript, JWT Keycloak/JWKS, transaction claims và kiểm thử TN-02 bằng PostgreSQL/PostgREST thật.
- W2-08: web React/Vite/Tailwind, OIDC PKCE, danh sách/tạo/chi tiết yêu cầu và trang xin thiết bị tối thiểu.
- Route APISIX cho web/API, audience mapper, Dockerfile ứng dụng và lệnh vận hành Windows bằng Node.
- Script nghiệm thu stack, kiểm tra n8n restart và công cụ đo RAM/tốc độ Ollama TN-05.
- ADR 0002–0006, OpenAPI, tài liệu dữ liệu/cài đặt/demo và kế hoạch tuần 2 có checklist.
- CI build/test thực cho API/web, job TN-02 và nghiệm thu stack. Kết quả CI cần chạy trên GitHub sau push.

### Sửa
- Lấy JWKS trước khi bật PostgREST; quoting thông tin role/database bằng biến psql.
- Kiểm issuer/exp ở pre-request PostgREST để đồng nhất với API.

### Nền tảng có sẵn
- Khung kho mã: giấy phép Apache-2.0, REUSE, README, CONTRIBUTING, mẫu Issue và pull request.
- Docker Compose Tầng 1: Keycloak, APISIX (standalone), PostgreSQL, PostgREST, SeaweedFS, ClamAV, n8n; `Makefile` với `make up`, `down`, `reset`.
- Realm Keycloak `dxdesk` với ba vai trò Employee/Agent/Manager, người dùng mẫu và ba client.
- Nạp tự động workflow n8n mẫu khi khởi chạy.
- GitHub Actions: `reuse lint` và kiểm tra Docker Compose.
- `scripts/check-apisix.sh` và job CI `kiểm tra apisix.yaml`: nạp `apisix.yaml` bằng image APISIX, báo lỗi nếu thiếu `#END`, sai cú pháp, sai schema route hoặc route không được nạp.
- ADR 0001 (APISIX standalone).
