# Đối chiếu tài liệu ↔ code (02/11/2026) — ticket C23-05

Snapshot code đối chiếu: `72f72d7` ("Merge origin/main into develop-quyennnv").
Phạm vi: **sửa khẳng định sai so với code hiện hành**, có dẫn chứng `file:line`, không viết
lại lịch sử. Các file nhật ký có ngày cũ (kế hoạch tuần 2/3/4, phát hành tuần 2, hoàn thiện
tuần 3, sec-dev-fixes) và mọi file code/SQL/infra là **chỉ-đọc** — ghi ở mục "Cố ý KHÔNG sửa".

Quy ước cột: `khẳng định cũ (file + dòng)` | `nguyên văn sai ở đâu` | `code thật (file:line)` |
`cách sửa` | `ngày sửa`.

## A. Đã sửa (nằm trong phạm vi ghi)

| Khẳng định cũ (file + dòng) | Nguyên văn sai ở đâu | Code thật (file:line) | Cách sửa | Ngày sửa |
| --- | --- | --- | --- | --- |
| `docs/api/contract.md:87` | Tiêu đề "Máy trạng thái **8 trạng thái** (9 giá trị chữ thường)" — nhãn "8" dễ hiểu nhầm, và tài liệu không nêu số cạnh | 9 giá trị `state-machine.ts:7-10`; 17 cạnh ở `state-machine.ts:20-30` (TRANSITIONS 3+2+3+3+2+2+2) và `:52-72` (ROLE_EDGES 17 mục); 17 hàng INSERT `db/migrations/003_ticket_workflow.sql:97-114` | Đổi tiêu đề thành "9 giá trị, 17 cạnh"; giữ lại ghi chú "DOCX gốc diễn đạt 8 trạng thái"; thêm blockquote cập nhật 02/11 có dẫn chứng đếm | 02/11/2026 |
| `docs/api/contract.md:114-118` (mô tả `sla_paused_ms`) | Chỉ nói "cờ `sla_breached` do W4-03 dùng" mà chưa nêu **công thức deadline** và **ngưỡng breach** tường minh | `compute_ticket_sla_due` `003_ticket_workflow.sql:193-208` (`created_at + resolution_minutes`); `effectiveSlaDeadline`/`isSlaBreached` `rules.ts:100-110` (breach ⇔ `now > sla_due_at + sla_paused_ms + max(0, now−waiting_since)`); `resolution_minutes` `002_reference_data.sql:8-9`; 005 REVOKE UPDATE cột SLA `005_ticket_integrity.sql:68` | Thêm blockquote cập nhật 02/11 nêu đúng công thức + ngưỡng breach + đơn vị miligiây + bảng phút theo priority, mỗi ý kèm `file:line` | 02/11/2026 |
| `docs/du-lieu.md:8` | "`attachments`: **metadata S3** và trạng thái quét; **chưa có API upload** tuần 2" | Object nằm ở SeaweedFS (`downloads.ts:80`), đọc bằng **URL HMAC do API ký** (`downloads.ts:21-30,50-62`); API upload đã có (`controllers.ts:225-287`) | Sửa dòngbullet thành "object ở SeaweedFS, đọc bằng URL HMAC theo ADR 0007/0009"; giữ khung W2-06 nhưng thêm mục "Cập nhật 02/11" gạch đầu dòng các nhận định lỗi thời | 02/11/2026 |
| `docs/du-lieu.md:9` | "`categories`: VPN, tài khoản, thiết bị, phần mềm" (4 danh mục) | 6 danh mục active: thêm `access` + `system-error` ở `003_ticket_workflow.sql:69-81`; 4 danh mục gốc `002_reference_data.sql:3-7` | Giữ dòng lịch sử; ghi rõ trong mục "Cập nhật 02/11" là hiện có 6 danh mục | 02/11/2026 |
| `docs/du-lieu.md:33-34` | "quy tắc chuyển trạng thái, Poka-yoke theo loại yêu cầu, SLA, routing và upload **thuộc tuần 3–4**" | Máy trạng thái + Poka-yoke + SLA đã hiện thực từ tuần 3 (`state-machine.ts`, `rules.ts`, `003`, `005`); upload đã có (`controllers.ts`, `downloads.ts`). Chỉ routing-tự-động (`assigned_to`) chưa làm | Thêm mục "Cập nhật 02/11" đánh dấu "không còn đúng từ tuần 3" cho từng ý; giữ nguyên câu gốc | 02/11/2026 |
| `docs/cai-dat.md:192-194` | "Chữ ký JWT hiện được kiểm tại API và PostgREST; **plugin openid-connect tại gateway đã bị gỡ**" | `infra/apisix/apisix.yaml:15-38` khai `openid-connect` (`&verify-jwt`) cho route `rest`; `:68-77` gắn `*verify-jwt` cho `service-desk-api`; `scripts/dxdesk.mjs:50` render `runtime.yaml` từ template; `scripts/stack-test.mjs:36,86` mong cổng trả 401 khi `openid-connect` từ chối | Thay bằng blockquote cập nhật 02/11: gateway **vẫn** bật `openid-connect` (RS256, `public_key` từ JWKS, siết issuer+audience `dxdesk-api`); API/PostgREST kiểm lại là lớp phòng thủ hai, không phải vì gateway đã bỏ | 02/11/2026 |
| `docs/api/openapi.yaml:7` (`info.description`) | Không nêu số trạng thái/cạnh, dễ để người đọc đối chiếu "8 trạng thái" từ DOCX | 9 giá trị + 17 cạnh (như dòng đầu bảng) | Mở rộng `info.description` xác nhận 9 giá trị/17 cạnh đồng bộ 1:1 `ticket_transitions`, và tải tệp là HMAC URL (không S3 presigned/multipart) | 02/11/2026 |
| `docs/adr/README.md` (hàng 0009 + chú thích) | Hàng bảng 0009 bị ngắt khỏi bảng 0001–0008 (dòng trống), và TOC không chỉ ra rằng chữ "presigned GET" trong ADR 0007 đã bị 0009 thay thế | Cơ chế cuối = capability HMAC (`downloads.ts`, ADR 0009); ADR 0007:47,69 còn stale | Nối lại hàng 0009 vào bảng; thêm chú thích 02/11 xác nhận 0009 là quyết định cuối, 0007 giữ nguyên (ngoài phạm vi) | 02/11/2026 |

