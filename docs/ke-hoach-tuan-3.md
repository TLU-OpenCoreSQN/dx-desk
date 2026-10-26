# Kế hoạch và tiến độ tuần 3 — DX-Desk: Luồng tạo ticket

**Tuần:** 26/10 – 01/11/2026. **Mốc:** demo nội bộ thứ Bảy 31/10 (cảnh 1 + nửa đầu cảnh 2), báo cáo giảng viên mốc M2.
**Nguồn:** `DX-Desk_Ke-hoach-trien-khai_OLP-PMNM-2026_ban-1.1.docx`, mục 5.2 (W3-01…W3-09), mục 6 (TN-03, TN-04), mục 4.5 (Định nghĩa "xong").
**Cập nhật:** 26/10/2026 21:20. **Nhánh:** `develop-quyennnv`. **Workspace:** `D:\MaNguonMo`.

## Cách đọc và cập nhật

- `[x]` chỉ đánh dấu khi có kết quả thực tế (mã chạy được, test PASS thật), theo đúng quy tắc tuần 2.
- Không đánh dấu đạt bằng số liệu giả hoặc chỉ vì đã có script.
- Việc cần Docker/CI GitHub được tách riêng khỏi việc làm được tại máy.

## Nền tảng kế thừa từ tuần 2 (trạng thái 26/10)

- [x] Nền test tuần 2 đã hoàn thành ở mức mã nguồn; trạng thái push/PR/CI **không kiểm chứng được từ máy này**: clone tại `D:\MaNguonMo` không cấu hình remote nào (`git remote -v` rỗng, không có `remotes/origin/*`), nên các thông tin "PR #3 mở, CI #9 xanh, CI #10 đỏ" chỉ lấy từ phiên làm việc trước và giao diện GitHub, không phải từ `git`.
- [ ] Chốt nợ tuần 2: xác định nguyên nhân CI #10, review và merge PR #3, tag v0.1.0 (kèm việc cấu hình remote/push từ máy này).
- [x] Nền test tại máy: PostgreSQL 17.10 + PostgREST 16.4 + Keycloak 26.8.1 portable, harness trong `tools/testing/`.
- [ ] Docker Desktop/WSL vẫn chưa cài — mọi nghiệm thu stack thật dựa vào CI GitHub.

## Hợp đồng kỹ thuật tuần 3 (các bên bám theo này)

**Máy trạng thái 8 trạng thái** (giữ giá trị chữ thường trong CSDL):
`new → triaged → assigned → in_progress → waiting_user → resolved → closed`, nhánh đặc biệt:
`in_progress|assigned → pending_approval` (cấp quyền hệ thống nhạy cảm), `pending_approval → assigned` (duyệt) hoặc `→ new` (từ chối), `→ cancelled` từ các trạng thái chưa đóng.
Mỗi lần chuyển ghi `ticket_events(event_type='status_changed', payload={from,to,note})` trong cùng giao dịch.

**SLA**: thêm cột `tickets.sla_due_at`, `tickets.sla_paused_ms`. `sla_due_at = created_at + sla_policies.resolution_minutes` tính lúc tạo; vào `waiting_user` cộng dồn thời gian tạm dừng vào `sla_paused_ms`; quá `sla_due_at + sla_paused_ms` coi như vi phạm (cờ `sla_breached` do W4-03 sử dụng; tuần 3 chỉ tính và lưu).

**Poka-yoke phía API** (lỗi trả về có mã tiếng Việt rõ ràng):
1. Chuyển trạng thái ngoài máy trạng thái → 422.
2. `priority=critical` chỉ Manager → không phải 403 (đã có RLS, nay thêm ở API layer).
3. Ticket loại `access` (cấp quyền hệ thống) do Employee tạo → trạng thái khởi đầu `pending_approval`.
4. Chuyển `→ resolved` bắt buộc `resolution_note` (5–2000 ký tự) → thiếu là 422.
5. Trường bắt buộc theo loại: `categories.requirement_fields jsonb` (migration 003 nạp giá trị cho vpn/account/access/software/hardware/system; các loại khác mảng rỗng).

