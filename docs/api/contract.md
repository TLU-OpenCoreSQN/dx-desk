# Hợp đồng API tuần 3

API NestJS/TypeScript. Trình duyệt truy cập cùng origin qua APISIX:
`http://localhost:9080/api`. Vite dev proxy `/api` và `/rest` tới APISIX.
Header: `Authorization: Bearer <Keycloak access token>`.
Keycloak: `http://localhost:8080`, realm `dxdesk`, public client `dxdesk-web`,
Authorization Code + PKCE S256. Giữ token trong bộ nhớ, refresh trước request.
Issuer phải khớp chính xác, audience `dxdesk-api`, thuật toán RS256.

- `GET /api/health`: công khai, `{status:"ok",service:"dx-desk-api",version:"0.1.0"}`.
- `GET /api/me`: `{id,username,roles:["Employee"|"Agent"|"Manager"]}`.
- `GET /api/categories`: `{data:[{id,code,name,description,requirement_fields}]}`.
  `requirement_fields` là mảng đối tượng `{key,label,required}` — trường động theo loại
  ticket (tuần 3 thêm danh mục `access` "Cấp quyền hệ thống" và `system-error` "Lỗi hệ thống",
  tổng cộng 6 danh mục active).
- `GET /api/tickets?limit=25&offset=0`: `{data:Ticket[],limit,offset}`.
- `GET /api/tickets/:id`: một Ticket, 404 nếu không tồn tại hoặc không có quyền
  (RLS ẩn bản ghi của người khác với Employee).
- `GET /api/tickets/:id/events`: `{data:[{id,ticket_id,actor_id,event_type,payload,created_at}]}`.
  `event_type` ∈ `created|status_changed`; payload status_changed là `{from,to,note}`.
- `POST /api/tickets`: `{category_id:uuid,title:string(5..200),description:string(10..5000),
  priority?:"low"|"normal"|"high"|"critical",fields?:object}`. HTTP 201 trả Ticket.
  `fields` phải điền đủ các entry `required:true` của `requirement_fields` danh mục
  (value là chuỗi 1..500 ký tự); key ngoài danh mục bị chặn. Kết quả lưu vào `request_fields`.
- `PATCH /api/tickets/:id/status` (MỚI tuần 3): body `{to, note?, resolution_note?}`
  (`note` 1..2000; `resolution_note` bắt buộc khi `to="resolved"`, 5..2000 ký tự).
  HTTP 200 trả Ticket sau cập nhật. Toàn bộ kiểm tra + ghi audit `ticket_events`
  (`status_changed`, payload `{from,to,note}`) chạy trong MỘT giao dịch với RLS;
  trigger PostgreSQL kiểm tra lại máy trạng thái + vai trò nên đường ghi thẳng PostgREST
  cũng bị chặn như qua API. Lưu ý: PostgREST không ánh xạ SQLSTATE tự định nghĩa 45xxx nên
  cổng ghi thẳng trả **HTTP 400** kèm `code` = 45001/45002/45003 (API đường chính trả
  403/422 theo bảng lỗi); giao dịch luôn rollback, không phát sinh `ticket_events`.
- `POST /api/tickets/:id/attachments` (MỚI tuần 3, ADR 0007): thân **JSON**
  `{file_name:string(1..255), content_type:<allow-list>, content_base64:<base64>}`,
  sau giải mã phải `> 0` và `<= 10 MiB` (khớp CHECK `attachments.size_bytes`).
  HTTP 201 trả bản ghi metadata (`Attachment`, `scan_status:"clean"`).
  JSON/base64 là hợp đồng đã chốt; browser và API buffer tệp trong RAM.
  `content_type` cho phép: `image/png image/jpeg image/gif image/webp application/pdf text/plain`.
  `file_name` chỉ lưu vào cột, KHÔNG dùng làm object key (server sinh `attachments/<ticket>/<uuid>`).

## Luồng quét tệp đính kèm (W3-06, ADR 0007 QĐ-3)

