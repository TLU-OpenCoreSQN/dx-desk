# 0001. APISIX chạy chế độ standalone

- Trạng thái: Đã chốt
- Ngày: 19/10/2026
- Người ghi: TV1 (Nền tảng và DevOps)

## Bối cảnh

Apache APISIX là cổng API, điểm vào duy nhất của Tầng 1 (`http://localhost:9080`). Mọi lời gọi tới PostgREST (`/rest/`) và webhook n8n (`/webhook/`) đều đi qua đây.

APISIX có hai cách lưu cấu hình route và plugin:

- **Chế độ truyền thống**: cấu hình nằm trong etcd, thay đổi qua Admin API hoặc APISIX Dashboard.
- **Chế độ standalone**: cấu hình đọc từ tệp YAML, không cần etcd.

Ràng buộc của dự án:

- Kế hoạch triển khai yêu cầu route và plugin APISIX được xuất ra tệp và lưu trong kho (tiêu chí PoF: cấu hình dạng mã).
- Người ngoài đội phải dựng được hệ thống từ máy sạch bằng `cp .env.example .env && make up`, không sửa tay tệp nào khác.
- Tầng 1 đã có 7 dịch vụ; đội chỉ có 3 người và hạn chót nộp bài là 06/12/2026.

## Quyết định

Chạy APISIX ở chế độ standalone với `config_provider: yaml`.

- `infra/apisix/config.yaml`: `deployment.role: data_plane`, `config_provider: yaml`.
- `infra/apisix/apisix.yaml`: toàn bộ route và plugin. Tệp phải kết thúc bằng dòng `#END`.
- Hai tệp được bind-mount chỉ đọc vào container `apisix` (`infra/compose/docker-compose.yml`). Image ghim phiên bản qua `APISIX_VERSION` (hiện là `3.19.0-debian`).
- Không chạy etcd, không mở Admin API.

## Phương án đã xem xét

| Phương án | Ưu điểm | Nhược điểm | Kết luận |
|---|---|---|---|
| Truyền thống (etcd + Admin API) | Sửa route khi đang chạy, có Dashboard | Thêm dịch vụ etcd; cấu hình nằm trong CSDL chứ không nằm trong kho; phải có bước nạp route sau `make up` | Loại |
| Standalone (YAML) | Không thêm dịch vụ; route là tệp được review qua pull request; `make reset` về đúng trạng thái trong kho | Không có Admin API và Dashboard; sửa route phải sửa tệp | Chọn |

## Kết quả

- Tầng 1 chạy với 7 dịch vụ ở trạng thái healthy (commit `9b1f401`), trong đó có `apisix`.
- Ba route hiện có: `healthz` (plugin `mocking`, dùng cho healthcheck), `rest` (rewrite `/rest/*` sang `postgrest:3000`), `n8n-webhook` (`/webhook/*` sang `n8n:5678`).
- Healthcheck của container gọi `/healthz` qua `/dev/tcp` của bash, vì image APISIX không có `curl`.

## Hệ quả

- **Thay đổi route đi theo quy trình thông thường**: sửa `infra/apisix/apisix.yaml`, mở pull request, CI kiểm tra. Không ai sửa route trực tiếp trên môi trường chạy được.
- **Công việc W3-07** (openid-connect, giới hạn tần suất, nhật ký) cũng là sửa `apisix.yaml`, không cần Admin API.
- **Mất Dashboard**: đội không có giao diện để xem hay sửa route. Phải xem trực tiếp tệp YAML.
- **Cú pháp YAML sai làm hỏng cả cổng** thay vì chỉ một route; cần kiểm tra tệp trước khi gộp (mục việc cần làm bên dưới).
- **Không chia sẻ cấu hình giữa nhiều nút APISIX**: chấp nhận được vì sản phẩm dự thi chỉ chạy một nút. Nếu sau này cần mở rộng ngang, phải xem lại quyết định này bằng ADR mới.
- **Kiểm tra token chưa nằm ở APISIX**: hiện APISIX chỉ định tuyến và chuyển token nguyên vẹn, PostgREST tự kiểm tra chữ ký (xem `scripts/sync-jwks.sh`). Việc chuyển phần này sang APISIX thuộc W3-07, không thuộc quyết định này.

## Việc cần làm / chưa kiểm chứng

- Thêm bước kiểm tra cú pháp `apisix.yaml` vào CI.

## Biên bản thử nạp lại cấu hình (20/10/2026)

Môi trường: Docker Desktop trên Windows 11, APISIX 3.19.0, tệp `apisix.yaml` bind-mount chỉ đọc. Mỗi lần thử thêm hoặc bỏ một route tạm `/reload-test` (plugin `mocking`) rồi gọi `GET http://localhost:9080/reload-test`, không khởi động lại container.

| Cách sửa tệp | Kết quả | Thời gian có hiệu lực |
|---|---|---|
| Ghi đè nội dung tại chỗ (giữ nguyên inode) | Route xuất hiện; nhật ký có `config file ... apisix.yaml reloaded` | khoảng 0,5 giây |
| Gỡ route bằng ghi đè tại chỗ | Trả về 404 trở lại | khoảng 0,6 giây |
| Ghi tệp tạm rồi đổi tên thay tệp gốc (inode mới, giống nhiều trình soạn thảo) | Route xuất hiện | khoảng 1 giây |
| Gỡ route bằng cách thay tệp như trên | Trả về 404 trở lại | khoảng 1 giây |

Kết luận: sửa `infra/apisix/apisix.yaml` có hiệu lực sau chừng một giây, không cần `docker compose restart apisix`, kể cả khi trình soạn thảo thay tệp bằng inode mới. Chỉ thử được một route tạm; chưa thử trên Linux hay macOS và chưa thử khi tệp có lỗi cú pháp. Sau thử nghiệm đã khôi phục `apisix.yaml` về đúng nội dung trong kho (`git diff` trống).