**API mới**: `PATCH /api/tickets/:id/status` body `{to, note?, resolution_note?}`; `GET /api/categories` trả thêm `requirement_fields`.

**Frontend**: form tạo ticket hiển thị trường động theo `requirement_fields`, khóa nút Gửi + báo trường thiếu, ẩn Critical với Employee; màn chi tiết có dòng thời gian trạng thái (đọc events) và nút chuyển trạng thái theo vai trò.

## Checklist công việc

### W3-01 — Máy trạng thái ticket (TV2, hỗ trợ TV3)

- [x] Viết migration 003: mở CHECK `status` đủ 8 trạng thái, thêm `sla_due_at`, `sla_paused_ms`, `categories.requirement_fields`.
- [x] Module `state-machine.ts`: bảng chuyển tiếp hợp lệ + kiểm tra điều kiện từng cạnh.
- [x] Endpoint `PATCH /api/tickets/:id/status` ghi `ticket_events` cùng giao dịch.
- [x] Kiểm thử đơn vị máy trạng thái (đủ các cạnh hợp lệ + cặp vô hiệu tiêu biểu).
- [x] Kiểm thử integration trên PostgreSQL thật với token Keycloak (ca tạo → duyệt → gán → xử lý → chờ → resolved → closed). *Token là RSA fixture chữ ký thật, chưa phải Keycloak đang chạy — xem ghi chú bằng chứng.*
- [ ] CI xanh với migration 003 (áp trên máy sạch và máy đã có DB tuần 2).

### W3-02 — Poka-yoke phía API (TV2, hỗ trợ TV3)

- [x] Rule critical-chỉ-Manager tại API layer + test.
- [x] Rule access → `pending_approval` khi Employee tạo + test.
- [x] Rule `resolution_note` bắt buộc khi → `resolved` + test.
- [x] Validation trường bắt buộc theo loại từ `requirement_fields` + test.
- [x] Thông báo lỗi tiếng Việt, không lộ SQL.
- [x] Cập nhật `docs/api/contract.md` + OpenAPI.

### W3-03 — Tính sla_due_at (TV2, hỗ trợ TV1)

- [x] Tính SLA lúc tạo từ `sla_policies.resolution_minutes` (hàm SQL, có test).
- [x] Tạm dừng đếm khi `waiting_user` (cộng dồn `sla_paused_ms`, có test).
- [x] Chứng minh bằng integration test với đồng hồ thật trên DB.

### W3-04 — Biểu mẫu tạo ticket theo loại (TV3, hỗ trợ TV2)

- [x] Trường động theo `requirement_fields` từ API categories.
- [x] Khóa nút Gửi và liệt kê trường thiếu; ẩn Critical với Employee.
- [x] Unit test form (Vitest) + build production đạt.
- [ ] Kiểm trình duyệt với API thật (cần CI/stack — fixture chỉ là bằng chứng tạm).

### W3-05 — Màn "Yêu cầu của tôi" + chi tiết (TV3, hỗ trợ TV2)

- [x] Dòng thời gian trạng thái từ `/api/tickets/:id/events` (thêm trạng thái mới vào nhãn/icon).
- [x] Nút chuyển trạng thái theo vai trò và máy trạng thái (Employee: xác nhận closed/hủy; Agent: quy trình xử lý). *Đã sửa 2 cạnh thiếu `requesterOnly` (`resolved→closed`, `waiting_user→in_progress`) để UI không hiện nút mà DB/API từ chối 403; có test so với bảng cạnh trong migration 003.*
- [x] Unit test + build đạt.
- [ ] E2E qua APISIX với SSO thật (nghiệm thu CI).

### W3-06 — Tải tệp an toàn: SeaweedFS + ClamAV (TV1, hỗ trợ TV2) — TN-03→QĐ-3