API là nơi sở hữu trần dung lượng và thứ tự an toàn. clamd chạy qua TCP `CLAMD_ADDR`
(mặc định `clamav:3310` trong compose), SeaweedFS filer qua `SEAWEEDFS_ENDPOINT`
(`http://seaweedfs:8888`). Metadata giữ vết intent trước mọi lần PUT:

1. Chặn **trước khi** đụng clamd: allow-list `content_type` (400) + trần 10 MiB trên byte
   đã giải mã (422) + cổng nhìn thấy ticket theo RLS (404 — không quét, không lưu).
2. Stream **toàn bộ** byte vào clamd bằng INSTREAM (`nINSTREAM\n`, mỗi chunk 4-byte
   big-endian độ dài, kết thúc bằng chunk độ dài 0). API chưa ghi Filer; clamd có thể
   dùng tệp tạm nội bộ để quét INSTREAM.
3. `clean` → tạo metadata pending (migration 006) → PUT Filer → hoàn tất clean (201).
4. `infected` → **không** gọi SeaweedFS, INSERT metadata `scan_status='infected'`, trả 422.
5. clamd `timeout/unreachable` → metadata failed, trả 503. Lỗi PUT hoặc hoàn tất DB
   sẽ thử DELETE bù trừ tối đa ba lần rồi đánh dấu failed; DB chưa sẵn sàng thì intent
   vẫn pending. Metadata đã commit giữ object_key để đối soát khi cleanup thất bại.

Hai hàm private.begin_attachment/private.finish_attachment chỉ dùng nội bộ API,
không expose RPC PostgREST. Pending/failed không phải tệp đã sẵn sàng để đọc.
Khi có log "Attachment cleanup requires reconciliation", quản trị đối chiếu
metadata pending/failed với object_key và dọn object còn sót sau khi dịch vụ phục hồi.

Metadata chỉ ghi được qua hàm `private.record_attachment(...)` (SECURITY DEFINER,
migration 004) — `authenticated` không có INSERT trên `attachments` nên không giả mạo
được `scan_status` qua PostgREST.

### Đọc tệp bằng URL ký (W3-06 / M2)

- `GET /api/tickets/:id/attachments`: kiểm ticket theo RLS; trả `{data:[metadata]}`
  gồm các trạng thái quét, không trả object_key. Ticket ngoài quyền → 404.
- `POST /api/attachments/:id/download-url`: cần JWT, kiểm RLS và `clean` → 201
  `{url,expires_at}`; ngoài quyền → 404; pending/infected/failed → 403.
- `GET /api/attachments/:id/content?expires=...&signature=...`: capability HMAC-SHA256
  ràng buộc ID và thời hạn 120 giây. Thiếu/sai/hết hạn/sửa ID/thời hạn → 403;
  metadata không còn clean → 404; Filer lỗi → 503. Không cần JWT trên đường này.
- URL dùng cùng origin APISIX, không phải S3 presigned URL. Chỉ API đọc Filer nội bộ;
  không công bố listener Filer/volume/S3. Phải đổi `ATTACHMENT_SIGNING_KEY` (ít nhất
  32 byte) trước triển khai thật; thay key vô hiệu mọi liên kết đã cấp.
- URL là bearer capability: ai có URL còn hạn có thể tải dù quyền ticket của người
  được cấp vừa đổi. Giới hạn rủi ro bằng TTL 120 giây; metadata clean được kiểm lại
  mỗi lần tải. Không hứa thu hồi tức thời theo user. Access log gateway không ghi
  query/JWT; quyền truy cập error log hạ tầng vẫn phải giới hạn vì request URI có
  thể xuất hiện khi upstream lỗi.
- Đáp ứng luôn `attachment`, `application/octet-stream`, `nosniff`, `no-store` và
  `Referrer-Policy: no-referrer`; không render nội dung theo MIME do client khai.

## Máy trạng thái 8 trạng thái (9 giá trị chữ thường)