## B. Đã đối chiếu, KHÔNG có khẳng định sai cần sửa

- `README.md` (root): không phát hiện khẳng định sai. Dòng "SeaweedFS | Kho tệp, tương thích S3"
  là **thuộc tính của kho lưu trữ** (SeaweedFS nói tiếng S3), không phải tuyên bố "URL tải là S3
  presigned"; đường tải thực tế đi qua API ký HMAC (`downloads.ts`) — đã diễn giải đúng ở
  contract/ADR 0009. Không sửa.
- `docs/api/contract.md` + `docs/api/openapi.yaml` — **danh sách endpoint**: đối chiếu từng route
  decorator trong `controllers.ts` và `downloads.ts`; cả hai tài liệu đã liệt kê ĐÚNG và ĐỦ các
  endpoint tồn tại: `GET /health` (`controllers.ts:23`), `GET /me` (`:64`), `GET /categories`
  (`:71`), `GET /tickets` (`:79`), `GET /tickets/:id` (`:89`), `GET /tickets/:id/events` (`:97`),
  `POST /tickets` (`:107`), `PATCH /tickets/:id/status` (`:149`), `GET/POST /device-requests`
  (`:180`,`:189`), `POST /tickets/:id/attachments` (`:225`), `GET /tickets/:id/attachments`
  (`downloads.ts:37`), `POST /attachments/:id/download-url` (`downloads.ts:50`),
  `GET /attachments/:id/content` (`downloads.ts:71`). Không thêm endpoint giả.
- **Whitelist DTO** khớp tài liệu: `ListQuery` limit 1..100 / offset 0..100000 (`dto.ts:44-49`);
  `CreateTicket` title 5..200 / description 10..5000 / priority enum / `fields` optional object
  (`dto.ts:24-32`); `UpdateTicketStatus` `to` ∈ 9 giá trị, `note` 1..2000, `resolution_note`
  5..2000 (`dto.ts:33-38`); `UploadAttachment` `file_name` 1..255, `content_type` ∈ allow-list 6
  giá trị, `content_base64` (`dto.ts:57-61`); `CreateDeviceRequest` device enum + reason 10..2000
  + quantity 1..10 (`dto.ts:39-43`). Controller `forbidNonWhitelisted` (DTO-only) khớp câu
  "Không chấp nhận trường ngoài DTO".

