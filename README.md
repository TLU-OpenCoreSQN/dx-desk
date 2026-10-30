# DX-Desk

Hệ thống tiếp nhận và tự động xử lý yêu cầu IT nội bộ, xây dựng trên nền tảng DX-OS Open-Core theo mô hình H-P-D-I.
Sản phẩm dự thi Olympic Tin học Sinh viên Việt Nam 2026, nội dung Phần mềm nguồn mở (đội TLU-OpenCoreSQN, Trường Đại học Thủy lợi).

> Trạng thái: **chuẩn bị v0.1.0 — tuần 2**. Có Tầng 1, schema/RLS, khung API NestJS
> và web React. Kết quả kiểm chứng và các việc chưa nghiệm thu được cập nhật tại
> [kế hoạch tuần 2](docs/ke-hoach-tuan-2.md). Chưa coi đây là bản đã phát hành.

## Tầng 1 gồm những gì

| Dịch vụ | Vai trò | Cách truy cập từ máy chủ |
|---|---|---|
| Keycloak | Định danh, SSO, OTP | http://localhost:8080 |
| Apache APISIX | Cổng API (điểm vào duy nhất) | http://localhost:9080 |
| PostgreSQL + PostgREST | Dữ liệu có cấu trúc và REST API | qua APISIX: `/rest/` |
| SeaweedFS | Kho tệp, tương thích S3 | chỉ trong mạng nội bộ |
| ClamAV | Quét mã độc tệp tải lên | chỉ trong mạng nội bộ |
| n8n | Tự động hóa quy trình | qua APISIX: `/webhook/` |

## Yêu cầu

- Docker Engine và Docker Compose v2; cấu hình đã kiểm bằng Compose 2.40.3.
- Node.js >=22.12 cho runner đa nền tảng; GNU Make là giao diện lệnh tùy chọn dùng chung runner.
- Máy demo mục tiêu 16 GB RAM; mức sử dụng thực tế sẽ được đo trong TN-05.

## Chạy từ mã nguồn

```bash
git clone https://github.com/TLU-OpenCoreSQN/dx-desk.git
cd dx-desk
cp .env.example .env     # chỉnh mật khẩu nếu chạy ngoài máy cá nhân
make up                  # dựng Tầng 1, chờ tất cả dịch vụ healthy
make ps                  # xem trạng thái
```

Các lệnh khác: `make down` (dừng, giữ dữ liệu), `make reset` (xóa dữ liệu và dựng lại từ đầu), `make logs SERVICE=keycloak`.
Lần đầu ClamAV cần vài phút để tải cơ sở dữ liệu mẫu virus.

Trên Windows PowerShell, có Docker Desktop chạy Linux containers:

```powershell
Copy-Item .env.example .env
node scripts/dxdesk.mjs up
node scripts/dxdesk.mjs verify
```

Web: **http://localhost:9080**. Đăng nhập qua Keycloak rồi tạo/xem yêu cầu IT,
xem lịch sử và tạo yêu cầu thiết bị tối thiểu. Frontend dùng React/TypeScript,
Vite, Tailwind; backend NestJS/TypeScript; database PostgreSQL.
Mọi request web đi qua APISIX. Employee chỉ xem dữ liệu của mình, Agent/Manager
đọc dữ liệu hỗ trợ, Critical chỉ dành cho Manager.

Tài liệu: [cài đặt](docs/cai-dat.md), [dữ liệu](docs/du-lieu.md),
[hợp đồng API](docs/api/contract.md), [OpenAPI](docs/api/openapi.yaml),
[demo tuần 2](docs/demo-tuan-2.md), [ADR](docs/adr/README.md).
Kết quả đã chạy và phần còn thiếu: [báo cáo kiểm thử tuần 2](docs/bao-cao-kiem-thu-tuan-2.md).

## Kiểm thử

```sh
npm ci --prefix apps/api
npm test --prefix apps/api
npm ci --prefix apps/web
npm run build --prefix apps/web
npm test --prefix apps/web
npm ci --prefix tools/testing
npm run integration --prefix tools/testing
```

Integration dùng PostgreSQL portable và PostgREST thật, không cần Docker.
Nghiệm thu đầy đủ Keycloak/APISIX/n8n cần Docker:
`node scripts/stack-test.mjs --restart-n8n`.
Các số đo TN-05 được tạo bằng `node scripts/benchmark.mjs` khi có máy demo.

## Kiểm tra nhanh

```bash
# Cổng API sống
curl http://localhost:9080/healthz

# Workflow n8n mẫu (nạp tự động khi make up)
curl http://localhost:9080/webhook/dxdesk-hello

# Lấy token của người dùng mẫu rồi gọi PostgREST qua APISIX
TOKEN=$(curl -s -X POST http://localhost:8080/realms/dxdesk/protocol/openid-connect/token \
  -d grant_type=password -d client_id=dxdesk-web \
  -d username=employee.a -d password='DxDesk@2026' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -H "Authorization: Bearer $TOKEN" http://localhost:9080/rest/
```

Người dùng mẫu (chỉ dùng cho phát triển): `employee.a`, `employee.b`, `agent.1`, `manager.1`, cùng mật khẩu `DxDesk@2026`.
Tài khoản quản trị Keycloak nằm trong `.env`.

## Cấu trúc kho mã

| Thư mục | Nội dung |
|---|---|
| `infra/compose` | `docker-compose.yml` của Tầng 1 |
| `infra/keycloak`, `infra/apisix`, `infra/n8n`, `infra/postgres` | Cấu hình dạng mã: realm, route, workflow, khởi tạo CSDL |
| `db/migrations`, `db/policies` | Lược đồ CSDL và chính sách RLS (chạy khi khởi tạo PostgreSQL) |
| `apps/web`, `apps/api` | React và NestJS tuần 2; trang thiết bị dùng chung web |
| `apps/assistant`, `apps/device-request` | Giữ chỗ cho các mốc sau; không phải dịch vụ đã chạy |
| `tools/testing` | Harness PostgreSQL portable + PostgREST và kiểm tra cấu hình |
| `scripts/` | Script hỗ trợ `make up` |
| `docs/` | Tài liệu và quyết định kiến trúc (`docs/adr/`) |

## Giấy phép

Mã nguồn của đội phát hành theo [Apache License 2.0](LICENSE). Mỗi tệp mang thông tin giấy phép theo chuẩn [REUSE](https://reuse.software/).
Các thành phần bên thứ ba chạy dưới dạng image Docker chính thức, xem [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md). Báo lỗi hoặc đề xuất qua GitHub Issues.
