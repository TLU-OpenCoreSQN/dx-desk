# 0007. Vị trí quét ClamAV cho tệp đính kèm

- Trạng thái: Đã chốt (QĐ-3) — chờ kiểm chứng runtime bằng EICAR trên stack Docker
- Ngày: 27/10/2026
- Người ghi: TV1 (Nền tảng và DevOps)
- Mã kế hoạch: W3-06, TN-03, QĐ-3

## Bối cảnh

Tuần 3 bổ sung luồng tải tệp đính kèm cho ticket: đối tượng nhị phân nằm trong SeaweedFS (S3), metadata nằm trong bảng `attachments` (`db/migrations/001_schema.sql`): `size_bytes` chốt trần 10 MiB, `object_key`, `content_type` và `scan_status` với bốn giá trị `pending / clean / infected / failed` — thiết kế đã dự phòng chỗ ghi kết quả quét ngay từ tuần 2. ClamAV (`clamav/clamav:1.5.4`) là dịch vụ bắt buộc của Tầng 1 trong `infra/compose/docker-compose.yml`, chưa có ai gọi.

Yêu cầu của đề thi (mục 5.2 W3-06, tiêu chí M2 số 3): "Tải tệp EICAR bị chặn; tệp hợp lệ chỉ mở được bằng URL ký". TN-03 phải trả lời: đặt bước quét virus ở đâu — tại cổng APISIX, tại một dịch vụ đứng trước SeaweedFS, hay trong Service Desk API.

Ràng buộc:

- G4: một máy demo 16 GB RAM chạy toàn bộ Tầng 1 (7+ dịch vụ). clamd giữ nguyên cơ sở dữ liệu virus thường trú trong RAM giữa các lần quét (tài liệu chính thức ClamAV: "clamd is a multi-threaded daemon... Scanning behavior can be fully configured... by modifying clamd.conf" — và mô hình phục vụ của nó là nạp DB một lần rồi quét nhiều tệp, tức mỗi quá trình clamd là một khoản RAM thường trú lớn). Chỉ được phép có đúng MỘT instance clamd.
- Cấu hình là mã nguồn và review qua pull request (ADR 0001): APISIX chạy standalone, không Admin API, mọi thứ đặt trong `infra/apisix/apisix.yaml`.
- Đội 3 người, hạn 06/12/2026; ưu tiên phương án kiểm chứng được bằng EICAR trong CI.

## Cơ sở tài liệu chính thức

