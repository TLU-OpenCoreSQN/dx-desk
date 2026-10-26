# Kế hoạch và tiến độ tuần 3 — DX-Desk: Luồng tạo ticket

**Tuần:** 26/10 – 01/11/2026. **Mốc:** demo nội bộ thứ Bảy 31/10 (cảnh 1 + nửa đầu cảnh 2), báo cáo giảng viên mốc M2.
**Nguồn:** `DX-Desk_Ke-hoach-trien-khai_OLP-PMNM-2026_ban-1.1.docx`, mục 5.2 (W3-01…W3-09), mục 6 (TN-03, TN-04), mục 4.5 (Định nghĩa "xong").
**Cập nhật:** 26/10/2026 22:05 (sau CI run #19 xanh toàn bộ trên `40cb46b`). **Nhánh:** `develop-quyennnv`. **Workspace:** `D:\MaNguonMo`.

## Cách đọc và cập nhật

- `[x]` chỉ đánh dấu khi có kết quả thực tế (mã chạy được, test PASS thật), theo đúng quy tắc tuần 2.
- Không đánh dấu đạt bằng số liệu giả hoặc chỉ vì đã có script.
- Việc cần Docker/CI GitHub được tách riêng khỏi việc làm được tại máy.

## Nền tảng kế thừa từ tuần 2 (trạng thái 26/10)

- [x] Nền test tuần 2 đã hoàn thành ở mức mã nguồn; từ 26/10 bản clone này đã có `origin = https://github.com/TLU-OpenCoreSQN/dx-desk.git` nên trạng thái push/PR/CI đọc thẳng từ GitHub API (mã SHA + kết luận job), không còn dựa vào ảnh màn hình.
- [ ] Chốt nợ tuần 2: tag v0.1.0 sau merge (tách riêng, chưa bấm). *Merge thì đang làm theo yêu cầu người dùng: `origin/main = 6da06d2` đã là ancestor của `develop-quyennnv` nên chỉ cần fast-forward, không force-push.*
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
- [x] CI xanh với migration 003 (áp trên máy sạch và máy đã có DB tuần 2). *Run #19 (`40cb46b`, sự kiện push) XANH toàn bộ: job `TN-02 RLS + máy trạng thái tuần 3` và job `nghiệm thu stack tuần 2`. Trên VM sạch (image vừa pull, volume `postgres-data` trống) bộ 6 tệp `migrations/001..004 + policies/001..002` được entrypoint áp một lần, lượt kiểm sau đó in `Skip` cho cả 6 tệp — ledger checksum chạy đúng và không có tệp nào bị sửa; step "Keycloak, APISIX, API, RLS và n8n restart" PASS `W3-01 state machine over APISIX with ticket_events`, step "Khởi chạy lần hai, giữ dữ liệu" PASS `Ticket from previous startup is preserved` (đúng 1 bản ghi `ticket_events`). Toàn bộ chuỗi PASS lấy từ log job tải bằng credential git, không phải suy đoán.*

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
- [ ] E2E qua APISIX với SSO thật (nghiệm thu CI). *Phần đã xanh: client Node dùng token Keycloak THẬT đi qua APISIX chạy hết chuỗi `new→triaged→assigned→in_progress→(422)→resolved→closed` và đếm `ticket_events` (run #19). Phần CHƯA làm: màn hình React thật điều khiển bằng trình duyệt trên stack CI — hiện UI mới chỉ có fixture tại máy.*

### W3-06 — Tải tệp an toàn: SeaweedFS + ClamAV (TV1, hỗ trợ TV2) — TN-03→QĐ-3

- [x] Tài liệu TN-03 so sánh vị trí quét (plugin APISIX / dịch vụ đứng trước SeaweedFS / trong API) bằng nguồn chính thức; ADR 0007 chốt phương án (QĐ-3).
- [x] Luồng upload API theo QĐ-3 (`40cb46b`): `POST /api/tickets/:id/attachments` quét clamd INSTREAM/TCP trước, chỉ PUT object lên SeaweedFS khi sạch, metadata ghi bằng hàm `private.record_attachment` (migration 004, SECURITY DEFINER — `authenticated` không có INSERT nên không giả mạo `scan_status`). *Bằng chứng tại máy: 17 unit test (clamd/SeaweedFS giả ghi từng byte nhận được) trong 39/39 `npm.cmd test`; integration test 10 trong 10/10 `run-integration.mjs` trên PostgreSQL 17.10 + PostgREST 16.4 thật; migration-test 4/4 với 6 tệp SQL. ĐỘ LỆCH có chủ đích so với ADR: body JSON base64 thay vì multipart vì `multer` không phải dependency khai báo (CI cài bằng `npm ci` theo lock) — ghi rõ trong DTO, `contract.md`, `openapi.yaml`, ADR 0007.*
- [ ] Kiểm EICAR trên stack thật (CI hoặc máy có Docker). *Engine ClamAV thật CHƯA chạy lần nào — mới chỉ có clamd giả; chưa đưa upload vào `stack-test.mjs` vì còn phụ thuộc `TCPAddr` của image (Rủi ro mở 3).*

### W3-07 — Route APISIX + OTP Keycloak (TV1, hỗ trợ TV2)

- [x] Rà route APISIX cho `PATCH /api/tickets/:id/status` (phân quyền vai trò, rate limit, nhật ký, trần body). *Route `/api/*` không khai báo `methods` nên PATCH đi qua; `limit-req` 30 req/s + key `remote_addr`, `rejected_msg` 429 đổi sang JSON khớp hợp đồng lỗi của API; `nginx_config.http.client_max_body_size` nâng 1m → 20m trong `config.yaml` vì tệp 10 MiB nền base64 ~13,98 MB sẽ bị cổng chặn 413 trước khi tới clamd (`0de50a8`).*
- [ ] Kiểm chữ ký JWT ngay tại cổng bằng `openid-connect` — **đã thử và bắt buộc revert (CI run #15)**. *Bằng chứng: `openidc.lua:1244: accessing jwks url (http://localhost:8080/realms/dxdesk/protocol/openid-connect/certs) failed: connection refused → openid-connect exits with http status code 401`. Plugin không có khóa `jwks_uri` riêng nên luôn dùng giá trị Keycloak sinh theo `KC_HOSTNAME` công khai, mà `localhost` trong container APISIX không phải Keycloak → mọi token hợp lệ bị 401 (self-DoS). Chữ ký vẫn được kiểm trong API qua `OIDC_JWKS_URL` nội bộ (xanh từ CI tuần 2). Bật lại cần ADR riêng với một trong hai phương án đã ghi trong `apisix.yaml`: (1) bỏ `KC_HOSTNAME` để URL sinh theo Host của từng bên gọi + `claim_validator.issuer.valid_issuers`; (2) `bearer_only` + `introspection_endpoint` nội bộ, đòi `dxdesk-api` là confidential client.* *Trạng thái sau revert: run #19 XANH toàn bộ — `Token accepted by API and PostgREST` PASS, nghĩa là chữ ký vẫn được kiểm ở API bằng `OIDC_JWKS_URL` nội bộ và `Anonymous API denied` vẫn chặn đúng yêu cầu không token (401).*
- [x] OTP (TOTP) trong realm cho user mẫu — làm dạng tùy chọn để không phá harness SSO hiện tại; hướng dẫn bật trong `docs/cai-dat.md`. *`realm-dxdesk-otp.json` chỉ thêm `requiredActions: CONFIGURE_TOTP` cho 4 user demo + đổi displayName; `realm-dxdesk.json` gốc không đổi nên harness native-sso vẫn dùng password grant.*
- [ ] Đăng nhập SSO + OTP trên stack thật (CI).

### W3-08 — TN-04: SSO cho Wiki.js / Mattermost / Metabase (TV1, hỗ trợ TV3) — QĐ-2

- [x] Xác minh tài liệu chính thức từng ứng dụng (OIDC free hay trả phí); ADR 0008 + QĐ-2. *Các khẳng định về tài liệu ngoài repo (giới hạn body APISIX, Plugin Hub, phiên bản Wiki.js, bản trả phí Metabase) mới chỉ là dẫn nguồn, chưa kiểm chứng runtime.*
- [ ] Chạy runtime cả 3 ứng dụng — cần Docker; ghi rõ chưa thử runtime nếu chỉ đọc tài liệu.

### W3-09 — Kiểm thử RLS trong CI (TV2, hỗ trợ TV1)

- [x] Rà bộ RLS trong `tools/testing/run-integration.mjs`, mở rộng cho các trạng thái/máy trạng thái mới. *Test 9 "W3: state machine, poka-yoke and SLA bookkeeping" phủ 22 tình huống, gồm cả đường ghi thẳng PostgREST bị guard trigger chặn.*
- [x] Job CI chạy bộ RLS + máy trạng thái trên PostgreSQL service — thêm vào `ci.yml`. *Job `rls-integration` (đã đổi tên "TN-02 RLS + máy trạng thái tuần 3") chạy `npm run integration` = 10 test trên PostgreSQL 17 + PostgREST 16.4; job `build và test ứng dụng (api)` chạy 39 unit test API (có test so sánh bảng cạnh DB ↔ `state-machine.ts`) và job `(web)` chạy 64 test web (có test so sánh nút UI ↔ bảng cạnh DB).*
- [x] CI xanh toàn bộ sau khi push tuần 3. *Run #19 (push, `40cb46b`): 9/9 job success — `docker compose config`, `kiểm tra apisix.yaml`, `shellcheck`, `reuse lint`, `build và test ứng dụng (api)`, `(web)`, `TN-02 RLS + máy trạng thái tuần 3`, `giao diện desktop và mobile (fixture)`, `nghiệm thu stack tuần 2`. Run #20 (pull_request, CÙNG SHA) đỏ ở step "Khởi chạy lần hai" vì cổng giữ địa chỉ IP cũ của api sau recreate; #21/#22 (`1bf76fe`, đã thêm retry 60s) cũng đỏ cùng step → "xanh TOÀN BỘ" chỉ đúng với `40cb46b`, còn bản sửa thì 8/9 job xanh và bước cuối vẫn chờ CI.*

### Nợ tuần 2 cần đóng trong tuần này

- [x] Tái hiện/loại trừ CI #10 fail (flaky). *ĐÃ có log thật (tải bằng credential git, không cần màn hình đăng nhập): run #10 = `40314468661` đỏ đúng step "Khởi chạy lần hai, giữ dữ liệu" với `502 !== 200`; dấu vết trong `apisix-1`: `connect() failed (113: No route to host) ... upstream: http://172.18.0.9:3000/api/health`. Chuỗi thời gian: `web/api Recreate` lúc 11:24:16 → API healthy → request lúc 11:24:46 (đúng ~30 giây sau recreate, và run #20 cũng chết ở ~30 giây sau recreate) vẫn gửi tới địa chỉ IP CŨ của container đã bị dựng lại. Cùng chữ lỗi ở run #17 (`0de50a8`) và run #20 (`40cb46b`), trong khi run #9/#18/#19 cùng SHA lại xanh vì IPAM tình cờ cấp lại đúng IP cũ. Nói cách khác: KHÔNG phải lỗi RLS/máy trạng thái, mà là cổng APISIX giữ địa chỉ upstream cũ sau bước `dxdesk.mjs up` dựng lại image. **Giả thuyết ban đầu "TTL ~30 giây nên chỉ cần retry" đã bị chính CI bác bỏ**: run #21 (`1bf76fe`, đã có `requestSettled()` chờ 60s) vẫn 502 ở giây thứ 79 sau recreate. Bản sửa hiện tại gồm hai phần: (1) `infra/apisix/config.yaml` đặt `nginx_config.http.dns_resolver_valid: 5` để cổng phân giải lại sau 5 giây; (2) harness retry có chặn 60s, chỉ cho 502/503/504 ở hai check đi qua upstream vừa bị recreate. Chưa run nào xanh với bản (1)+(2) — mục này chỉ đóng sau khi CI xác nhận.*
- [ ] PR #3 có ít nhất 1 review. *Người dùng yêu cầu "push lên đi và merge vào main tất cả", nên phần merge thực hiện bằng fast-forward `develop-quyennnv → main` theo lệnh đó; việc một thành viên khác duyệt thì vẫn chưa có và không tự tick hộ.*
- [ ] Tag và phát hành v0.1.0 (sau merge). *Không nằm trong phạm vi được ủy quyền lần này.*
- [x] Cập nhật `ke-hoach-tuan-2.md`: thêm "Chặng 9: đính chính trạng thái" (26/10) — giữ nguyên nhật ký 21/10, ghi rõ số test mới, giới hạn của harness so với `stack-test.mjs`, và việc workspace này không có git remote.

## Tiêu chí hoàn thành tuần 3 (M2 — nguyên văn từ kế hoạch triển khai)

1. Nhân viên mẫu đăng nhập SSO + OTP, tạo ticket VPN có ảnh chụp màn hình, ticket chuyển `new` và có bản ghi `ticket_events`.
2. curl với token nhân viên + `priority=critical` → 403.
3. Tải tệp EICAR bị chặn; tệp hợp lệ chỉ mở được bằng URL ký.
4. Kiểm thử RLS và máy trạng thái chạy trong CI.
5. QĐ-2 (TN-04) và QĐ-3 (TN-03) đã chốt.

### Trạng thái tiêu chí M2 (26/10/2026 22:05, sau CI run #19 xanh trên `40cb46b`)

| # | Tiêu chí | Trạng thái | Bằng chứng hiện có | Còn thiếu |
|---|---|---|---|---|
| 1 | SSO + OTP + tạo ticket + `ticket_events` | Đạt phần SSO/ticket/events; OTP chưa | Run #19 PASS `Keycloak users authenticate` (4 user thật, password grant), `Token accepted by API and PostgREST`, `API creates a ticket and PostgreSQL audit`, `W3-01 state machine over APISIX with ticket_events` và `Ticket from previous startup is preserved` (đúng 1 events) | Bật TOTP thật cho user mẫu rồi đăng nhập (realm OTP mới là tệp cấu hình, chưa chạy); ảnh chụp màn hình đính kèm trên stack thật |
| 2 | `priority=critical` với token nhân viên → 403 | Đạt | Run #19 PASS `Critical restricted to Manager` — nhân viên bị 403 qua APISIX với token Keycloak thật, Manager tạo được; integration test 4 chặn cả đường PostgREST trực tiếp | — |
| 3 | EICAR bị chặn, tệp hợp lệ chỉ mở bằng URL ký | Chưa đạt (đã có mã, chưa có engine thật) | Endpoint W3-06 trong `40cb46b`: 17 unit + integration test 10 xanh với clamd/SeaweedFS GIẢ trên DB THẬT; `client_max_body_size` 20m ở cổng | clamd thật chưa quét EICAR; presigned GET chưa làm (dồn tuần 4) |
| 4 | Test RLS + máy trạng thái chạy trong CI | Đạt | Run #19: job `TN-02 RLS + máy trạng thái tuần 3` (10 test trên PostgreSQL 17 + PostgREST 16.4 service) và hai job `build và test ứng dụng (api)` / `(web)` (39 + 64 unit test) đều xanh; job stack chạy máy trạng thái qua APISIX thật | Flake ở step "Khởi chạy lần hai" đã sửa nhưng CHƯA có run xanh với chính bản sửa đó (mới chỉ xanh nhờ ăn may IPAM) |
| 5 | QĐ-2, QĐ-3 đã chốt | Đạt (chờ kiểm chứng runtime) | ADR 0007 (QĐ-3), ADR 0008 (QĐ-2), mục lục `docs/adr/README.md` | Chạy Wiki.js/Mattermost/Metabase và EICAR trên stack Docker |

## Rủi ro mở (phải kiểm chứng bằng CI, không kết luận tại máy)

1. ~~`jwks_uri` của `openid-connect` không tới được từ container APISIX~~ → **đã xác nhận là hỏng thật** (CI run #15) và đã revert; theo dõi ở W3-07. Hệ quả chưa kiểm chứng được: các plugin mới của cổng (`limit-req` 429, `client_max_body_size` 20m) chỉ được `scripts/check-apisix.sh` + job `kiểm tra apisix.yaml` xác nhận về schema, còn hành vi runtime 429/413 thì chưa có test nào trên stack thật.
2. `infra/keycloak/compose-otp.yml` chưa được `compose-config` job kiểm tra (job chỉ `config -q` tệp compose chính).
3. Image `clamav/clamav:1.5.4` có mặc định `TCPAddr 0.0.0.0` trong mạng compose hay chưa — ADR 0007 đã ghi là nợ tuần 4. CI run #13/#15 cho thấy `dxdesk.mjs up --wait` vẫn xanh nên clamd đã healthy, nhưng chưa có request quét thật nào đi qua nó.
4. ~~CI #10 (nợ tuần 2) fail ở step "Khởi chạy lần hai" mà không đọc được log~~ → **đã đọc log thật và tái hiện được**: cổng APISIX giữ địa chỉ IP cũ của container `api` sau khi `dxdesk.mjs up` recreate (chữ lỗi giống hệt ở #17, #20, #21). Hệ quả thật cho vận hành, không chỉ là chuyện CI: triển khai lại `api` phía sau một cổng đang chạy sẽ cắt traffic cho tới khi cổng phân giải lại — upstream cũng có issue tương tự (apisix-ingress-controller #2708). Đang thử khắc phục bằng `dns_resolver_valid: 5`; nếu run kế tiếp vẫn 502 thì phương án còn lại là bắt cổng reload sau deploy, và phải ghi thành một bước trong quy trình triển khai.
5. Hai run `push` và `pull_request` của cùng một SHA chạy song song trên hai VM GitHub, mỗi bên dựng stack Docker riêng nhưng dùng chung tên project `dx-desk` và cùng cấu hình; không có `concurrency` trong `ci.yml`. Nếu sau này chuyển sang self-hosted runner thì cặp này sẽ thật sự đâm cổng nhau — nên khai báo `concurrency` trước khi đổi runner.

## Bằng chứng nghiệm thu tại máy (26/10/2026, chạy lại toàn bộ sau mọi chỉnh sửa)

| Lệnh | Kết quả |
|---|---|
| `npm.cmd test` trong `apps/api` | `tests 39, pass 39, fail 0` (kèm `npm.cmd run build` sạch) — trùng khớp CI run #19 (`# tests 39 / # pass 39 / # fail 0`) |
| `npm.cmd test` trong `apps/web` | `Test Files 8 passed (8)`, `Tests 64 passed (64)` — trùng khớp CI run #19 |
| `npm.cmd run build` trong `apps/web` | build sạch, `Preserved runtime notices for 11 packages` |
| `node tools/testing/run-integration.mjs` | `# tests 10 / # pass 10 / # fail 0` — PostgreSQL 17.10 + PostgREST 16.4 thật, token RSA fixture tự ký (không phải Keycloak đang chạy); CI run #19 cũng `10/10` |
| `powershell.exe -NoProfile -File work/run-migration-test.ps1` | 4/4 PASS, `First run applies all 6 SQL files` (migrations 001..004 + policies 001,002), `Second run preserves data and migration timestamps` |
| `node tools/testing/check-config.mjs` | `PASS config references, env completeness, Keycloak audiences, YAML and package locks` |
| `node tools/testing/browser-smoke.mjs` | 7/7 PASS (fixture HTTP, không SSO thật) — ảnh `.local/reports/web-*.png` |
| Parse YAML/JSON thủ công cho `ci.yml`, `apisix.yaml`, `realm-dxdesk-otp.json` | parse OK, marker `#END` còn cuối tệp `apisix.yaml` |

## Bằng chứng CI (đọc qua GitHub REST API + log tải bằng credential git, không phải ảnh màn hình)

| Run | Sự kiện | SHA | Kết luận | Dấu vết |
|---|---|---|---|---|
| #19 `40341613068` | push | `40cb46b` | **completed success**, 9/9 job | Job stack PASS 15 check (restart) + 15 check (lần hai, giữ dữ liệu), trong đó `W3-01 state machine over APISIX with ticket_events`, `Critical restricted to Manager`, `Ticket from previous startup is preserved` |
| #20 `40341625485` | pull_request | `40cb46b` | failure ở step "Khởi chạy lần hai, giữ dữ liệu" | `502 !== 200`; `apisix-1`: `GET /api/health` → `upstream http://172.18.0.9:3000` `113: No route to host`; api/web `Recreate` lúc 14:42:32, request chết lúc 14:43:02 |
| #10 `40314468661` (nợ tuần 2) | pull_request | `208b046` | failure cùng step | Chữ lỗi giống hệt #20: `Recreate` 11:24:16 → 502 lúc 11:24:46 → kết luận #10 là flake cổng, không phải lỗi RLS/máy trạng thái |
| #17 `40341550562` | push | `0de50a8` | failure cùng step | Cùng dấu vết; #18 (pull_request, cùng SHA) xanh — cặp push/PR xen kẽ đỏ/xanh đúng tính chất flake |
| #9 `40313662751` | push | `208b046` | success | Run tuần 2 xanh, chứng tỏ #10 đỏ không phải do mã |
| #21 `40344269532` | push | `1bf76fe` | failure cùng step | Bản đã có retry 60s: `PASS Web served through APISIX` lúc 14:58:49 rồi vẫn 502 lúc 14:59:53 — recreate 14:58:34, tức **79 giây sau vẫn còn** → giả thuyết "TTL 30s tự hết" bị chính CI bác bỏ |
| #22 `40344276688` | pull_request | `1bf76fe` | failure cùng step | Cùng dấu vết với #21 |

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

### 26/10/2026 — Chặng 3: đóng CI stack thật, W3-06 và merge

- Điều tra 4 lượt CI đỏ bằng **log thật tải qua credential git** (không đoán): #11/#13 đỏ vì `stack-test.mjs` tạo ticket thiếu `fields` mà migration 003 bắt buộc cho danh mục `vpn` → API trả 422 thay vì 201 (`d2ff067` thêm fields + 3 check tuần 3 chạy trên stack thật).
- #15 vẫn đỏ và nguyên nhân gốc nằm trong `apisix-1`: `openidc.lua:1244 accessing jwks url (http://localhost:8080/realms/dxdesk/...) failed: connection refused → openid-connect exits with 401`. Plugin `openid-connect` không có khóa `jwks_uri` riêng, luôn lấy giá trị từ discovery doc mà Keycloak sinh theo `KC_HOSTNAME` công khai → `localhost` trong container cổng không phải Keycloak → cổng tự chặn chính token hợp lệ. Đã revert (`0de50a8`): bỏ plugin khỏi route `/api/*`, giữ verification trong API qua `OIDC_JWKS_URL`, ghi rõ hai phương án bật lại + ADR riêng trong W3-07. Thêm `ec28bd0` để 401 tự in `WWW-Authenticate` (lý do thật) thay vì chỉ số 401.
- W3-06 (`40cb46b`, 12 tệp/919 dòng): `POST /api/tickets/:id/attachments` theo QĐ-3 — chặn type + trần byte TRƯỚC khi chạm clamd, kiểm khả kiến theo RLS TRƯỚC khi lưu (không để object mồ côi), quét INSTREAM/TCP, chỉ PUT SeaweedFS khi sạch, metadata ghi bằng `private.record_attachment` (SECURITY DEFINER, migration 004). Kiểm an toàn: `PGRST_DB_SCHEMAS=public` nên RPC `private` không gọi được từ REST, `authenticated` không có INSERT trên `attachments`, `object_key` UNIQUE do server sinh. Self-review phát hiện ADR 0007 mô tả multipart trong khi mã đi nền base64 JSON → sửa ADR + ghi đúng độ lệch có chủ đích trong `contract.md`/`openapi.yaml`, và vì APISIX đóng gói sẵn `client_max_body_size: 1m` nên tệp 10 MiB nền base64 ~13,98 MB sẽ bị 413 trước clamd → nâng trần 20m ở `config.yaml`.
- **Run #19 (push, `40cb46b`) xanh 9/9 job** — lần đầu stack thật PASS hết: SSO Keycloak, SLA, Poka-yoke 422, máy trạng thái `new→…→closed` kèm đếm `ticket_events`, `critical` chỉ Manager (403), RLS hai chiều, n8n sống sau restart, và "Khởi chạy lần hai, giữ dữ liệu".
- Đóng nợ tuần 2 (CI #10): log #10, #17, #20 trùng một chữ lỗi — `up` recreate api/web rồi cổng APISIX vẫn gọi vào IP cũ (`113: No route to host` → 502). Harness chạy trên VM khác nhau nên #9/#18/#19 chỉ xanh do IPAM cấp lại đúng IP cũ.
- Giả thuyết "TTL ~30s, chỉ cần retry" đã bị CI bác bỏ ngay ở run kế tiếp: #21 (`1bf76fe`, có `requestSettled()` chờ 60s) vẫn 502 sau 79 giây, #22 đỏ cùng chỗ. Đang sửa tận gốc bằng `nginx_config.http.dns_resolver_valid: 5` trong `infra/apisix/config.yaml` (key lấy từ `conf/config.yaml.example` của APISIX: "Override the default TTL of the DNS records") + giữ retry 60s. Hệ quả vận hành ghi ở Rủi ro mở 4: deploy lại `api` phía sau cổng đang chạy sẽ cắt traffic cho tới khi cổng phân giải lại.
- Gộp lại toàn bộ bằng chứng: bảng "Bằng chứng CI" mới, bảng test tại máy cập nhật 39/64/10 và `First run applies all 6 SQL files` (chạy lại `run-migration-test.ps1` 4/4 ngay trước khi commit), tiêu chí M2 viết lại theo run #19.
- Người dùng yêu cầu push và merge toàn bộ vào main. Đường an toàn là fast-forward `develop-quyennnv → main` vì `origin/main = 6da06d2` đã là ancestor của nhánh này — không force-push, không squash, không tag, không gửi thông báo cho BTC.