`new → triaged → assigned → in_progress → waiting_user → resolved → closed`,
nhánh đặc biệt: `new|assigned|in_progress → pending_approval` (duyệt cấp quyền nhạy cảm),
`pending_approval → assigned` (duyệt) hoặc `→ new` (từ chối, chỉ Manager),
`→ cancelled` từ `new|triaged|assigned|waiting_user`; `resolved → in_progress` ( reopen).
`closed`, `cancelled` là trạng thái cuối. Vai trò theo cạnh:

| Cạnh | Ai được đi |
| --- | --- |
| new→triaged, triaged→assigned, assigned→in_progress | Agent, Manager |
| assigned→pending_approval, in_progress→pending_approval, new→pending_approval | Agent, Manager |
| in_progress→waiting_user, in_progress→resolved, resolved→in_progress | Agent, Manager |
| waiting_user→in_progress | Requester (Employee chủ ticket), Agent, Manager |
| new/triaged/assigned/waiting_user→cancelled | Requester (Employee chủ ticket), Agent, Manager |
| pending_approval→assigned (duyệt) | Agent, Manager |
| pending_approval→new (từ chối) | Chỉ Manager |
| resolved→closed (xác nhận đóng) | Chỉ requester chủ ticket |

Ticket mới tạo có `status:"new"`, NGOẠI TRỪ Employee (không phải Agent/Manager) tạo
ticket danh mục `access` → khởi đầu `pending_approval` (RLS INSERT policy `tickets_create_v3`
chỉ mở đúng cửa này). `assigned_to` luôn `null` ở tuần 3.

## Ticket (schema tuần 3)

`id, requester_id, category_id, title, description, priority, status, assigned_to,
created_at, updated_at` + các cột MỚI (migration 003):
`sla_due_at` (timestamptz, = `created_at + sla_policies.resolution_minutes` theo priority,
tính bằng trigger lúc INSERT), `sla_paused_ms` (bigint **miligiây** tạm dừng cộng dồn khi
rời `waiting_user`; ngưỡng hiệu lực cộng thêm `max(0, now-waiting_since)` khi còn chờ;
cờ `sla_breached`
do W4-03 dùng), `waiting_since` (timestamptz|null, nội bộ vận hành),
`resolution_note` (text|null, 5..2000 khi có giá trị), `request_fields` (jsonb object,
lưu `fields` đã kiểm tra theo danh mục).

## Bàn lỗi Poka-yoke (message tiếng Việt, không lộ SQL)