- [x] Tài liệu TN-03 so sánh vị trí quét (plugin APISIX / dịch vụ đứng trước SeaweedFS / trong API) bằng nguồn chính thức; ADR 0007 chốt phương án (QĐ-3).
- [ ] Thiết kế + skeleton luồng upload API (URL ký có thời hạn, giới hạn định dạng/dung lượng) — phần quét thật cần stack. *Đang làm: `compose` đã có `clamav` + `CLAMD_ADDR` nhưng `apps/api/src` chưa có client clamd/endpoint upload (tìm `clam|INSTREAM|scan|attach` = 0 kết quả).*
- [ ] Kiểm EICAR trên stack thật (CI hoặc máy có Docker).

### W3-07 — Route APISIX + OTP Keycloak (TV1, hỗ trợ TV2)

- [x] Rà route APISIX cho `PATCH /api/tickets/:id/status` (JWT, phân quyền vai trò, rate limit, nhật ký). *Route `/api/*` không khai báo `methods` nên PATCH đi qua; `limit-req` 30 req/s + key `remote_addr` hợp lệ; đã đổi `rejected_msg` 429 sang JSON để khớp hợp đồng lỗi của API. Hai việc còn chờ CI: `scripts/check-apisix.sh` (nạp bằng image APISIX) và độ khả dụng của `jwks_uri` suy ra từ discovery document (xem Rủi ro mở).*
- [x] OTP (TOTP) trong realm cho user mẫu — làm dạng tùy chọn để không phá harness SSO hiện tại; hướng dẫn bật trong `docs/cai-dat.md`. *`realm-dxdesk-otp.json` chỉ thêm `requiredActions: CONFIGURE_TOTP` cho 4 user demo + đổi displayName; `realm-dxdesk.json` gốc không đổi nên harness native-sso vẫn dùng password grant.*
- [ ] Đăng nhập SSO + OTP trên stack thật (CI).

### W3-08 — TN-04: SSO cho Wiki.js / Mattermost / Metabase (TV1, hỗ trợ TV3) — QĐ-2

- [x] Xác minh tài liệu chính thức từng ứng dụng (OIDC free hay trả phí); ADR 0008 + QĐ-2. *Các khẳng định về tài liệu ngoài repo (giới hạn body APISIX, Plugin Hub, phiên bản Wiki.js, bản trả phí Metabase) mới chỉ là dẫn nguồn, chưa kiểm chứng runtime.*
- [ ] Chạy runtime cả 3 ứng dụng — cần Docker; ghi rõ chưa thử runtime nếu chỉ đọc tài liệu.

### W3-09 — Kiểm thử RLS trong CI (TV2, hỗ trợ TV1)

- [x] Rà bộ RLS trong `tools/testing/run-integration.mjs`, mở rộng cho các trạng thái/máy trạng thái mới. *Test 9 "W3: state machine, poka-yoke and SLA bookkeeping" phủ 22 tình huống, gồm cả đường ghi thẳng PostgREST bị guard trigger chặn.*
- [x] Job CI chạy bộ RLS + máy trạng thái trên PostgreSQL service — thêm vào `ci.yml`. *Job `rls-integration` (đã đổi tên "TN-02 RLS + máy trạng thái tuần 3") chạy `npm run integration` = 9 test trên PostgreSQL 17 + PostgREST 16.4; job `apps` chạy 22 unit test API (có test so sánh bảng cạnh DB ↔ `state-machine.ts`) và 64 test web (có test so sánh nút UI ↔ bảng cạnh DB).*
- [ ] CI xanh toàn bộ sau khi push tuần 3.

### Nợ tuần 2 cần đóng trong tuần này

- [ ] Tái hiện/loại trừ CI #10 fail (flaky): log vẫn sau màn hình đăng nhập GitHub, và bản clone tại máy không có remote nên không tự đối chiếu SHA được.
- [ ] PR #3 có ít nhất 1 review và merge (cần thành viên khác duyệt — việc của người dùng/đội).
- [ ] Tag và phát hành v0.1.0 (sau merge).
- [x] Cập nhật `ke-hoach-tuan-2.md`: thêm "Chặng 9: đính chính trạng thái" (26/10) — giữ nguyên nhật ký 21/10, ghi rõ số test mới, giới hạn của harness so với `stack-test.mjs`, và việc workspace này không có git remote.