## C. Cố ý KHÔNG sửa (thiếu bằng chứng hoặc ngoài phạm vi ghi)

| Vị trí | Vấn đề | Lý do không sửa |
| --- | --- | --- |
| `apps/api/src/state-machine.ts:3` | Comment "máy trạng thái ticket **8 trạng thái** (9 giá trị...)" | File code, ngoài phạm vi ghi của A-DOC; code đã tự giải thích "9 giá trị" ngay trong comment nên không mâu thuẫn với hành vi. Ghi chú cho owner code. |
| `db/migrations/003_ticket_workflow.sql:3` | Header "máy trạng thái **8 trạng thái** + ..." | Ràng buộc: không sửa migration 001..007 (ledger checksum khóa). Nội dung SQL (9 giá trị, 17 hàng cạnh) đã đúng; chỉ comment tiêu đề cũ. Ghi chú cho owner DB. |
| `docs/adr/0007-vi-tri-quet-clamav.md:47,69` | Còn gọi đường đọc là "presigned GET URL" | File ADR riêng lẻ, ngoài phạm vi ghi (chỉ `adr/README.md` được phép). Đã ghi chú + trỏ tới ADR 0009 trong `adr/README.md`; đề nghị owner ADR 0007 cập nhật "Superseded by 0009". |
| `docs/ke-hoach-tuan-3.md:32,54` | "Máy trạng thái **8 trạng thái**", "mở CHECK đủ 8 trạng thái" | File kế hoạch tuần 3 do lead sở hữu (cấm sửa). Đây là nhật ký lập kế hoạch tại thời điểm đó, không phải mô tả hiện hành. |
| `docs/api/contract.md:52,64` (migration 006 / 004) | Câu mô tả hàm `begin_attachment`/`finish_attachment` (migration 006) và `record_attachment` (migration 004) | **Chưa xác minh** nội dung file `004/006/007` (không nằm trong danh sách nguồn bắt buộc đọc). Controller quả thực gọi `private.begin_attachment`/`finish_attachment`/`record_attachment` (`controllers.ts:255,289-303`), nên cơ chế đúng; nhưng số thứ tự migration cụ thể chưa đối chiếu trực tiếp → giữ nguyên, ghi "chưa xác minh", không đoán. |
| `docs/github-issues-tuan-2.md:26` | "không phơi database/**S3**/ClamAV ra host" | Ngoài phạm vi ghi và là ngữ cảnh nguyên tắc tuần 2; không phải tuyên bố cơ chế tải tệp. Không đụng. |
| `apps/api/test/workflow.test.mjs` | Tên test "TRANSITIONS covers the **8-state** contract graph exactly" | File test thuộc quyền owner code, ngoài phạm vi ghi. Nội dung test đã kiểm đúng 17 cạnh/9 giá trị (ma trận 9x9 + đồng bộ 1:1 `ticket_transitions`), chỉ chữ trong tên test còn "8-state". Ghi chú cho owner code; không đổi để khỏi làm nhiễu git blame test. |

## D. Kết quả tự kiểm (đã chạy trên máy, 02/11/2026)

- `node tools/testing/check-config.mjs` → **PASS**:
  `PASS config references, env completeness, Keycloak audiences, YAML and package locks`.
  `openapi.yaml` được check-config parse (`check-config.mjs:39-41`), nên PASS xác nhận sửa đổi
  YAML (`info.description`) vẫn hợp lệ và không phá tham chiếu cấu hình.
- `npm.cmd test --prefix apps/api` → **44 pass / 0 fail / 0 skipped** (duration ~2.76s).
  Đáng chú ý: test `full 9x9 transition matrix` và `W3-09: bảng cạnh private.ticket_transitions
  trùng khớp máy trạng thái API 1:1` xanh — củng cố 9 giá trị/17 cạnh. (Một tiêu đề test vẫn ghi
  "covers the **8-state** contract graph exactly" — chỉ là chữ trong tên test, nội dung kiểm tra
  17 cạnh; file test thuộc quyền owner code, A-DOC không sửa — ghi nhận ở mục C.)