| Tình huống | HTTP | Message |
| --- | --- | --- |
| Cạnh ngoài máy trạng thái (VD `new→resolved`) | 422 | Chuyển trạng thái không hợp lệ với quy trình xử lý yêu cầu. |
| Trạng thái không tồn tại trong quy trình | 422 | Trạng thái không thuộc quy trình xử lý yêu cầu. |
| Ticket đã `closed`/`cancelled` hoặc đã ở trạng thái đích | 409 | Yêu cầu đã khép lại… / Yêu cầu đã ở trạng thái này… |
| Vai trò không được phép đi cạnh (VD Employee `new→triaged`, Agent `pending_approval→new`) | 403 | Vai trò của bạn không được phép chuyển yêu cầu sang trạng thái này. |
| Chuyển `→ resolved` thiếu/vi phạm `resolution_note` (5..2000) | 422 | Cần ghi chú kết quả xử lý (5–2000 ký tự) trước khi đánh dấu yêu cầu đã xử lý. |
| `priority:"critical"` khi token không có Manager | 403 | Chỉ Manager mới được đặt độ ưu tiên Critical. |
| Thiếu trường `required` theo `requirement_fields` | 422 | Thiếu trường bắt buộc: <labels tiếng Việt, phẩy>. |
| `fields` chứa key ngoài danh mục / value không phải chuỗi 1..500 | 400 | Biểu mẫu chứa trường không thuộc danh mục đã chọn. / Giá trị trường biểu mẫu không hợp lệ (cần chuỗi 1–500 ký tự). |
| Danh mục không tồn tại/không active | 403 | Danh mục không tồn tại hoặc không khả dụng. |
| Body ngoài DTO, enum sai, tiêu đề/mô tả sai độ dài | 400 | (ValidationPipe liệt kê từng trường) |
| RLS từ chối ghi (spoof trạng thái khởi tạo khác `new`/`pending_approval`-access) | 403 | Bạn không có quyền thực hiện thao tác này. |
| Không thấy ticket theo RLS | 404 | Không tìm thấy yêu cầu. |
| Tệp đính kèm quá cỡ (> 10 MiB) hoặc rỗng | 422 | Tệp đính kèm rỗng hoặc vượt trần 10 MiB. |
| `content_type` ngoài allow-list (tệp đính kèm) | 400 | Loại tệp không được phép tải lên. |
| clamd báo tệp nhiễm mã độc | 422 | Tệp đính kèm bị đánh dấu mã độc nên đã bị chặn. |
| clamd timeout/không phản hồi, hoặc SeaweedFS lỗi | 503 | Dịch vụ quét virus chưa sẵn sàng. Vui lòng thử lại. / Không lưu được tệp đính kèm. Vui lòng thử lại. |
| Ràng buộc dữ liệu phía DB (CK/NOT NULL/FK) | 400 | Dữ liệu không hợp lệ. Kiểm tra danh mục và các trường bắt buộc. |
| Lỗi nội bộ / DB | 500 / 503 | Không thể xử lý yêu cầu… / Cơ sở dữ liệu chưa sẵn sàng. |

Quy tắc chung: Lỗi: `{statusCode,message}`; message có thể là chuỗi hoặc mảng lỗi validation.
Phân trang limit 1..100, offset 0..100000. Không trả tổng giả.
Không chấp nhận trường ngoài DTO (`requester_id/status/assigned_to/sla_*` do hệ thống kiểm soát).

Employee chỉ đọc dữ liệu của mình; Agent và Manager đọc tất cả yêu cầu.
RLS áp dụng giống nhau qua API và PostgREST; máy trạng thái + vai trò còn được trigger
`private.guard_ticket_update()` thực thi ở mức DB (SQLSTATE 45001/45002/45003 được API
map về các message ở bảng trên). Audit `ticket_events` do PostgreSQL sinh trong cùng giao
dịch, không nhận thẳng từ browser. Schema `private` và tài khoản database không phơi cho web.
Nghiệp vụ còn lại của các tuần sau: phân công `assigned_to`, dashboard, SLA breach flag.

## Bảo vệ dữ liệu ticket (sec-dev)

Migration 005 áp cùng quy tắc tạo ticket cho API và PostgREST: Employee tạo loại
access phải gửi trạng thái pending_approval; các trường theo danh mục phải đầy đủ,
đúng key, đúng kiểu và tối đa 500 ký tự. Trường optional rỗng bị loại sau trim.
PostgREST thiếu trường trả 422; trường sai trả 400; trạng thái khởi tạo sai trả 403.
Các ticket lịch sử được giữ nguyên khi nâng cấp.

SLA/thời gian do trigger quản lý, client không được PATCH trực tiếp. Chỉ được ghi
resolution_note khi chuyển sang resolved; reopen xóa ghi chú hiện tại để lần xử lý
sau bắt buộc có kết quả mới. Event resolved giữ resolution_note của chính lần đó,
không mất lịch sử khi reopen. Màn chi tiết hiển thị trường động và kết quả xử lý.

## Hợp đồng lưu tệp và nghiệm thu

JSON/base64 là hợp đồng đã chọn, không phải giới hạn của lockfile. Browser/API buffer
tệp trong RAM. Unit/integration dùng clamd/Filer giả để thử lỗi; stack CI quét EICAR
68 byte bằng ClamAV thật và đối chiếu bytes SeaweedFS, sau đó browser kiểm upload/
download trên cùng stack. Đọc kết quả artifact của đúng SHA, không suy từ số unit test.