- APISIX: mặc định chặn body lớn — tài liệu security-threat-model của Apache APISIX ghi `client_max_body_size` cấp nginx, "default 8KB but the project ships 1m" (1 MiB). Tệp đính kèm trần 10 MiB theo `attachments.size_bytes` VƯỢT trần mặc định này: muốn quét ở cổng phải nâng giới hạn body nginx của chính gateway (plugin `client-control` chính thức cũng chỉ đặt max body size, không quét nội dung). Tìm trên Plugin Hub và tài liệu plugin chính thức (apisix.apache.org, ngày 27/10/2026): không có plugin quét virus/clamd trong danh mục; làm ở cổng nghĩa là tự viết plugin Lua (lua-resty + INSTREAM từng chunk) — ngoài khả năng kiểm chứng của một dự án sinh viên không có Docker tại máy.
- ClamAV: tài liệu ClamD Protocol (docs.clamav.net) — "Path-based scan commands are resolved by clamd, not by the client"; khi client TCP từ xa muốn quét tệp cục bộ của mình thì "streams local file contents with INSTREAM instead of sending local client paths", và "the total streamed size must not exceed StreamMaxLength in clamd.conf". Nghĩa là: quét THEO ĐƯỜNG DẪN đòi hỏi clamd mở được tệp (volume chia sẻ giữa các container), còn quét THEO STREAM chỉ cần TCP 3310 trong mạng compose — không cần tệp tồn tại ở đâu cả. Github Cisco-Talos/clamav (issue #1424) xác nhận INSTREAM được clamd ghi ra tệp tạm rồi quét — chấp nhận được với tệp ≤ 10 MiB.
- SeaweedFS: maintainer xác nhận "There is full support for presigned requests" trong thảo luận chính thức của repository (seaweedfs/discussions/4401) — URL ký có hạn cho upload/download dùng được; điều kiện tiên quyết cho tiêu chí "tệp hợp lệ chỉ mở được bằng URL ký".

## Quyết định

**Chọn phương án (c): Service Desk API quét qua clamd TCP (INSTREAM) trước khi ghi tệp xuống SeaweedFS.**

Luồng chốt (mã ở `apps/api`, do TV2 hiện thực; ghép nối hạ tầng đã nằm trong kho):

1. Trình duyệt gọi `POST /api/tickets/:id/attachments` qua APISIX với body JSON `{file_name, content_type, content_base64}` (tệp nhị phân ≤ 10 MiB theo CHECK của `attachments.size_bytes`; nền base64 phình ~1,33 lần nên JSON tới ~13,98 MB). Đính chính lúc hiện thực W3-06: cổng **không** chuyển tiếp vô hạn — APISIX đóng gói sẵn `client_max_body_size: 1m`, vì vậy `infra/apisix/config.yaml` phải nâng lên `20m`, nếu không tệp hợp lệ bị 413 chặn trước khi clamd kịp quét. API vẫn là nơi sở hữu trần dung lượng nghiệp vụ (10 MiB trên byte đã giải mã) và thứ tự an toàn.
2. API nhận JSON/base64 trong RAM, giải mã Buffer rồi gửi từng chunk qua INSTREAM/TCP
   tới clamd:3310. Đây không phải upload streaming từ browser; engine có thể dùng tệp tạm riêng.
3. clamd báo sạch → ghi intent pending trong DB trước, PUT lên Filer HTTP cổng 8888
   với object_key do server sinh, rồi hoàn tất metadata clean (migration 006).
   EICAR là kết quả nhiễm, không được đi nhánh sạch. Nếu PUT/DB lỗi, thử DELETE bù trừ;
   metadata pending/failed giữ key để đối soát khi dịch vụ chưa cho cleanup thành công.
4. clamd báo nhiễm → API trả 422 kèm mã lỗi tiếng Việt, **không ghi SeaweedFS**, ghi bản ghi audit `scan_status='infected'` (object không tồn tại nên không thể "mở bằng URL ký").
5. clamd không trả lời/lỗi → 503 + `scan_status='failed'`; tệp không được cung cấp khi chưa có kết quả sạch.
6. Đọc tệp: API chỉ phát hành presigned GET URL (hạn ngắn) cho người được quyền theo RLS; SeaweedFS không công bố cổng ra host.

Ghép nối trong kho (đã sửa tuần này): `infra/compose/docker-compose.yml` — dịch vụ `api` có `depends_on: clamav (service_healthy)` và biến `CLAMD_ADDR: "clamav:3310"`; dịch vụ `clamav` ghi chú chỉ nghe TCP 3310 trong mạng nội bộ, không công bố cổng ra host. `infra/apisix/apisix.yaml` — route `/api/*` giữ nguyên không khai báo `methods` để luồng upload/PATCH đi qua; cổng không nhận thêm việc quét.

## Phương án đã xem xét

| Phương án | Ưu điểm | Nhược điểm | Kết luận |
|---|---|---|---|
| (a) Plugin APISIX quét thân request | Chặn sớm nhất, một điểm vào | Không có plugin ClamAV chính thức (Plugin Hub 27/10/2026); trần body mặc định 1 MiB của APISIX phải nâng cho đúng tệp 10 MiB, mọi lưu lượng upload đè lên gateway; tự viết plugin Lua không kiểm chứng được tại máy (không Docker); đi ngược triết lý "cổng mỏng" của ADR 0001 | Loại |
| (b) Dịch vụ quét đứng trước SeaweedFS | Tách trách nhiệm rõ | Quét theo đường dẫn buộc clamd và volume SeaweedFS cùng host (volume chia sẻ + race condition: object đã ghi trước khi clamd kịp quét); nếu "đứng trước" kiểu reverse-proxy thì phá mất presigned upload — browser ký thẳng với SeaweedFS không đi qua proxy; thêm dịch vụ mới vào Tầng 1, thêm RAM thường trú cho một lớp trung gian, vi phạm G4 | Loại |
| (c) API quét qua clamd TCP trước khi ghi | Tệp nằm trong luồng dữ liệu đã được xác thực + RLS của API; INSTREAM không cần volume chia sẻ (một clamd, không mount chồng chéo); ghi `scan_status` đúng nghĩa trạng thái máy (`pending→clean/infected/failed`) đã có sẵn trong schema; EICAR kiểm chứng bằng một lời gọi API duy nhất trong CI | API ôm thêm logic hạ tầng (nhẹ, client clamd TCP ~vài chục dòng); quét đồng bộ làm request upload chậm hơn (chấp nhận ở 10 MiB, `StreamMaxLength` mặc định lớn hơn nhiều) | **Chọn** |

## Kết quả

- Quyết định ghi thành mã: compose (CLAMD_ADDR, depends_on, comment clamd nội bộ), apisix.yaml (header audit W3-07 ghi rõ cổng không quét). Chưa có Docker trên máy phát triển nên:
  - `node -e "yaml.parse(...)"` (package `yaml` 2.9.1 trong `tools/testing/node_modules`) trên 4 tệp YAML — OK, marker `#END` còn ở dòng cuối `apisix.yaml`.
  - `node tools/testing/check-config.mjs` — PASS (tham chiếu service trong route, biến `${}` đủ trong `.env.example`, realm + package lock).
  - `scripts/check-apisix.sh` (nạp bằng image APISIX thật) và `docker compose config -q` — **chờ CI/Docker**.
- Kiểm chứng EICAR (clamd quét chuỗi EICAR 68 byte qua chính luồng INSTREAM mà API dùng) — **chờ CI/Docker**.

## Hệ quả

- Điều dễ hơn: nghiệm thu M2 số 3 chỉ cần một lời gọi API + một presigned GET; một clamd duy nhất đúng ngân sách G4.
- Điều phải sửa ở cổng (đính chính khi hiện thực): tuy việc quét nằm trong API, thân request vẫn **đi qua nginx của APISIX**, và APISIX đóng gói sẵn `client_max_body_size: 1m` (tài liệu security-threat-model). Tệp 10 MiB nền base64 là ~13,98 MB JSON, nên `infra/apisix/config.yaml` phải nâng lên `20m`; nếu không, tệp hợp lệ bị 413 chặn trước khi tới clamd. Giá trị này chỉ được kiểm chứng thật bằng image APISIX trong CI (`scripts/check-apisix.sh` nạp cả `config.yaml` và fail khi log có `[error]`) — máy phát triển không có Docker.
- Điều khó hơn: API phải xử lý lỗi clamd timeout thành 503 + `failed` (poka-yoke); trần multipart của API phải đặt 10 MiB khớp CHECK của DB; chưa kiểm chứng image `clamav/clamav:1.5.4` có mặc định `TCPAddr 0.0.0.0` trong mạng docker — nếu không, phải bổ sung biến môi trường cấu hình clamd ở tuần 4 (`chờ Docker`).
- Việc tiếp: TV2 ĐÃ viết endpoint `POST /api/tickets/:id/attachments` (client clamd INSTREAM qua `CLAMD_ADDR`, PUT SeaweedFS filer qua `SEAWEEDFS_ENDPOINT`, metadata ghi bằng hàm `private.record_attachment` trong migration 004 — ánh xạ clean→201, infected→422 (không ghi SeaweedFS), timeout/lỗi→503); unit test + integration test 10 xanh với clamd/SeaweedFS GIẢ trên PostgreSQL THẬT, nhưng CHƯA chạy engine ClamAV thật — **còn chờ CI/Docker**: kiểm chứng EICAR 68 byte trên `clamd:3310` thật, phát hành presigned GET (W3 checklist), và đo RAM thực tế của clamd trên máy demo đưa vào hồ sơ TN-05.

## Nguồn tham khảo chính thức

- Apache APISIX — Security Threat Model (mặc định `client_max_body_size` 1m): https://apisix.apache.org/docs/apisix/security-threat-model/
- Apache APISIX — plugin client-control (chỉ giới hạn body, không quét virus) và Plugin Hub: https://apisix.apache.org/docs/apisix/plugins/client-control/ , https://apisix.apache.org/plugins/
- ClamAV — ClamD Protocol (path do clamd mở; TCP client stream nội dung bằng INSTREAM; trần `StreamMaxLength`): https://docs.clamav.net/manual/Usage/ClamdProtocol.html
- ClamAV — Scanning: https://docs.clamav.net/manual/Usage/Scanning.html
- Cisco-Talos/clamav issue #1424 (INSTREAM ghi tệp tạm rồi quét): https://github.com/Cisco-Talos/clamav/issues/1424
- SeaweedFS — hỗ trợ presigned request (trả lời của maintainer): https://github.com/seaweedfs/seaweedfs/discussions/4401
