# DX-Desk

Hệ thống tiếp nhận và tự động xử lý yêu cầu IT nội bộ, xây dựng trên nền tảng DX-OS Open-Core theo mô hình H-P-D-I.
Sản phẩm dự thi Olympic Tin học Sinh viên Việt Nam 2026, nội dung Phần mềm nguồn mở (đội TLU-OpenCoreSQN, Trường Đại học Thủy lợi).

> Trạng thái: **v0.1.0 (đang phát triển)** – mới có Tầng 1 (nền tảng). Ứng dụng DX-Desk và ứng dụng "Xin cấp thiết bị" sẽ bổ sung ở các tuần sau.

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

- Docker Engine và Docker Compose v2 (đang kiểm thử với Docker 29, Compose 5)
- GNU Make
- Khoảng 4 GB RAM trống cho Tầng 1 (ClamAV chiếm nhiều nhất); chưa tính dịch vụ AI

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
| `apps/` | Ứng dụng Tầng 2 (web, api, assistant, device-request) |
| `scripts/` | Script hỗ trợ `make up` |
| `docs/` | Tài liệu và quyết định kiến trúc (`docs/adr/`) |

## Giấy phép

Mã nguồn của đội phát hành theo [Apache License 2.0](LICENSE). Mỗi tệp mang thông tin giấy phép theo chuẩn [REUSE](https://reuse.software/).
Các thành phần bên thứ ba chạy dưới dạng image Docker chính thức, xem [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md). Báo lỗi hoặc đề xuất qua GitHub Issues.