## Tiêu chí hoàn thành tuần 3 (M2 — nguyên văn từ kế hoạch triển khai)

1. Nhân viên mẫu đăng nhập SSO + OTP, tạo ticket VPN có ảnh chụp màn hình, ticket chuyển `new` và có bản ghi `ticket_events`.
2. curl với token nhân viên + `priority=critical` → 403.
3. Tải tệp EICAR bị chặn; tệp hợp lệ chỉ mở được bằng URL ký.
4. Kiểm thử RLS và máy trạng thái chạy trong CI.
5. QĐ-2 (TN-04) và QĐ-3 (TN-03) đã chốt.

### Trạng thái tiêu chí M2 (26/10, 21:20)

| # | Tiêu chí | Trạng thái | Bằng chứng hiện có | Còn thiếu |
|---|---|---|---|---|
| 1 | SSO + OTP + tạo ticket + `ticket_events` | Một phần | Luồng tạo/`ticket_events` chứng minh bằng integration test 9 (PostgreSQL thật); UI có screenshot fixture | Đăng nhập SSO + OTP thật qua Keycloak đang chạy — cần CI/Docker |
| 2 | `priority=critical` với token nhân viên → 403 | Đạt ở mức harness | Integration test 4 (`TN-02: Critical denied…`) chặn cả hai đường API và PostgREST | curl thật qua APISIX với token Keycloak thật — cần CI |
| 3 | EICAR bị chặn, tệp hợp lệ chỉ mở bằng URL ký | Chưa đạt | ADR 0007 + compose (`clamav`, `CLAMD_ADDR`) đã sẵn | Chưa có client clamd/endpoint upload trong `apps/api`; chưa có presigned URL; chưa kiểm EICAR |
| 4 | Test RLS + máy trạng thái chạy trong CI | Đạt ở mức mã nguồn | Job `rls-integration` (9 test) + job `apps` (22 API + 64 web unit test, có test so với migration 003) | CI xanh thực sự — cần push và chạy GitHub Actions |
| 5 | QĐ-2, QĐ-3 đã chốt | Đạt (chờ kiểm chứng runtime) | ADR 0007 (QĐ-3), ADR 0008 (QĐ-2), mục lục `docs/adr/README.md` | Chạy Wiki.js/Mattermost/Metabase và EICAR trên stack Docker |

## Rủi ro mở (phải kiểm chứng bằng CI, không kết luận tại máy)

1. `infra/apisix/apisix.yaml` đặt `discovery: http://keycloak:8080/...` nhưng không đặt `jwks_uri`; plugin `openid-connect` lấy `jwks_uri` từ discovery document, tức theo issuer Keycloak công bố. Nếu issuer là `localhost:8080` thì container APISIX không với tới. Chỉ `stack` job (Docker) mới kết luận được — chưa đổi cấu hình để tránh đoán mò.
2. `infra/keycloak/compose-otp.yml` chưa được `compose-config` job kiểm tra (job chỉ `config -q` tệp compose chính).
3. Image `clamav/clamav:1.5.4` có mặc định `TCPAddr 0.0.0.0` trong mạng compose hay chưa — ADR 0007 đã ghi là nợ tuần 4.
4. CI #10 (nợ tuần 2) fail ở step "Khởi chạy lần hai, giữ dữ liệu" trong khi harness cùng tên tại máy PASS 4/4 — vẫn là giả thuyết flaky/đua nhịp, chưa đọc được log.

## Bằng chứng nghiệm thu tại máy (26/10/2026, chạy lại toàn bộ sau mọi chỉnh sửa)

