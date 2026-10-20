# Nhật ký thay đổi

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm
- Khung kho mã: giấy phép Apache-2.0, REUSE, README, CONTRIBUTING, mẫu Issue và pull request.
- Docker Compose Tầng 1: Keycloak, APISIX (standalone), PostgreSQL, PostgREST, SeaweedFS, ClamAV, n8n; `Makefile` với `make up`, `down`, `reset`.
- Realm Keycloak `dxdesk` với ba vai trò Employee/Agent/Manager, người dùng mẫu và ba client.
- Nạp tự động workflow n8n mẫu khi khởi chạy.
- GitHub Actions: `reuse lint` và kiểm tra Docker Compose.
- `scripts/check-apisix.sh` và job CI `kiểm tra apisix.yaml`: nạp `apisix.yaml` bằng image APISIX, báo lỗi nếu thiếu `#END`, sai cú pháp, sai schema route hoặc route không được nạp.
- ADR 0001 (APISIX standalone).