| Lệnh | Kết quả |
|---|---|
| `npm.cmd test` trong `apps/api` | `tests 22, pass 22, fail 0` (kèm `npm run build` sạch) |
| `npm.cmd test` trong `apps/web` | `Test Files 8 passed (8)`, `Tests 64 passed (64)` |
| `npm.cmd run build` trong `apps/web` | build sạch, `Preserved runtime notices for 11 packages` |
| `node tools/testing/run-integration.mjs` | `# tests 9 / # pass 9 / # fail 0` — PostgreSQL 17.10 + PostgREST 16.4 thật, token RSA fixture tự ký (không phải Keycloak đang chạy) |
| `powershell.exe -NoProfile -File work/run-migration-test.ps1` | 4/4 PASS, `First run applies all 5 SQL files`, `Second run preserves data and migration timestamps` |
| `node tools/testing/check-config.mjs` | `PASS config references, env completeness, Keycloak audiences, YAML and package locks` |
| `node tools/testing/browser-smoke.mjs` | 7/7 PASS (fixture HTTP, không SSO thật) — ảnh `.local/reports/web-*.png` |
| Parse YAML/JSON thủ công cho `ci.yml`, `apisix.yaml`, `realm-dxdesk-otp.json` | parse OK, marker `#END` còn cuối tệp `apisix.yaml` |

## Nhật ký

### 26/10/2026 — Chặng 1: lập kế hoạch và chia việc

- Trích xuất và đọc toàn văn kế hoạch triển khai bản 1.1; lập kế hoạch tuần 3 này.
- Chia 3 mũi triển khai song song: backend (W3-01..03 + W3-09), frontend (W3-04..05), hạ tầng/tài liệu (W3-06..08).
- Ghi nhận rủi ro: OTP bắt buộc sẽ phá luồng password-grant của harness hiện tại → làm tùy chọn; migration 003 phải tương thích ledger checksum cũ (không sửa 001/002).

### 26/10/2026 — Chặng 2: nghiệm thu backend/frontend và hạ tầng

- Backend (W3-01..03): migration 003 + `state-machine.ts` + `rules.ts` + `PATCH /api/tickets/:id/status`; guard trigger mức DB (SQLSTATE 45001/45002/45003) và audit trigger ghi `ticket_events`. Integration test 9 phủ hết một lượt luồng nghiệp vụ, trong đó có reopen `resolved→in_progress` (mỗi lần xử lý phải có `resolution_note` mới) và `waiting_user` cộng dồn `sla_paused_ms` bằng đồng hồ thật.
- Phát hiện và chốt hành vi: PostgREST không ánh xạ SQLSTATE tự định nghĩa 45xxx nên đường ghi thẳng trả **400** (kèm `code`), còn API đường chính trả 403/422; test và `docs/api/contract.md` ghi đúng như vậy, kèm khẳng định không phát sinh `ticket_events` thừa.
- Thêm 2 test chống trôi hợp đồng: API ↔ bảng cạnh `private.ticket_transitions` (17 cạnh, 1:1) và UI ↔ cùng bảng cạnh (tập con, vai trò/requester). Đây là lý do migration 003 không được phép đổi mà không sửa `state-machine.ts`.
- Frontend (W3-04..05): 64 test đạt; sửa 2 cạnh thiếu `requesterOnly` để UI không mời thao tác bị DB từ chối; `tools/testing/browser-smoke.mjs` cập nhật để chứng minh Poka-yoke thật trên trình duyệt (trường động theo danh mục, `aria-disabled` + bảng liệt kê trường thiếu, payload chỉ gồm trường đã điền).
- Hạ tầng (W3-06..08): tự kiểm lại toàn bộ bằng một agent đọc mã (không tin báo cáo): `check-config` PASS, `apisix.yaml` parse + `#END`, plugin names hợp lệ, route `/api/*` cho PATCH đi qua, realm OTP chỉ thêm `requiredActions` cho 4 user demo và `realm-dxdesk.json` gốc không đổi. Đã sửa `rejected_msg` 429 thành JSON. Kết luận quan trọng nhất: **chưa có bất kỳ mã quét tệp nào trong `apps/api`** → W3-06 chưa thể tick phần triển khai.
- Việc đang chạy tiếp: endpoint `POST /api/tickets/:id/attachments` + client clamd INSTREAM (không phụ thuộc mới) + SeaweedFS PUT + migration 004 cấp quyền/RLS cho `attachments`, kèm unit test với clamd/SeaweedFS giả.

