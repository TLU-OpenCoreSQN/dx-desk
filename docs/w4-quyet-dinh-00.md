# W4-00 — Hồ sơ quyết định, contract freeze và quyền (BẢN SOẠN THẢO)

> **Cập nhật triển khai 02/11/2026:** nội dung bên dưới là hồ sơ đề xuất tại snapshot
> `72f72d7`, không mô tả đầy đủ source bàn giao hiện tại. Người dùng sau đó cho phép
> **“cứ build sao cho phù hợp với prj, source đã có”**. Các mặc định kỹ thuật đã triển khai,
> mapping migration/endpoint và giới hạn được ghi tại [báo cáo tuần 4](hoan-thien-tuan-4.md)
> và [contract hiện hành](api/contract.md). Đây là ngoại lệ thực thi kỹ thuật theo chỉ đạo
> mới, không phải chữ ký phê duyệt của các thành viên. Các nhãn CHỜ KÝ giữ nguyên.
> Mọi “chưa tồn tại”/số dòng dưới đây chỉ áp dụng snapshot lịch sử, không dùng làm
> danh sách việc còn thiếu của PR W4 hiện tại.

> **Bản SOẠN THẢO phục vụ W4-00 — chưa phải contract đã khóa, chưa được phê duyệt, chỉ bắt đầu
> hiệu lực sau khi C23-11 DONE.**
>
> **SHA cơ sở:** `72f72d7` (kiểm chứng bằng `git rev-parse --short HEAD` tại thời điểm soạn).
> **Ngày soạn:** 02/11/2026 (ICT). **Tác giả:** A-CONTRACT (Quyền).
> **Reviewer bắt buộc khi chốt:** Nguyên (platform/QA), Séc (web/data).
> **Trạng thái từng quyết định:** `CHỜ KÝ` — không quyết định nào trong file này đã được đội phê duyệt.

---

## 0. Cách đọc tài liệu này

| Nhãn | Ý nghĩa |
|---|---|
| **[HIỆN CÓ]** | Đã tồn tại trong repo tại `72f72d7`, có `file:line` kiểm chứng được. |
| **[ĐỀ XUẤT — CHƯA TỒN TẠI]** | Hợp đồng/bảng/endpoint/cột **chưa có** trong repo. Cấm frontend hoặc workflow gọi trước khi contract được khóa. |
| **[KHÓA]** | Thuộc `db/migrations/001…007` hoặc `db/policies/001…002`, đã vào ledger checksum (`infra/postgres/init/02-migrations.sh:16-18, 26-36`), **chỉ đi được bằng migration forward-only**. |

**Cờ tuân thủ gate (phải nói thẳng):** `docs/ke-hoach-tuan-4.md:12` và `:391` cấm viết
*code/contract/test* W4 khi nợ C23 chưa đóng. File này là **hồ sơ chuẩn bị** theo chỉ đạo trực tiếp
của lead, được đánh dấu SOẠN THẢO + `CHỜ KÝ` ở mọi mục, và **không được dùng làm căn cứ để ghi
code**. Nếu đội coi việc soạn file này là vi phạm gate, giải pháp là giữ nguyên file ở trạng thái
draft và không đóng checkbox nào của W4-00 cho tới khi C23-11 DONE.

**Mọi `file:line` trong tài liệu này do người soạn mở trực tiếp tại `72f72d7`**, không suy đoán.
Không trích secret; các giá trị trong `.env` không được mở hoặc in.

**Cơ sở của số dòng khi ký:** `db/**`, `apps/**`, `infra/**`, `.env.example` và `tools/**` **không** bị
sửa trong working tree tại thời điểm soạn (`git status` sạch với các đường dẫn này) ⇒ mọi trích dẫn
SQL/TS/compose trong file bằng đúng nội dung của `72f72d7`. Ngược lại `docs/api/contract.md`
(+10/+11 dòng tại các hunk 87 và 117) và `docs/api/openapi.yaml` (+7 dòng tại `info:`) **đang có sửa đổi
chưa commit của A-DOC**; các trích dẫn `docs/api/*` trong file này là theo bản working tree và **số dòng
có thể lệch** — khi ký phải đối chiếu theo *nội dung*, không theo số dòng.
`docs/ke-hoach-tuan-4.md` là tệp mới chưa được commit (untracked), trích dẫn theo working tree do lead sở hữu.

---

## 1. Kiểm tra lại 6 nút thắt lead đưa ra — xác minh / hiệu chỉnh / bác bỏ

| # | Nhận định của lead | Kết luận | Bằng chứng mở tại `72f72d7` |
|---|---|---|---|
| 1 | Cạnh `new→triaged→assigned` chỉ cho `Agent`/`Manager`; trigger kiểm `realm_access.roles` từ JWT; API chặn token lạ ⇒ automation không còn đường hợp lệ | **ĐÚNG, và còn chặt hơn lead nói** — có **4** lớp khóa, không phải 3 | `db/migrations/003_ticket_workflow.sql:98, 101` (roles `ARRAY['Agent','Manager']`); `db/migrations/005_ticket_integrity.sql:96-105` (roles đọc từ claims, SQLSTATE 45002); `apps/api/src/auth.ts:19-21` (whitelist Employee/Agent/Manager); **bổ sung:** `db/policies/002_postgrest_claims.sql:37` (PostgREST pre-request cũng bắt buộc `roles ?\| ARRAY['Employee','Agent','Manager']`) và **`db/migrations/003_ticket_workflow.sql:231-232`** — RLS `tickets_update USING (requester_id = private.user_id() OR private.is_staff())` chặn **trước cả trigger**; `private.is_staff()` = `has_role('Agent') OR has_role('Manager')` (`db/migrations/001_schema.sql:21-24`) |
| 2 | `003:242` chỉ grant `UPDATE (status, resolution_note, sla_paused_ms, waiting_since, updated_at)` ⇒ `assigned_to` không ghi được từ API | **KẾT LUẬN ĐÚNG, DẪN CHỨNG CŨ** — `005_ticket_integrity.sql:68` đã **REVOKE** 3 cột `sla_paused_ms, waiting_since, updated_at`; quyền UPDATE *hiệu lực* của `authenticated` hôm nay chỉ còn **`(status, resolution_note)`**. `assigned_to` không có grant INSERT lẫn UPDATE ở bất kỳ file nào (`db/policies/001_rls.sql:49`, `003:241-243`) | Như cột; đối chiếu `docs/ke-hoach-tuan-4.md:544` (W4-02C đòi row lock/RLS/guard) |
| 3 | `audit_ticket_status_change()` dùng `coalesce(private.user_id(), NEW.requester_id)` ⇒ hành động hệ thống bị gán cho người tạo ticket | **ĐÚNG** — hàm gốc ở `003:170-189`, **bản ghi đè hiệu lực** là `005_ticket_integrity.sql:124-136`, câu `coalesce` nằm ở **dòng 128** (lead ghi 127 = dòng INSERT, lệch 1 dòng, không đổi bản chất). Phá thẳng yêu cầu M3 "audit phân biệt tác nhân hệ thống" (`docs/ke-hoach-tuan-4.md:326`) | `db/migrations/005_ticket_integrity.sql:128`; `db/migrations/001_schema.sql:65` (`actor_id uuid NOT NULL`) |
| 4 | `ticket_events.event_type` CHECK chỉ nhận `('created','status_changed')` ⇒ mọi event type mới cần migration forward-only | **ĐÚNG** — `db/migrations/001_schema.sql:66`. `003:245-246` ghi nhận CHECK *hiện* đủ cho `{from,to,note}` nhưng không đủ cho `assignment_changed`/`sla_notice`/`ticket_routed`. Kế hoạch cũng tự nhận "audit hiện chỉ `created/status_changed`" (`docs/ke-hoach-tuan-4.md:449`) | `db/migrations/001_schema.sql:66`; `docs/ke-hoach-tuan-4.md:449` |
| 5 | Thêm cột nhưng chưa REVOKE có tự mở quyền ghi không? | **KHÔNG.** Grant UPDATE hiện tại ở mức cột chỉ còn status/resolution_note; thêm cột không tự kế thừa quyền. Rủi ro là migration cấp nhầm table-level/column grant rộng hoặc hàm definer thiếu guard. Bảng public có thể xuất hiện trong schema REST, nhưng truy cập dữ liệu vẫn cần GRANT/RLS; không đồng nghĩa ai cũng đọc/ghi được. GET API dùng SELECT * còn gây drift contract khi thêm cột. | db/migrations/003_ticket_workflow.sql; 005_ticket_integrity.sql; db/policies/001_rls.sql; .env.example PGRST_DB_SCHEMAS |
| 6 | Không có bảng `public.users`; `assigned_to`/`requester_id` không FK; tên người chỉ đến từ claims | **ĐÚNG HOÀN TOÀN** | Liệt kê đầy đủ bảng: `db/migrations/001_schema.sql:26,33,39,45,62,71,83` + `003:90` (`private.ticket_transitions`) — không có `users`. `requester_id` (`001:47`) và `assigned_to` (`001:55`) khai `uuid` thuần, không `REFERENCES`. Tên người dùng lấy từ token: `apps/api/src/controllers.ts:64-70` (`GET /api/me` trả `claims.preferred_username`) và `apps/web/src/services/keycloak.ts:131`. UI hiện in **UUID thô**: `apps/web/src/pages/TicketListPage.tsx:434-444` (hiện `assigned_to`), `apps/web/src/pages/TicketDetailPage.tsx:402, 421-424` (hiện `requester_id`/`assigned_to`). ADR 0002:31 cấm bảng user **chứa mật khẩu** — không cấm roster, cần nói rõ để đội không hiểu nhầm |

**Bác bỏ/sửa của người soạn đối với lead:** (a) ý 2 dẫn chứng cũ như trên; (b) ý 5 cần đọc lại: mối
đe dọa chính không phải "thêm cột mà quên REVOKE" mà là **bảng mới đặt ở `public`**; (c) ý 6 nên bổ
sung rằng ADR 0002:31 **không** cấm bảng roster — chỉ cấm bảng user chứa mật khẩu, nên team/roster
là hợp lệ về mặt án lệ.

---

## 2. Nút thắt người soạn phát hiện thêm (lead chưa nêu)

| ID | Nút thắt mới | Bằng chứng [HIỆN CÓ] | Vì sao nó chặn W4 |
|---|---|---|---|
| **N1** | Test parity **đọc thẳng text của migration 003** và hard-code **17 cạnh** | `apps/api/test/workflow.test.mjs:55-72` (`readFileSync('db/migrations/003_ticket_workflow.sql')`, `assert.equal(edges.length, 17)`, so `roles`/`requesterAllowed` từng cạnh với `ROLE_EDGES`) và `apps/api/test/integration.mjs:475` (`SELECT * FROM private.ticket_transitions`, `assert.equal(edges.length, 17)`) | Migration 008 thêm cạnh (VD `new→assigned`) hoặc **đổi role của cạnh cũ** sẽ làm **CI đỏ** và test buộc phải sửa — nhưng 003 không sửa được (checksum). Đội chưa quyết harness đọc "mô hình hiệu lực" từ DB hay đọc text 003. `docs/ke-hoach-tuan-4.md:775` đã cấm "sửa 003 để test qua" nhưng chưa nói harness thay đổi thế nào |
| **N2** | `SELECT *` ở API ⇒ **mọi cột mới tự rò vào payload công khai** | `apps/api/src/controllers.ts:83` (`SELECT * FROM public.tickets`), `:102-104` (`SELECT * FROM public.ticket_events`) | Thêm `assigned_team_id`, `sla_breached`, `ticket_version`, `actor_type` sẽ **tự đổi contract GET /api/tickets và /events** mà không ai sửa DTO/OpenAPI. Đây là rủi ro lớn nhất của "contract freeze": hợp đồng bị drift bởi migration, không bởi code |
| **N3** | `validateClaims` nằm **bên trong** `JwtGuard.canActivate` — không tách được cho route service | `apps/api/src/auth.ts:33-47` (dòng 42 gọi `validateClaims`); `@UseGuards(JwtGuard)` gắn trên `DeskController` (`controllers.ts:61`), `AttachmentsController` (`:212`), `AttachmentLinksController` (`downloads.ts:33`) | W4-02A đòi "không nới `validateClaims` người dùng" (`docs/ke-hoach-tuan-4.md:509`), nhưng hiện **không tồn tại** cơ chế guard thay thế. Route service bắt buộc là **guard lớp mới + controller riêng**, không phải tham số của guard cũ |
| **N4** | Callback vào n8n đi qua `/webhook/*` **không có plugin xác thực và không có limit-req** | `infra/apisix/apisix.yaml:56-61` (route `n8n-webhook`, không khai `plugins`); đối lập `/api/*` (`:68-77`) và `/rest/*` (`:12-44`) đều có `openid-connect` + `limit-req` |Webhook nhận event nghiệp vụ mà gate không kiểm gì; chỉ an toàn nhờ APISIX bind `127.0.0.1` (`infra/compose/docker-compose.yml:111`). W4-02A:512 đã cảnh báo "không mặc định `/webhook/*` công khai là an toàn" nhưng **quyết định cơ chế xác thực chưa tồn tại** |
| **N5** | "System actor" cần cơ chế truyền danh tính xuống DB, nhưng mọi kiểm tra DB hiện đọc `request.jwt.claims` và GUC `role` | `db/migrations/001_schema.sql:9-24` (`private.claims()/user_id()/has_role()`); `apps/api/src/database.ts:36-39` (`SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', …)`); `db/migrations/005_ticket_integrity.sql:22-24` (`IF current_setting('role', true) IS DISTINCT FROM 'authenticated' THEN RETURN NEW`) | Dispatcher/worker nếu nối DB **không qua `asUser`** sẽ: (a) lọt `guard_ticket_insert` vì `role ≠ authenticated` (bỏ qua toàn bộ Poka-yoke), hoặc (b) `private.user_id()` = NULL → audit rơi về fallback requester (ý 3). Chưa có quyết định nào về **kênh danh tính hệ thống tin cậy** |
| **N6** | Mattermost chạy ở **compose project khác**, không cùng mạng với n8n/API | `infra/compose/tn04.yml:32-55` (`profiles: [mattermost]`, site URL `http://localhost:13002`, host bind `127.0.0.1`), `infra/compose/docker-compose.yml:7` (`name: dx-desk`, không khai network chung/external) | `n8n` trong project `dx-desk` gọi `http://localhost:13002` sẽ tới **chính nó**, không tới Mattermost. W4-01B/04 chưa có quyết định: thêm `networks:` chung, dùng `host.docker.internal`, hay chuyển Mattermost vào main compose |
| **N7** | Runner migration áp `db/policies/*.sql` **sau toàn bộ** `db/migrations/*.sql` trong cùng một vòng lặp, ledger đặt tên theo `<dir>/<file>` | `infra/postgres/init/02-migrations.sh:22-48` (`for migration_dir in "${MIGRATIONS_DIR}" "${POLICIES_DIR}"`, tên `migrations/008…` vs `policies/003…`) | Bảng mới tạo ở `migrations/008` **phải** có RLS+policies trong **chính 008**, hoặc trong `policies/003_*` (chạy sau, OK cho cả bootstrap lẫn upgrade). Nếu đội tưởng "policies luôn chạy trước" là sai; và số `008` không xung đột `policies/003` vì namespace khác nhau |
| **N8** | Realm Keycloak **không có client service-account confidential** nào cho automation; `dxdesk-api` là `bearerOnly` | `infra/keycloak/realm-dxdesk.json:15-21` (chỉ 3 realm role Employee/Agent/Manager), `:60-65` (`dxdesk-api`, `bearerOnly: true`), `:104-145` (4 user demo, không service account) | W4-02A:508 cần client confidential + role hẹp (`ticket-automation`) ⇒ **A-PLATFORM phải sửa realm import**, kéo theo `tools/testing/gateway-test.mjs` (các ca 401/403 theo iss/aud, `:62-90`) và `scripts/render-gateway.mjs:12-14` (audience render vào APISIX). Không phải việc "chỉ thêm JSON" |
| **N9** | `sla_policies.response_minutes` tồn tại nhưng **không code nào dùng** | Khai báo `db/migrations/001_schema.sql:36`, seed `db/migrations/002_reference_data.sql:8-9`; grep toàn repo: **0** tham chiếu trong `apps/api/src`, `apps/web/src`, `tools`, `tests` | QĐ về "phản hồi đầu tiên" của W4-03A (`docs/ke-hoach-tuan-4.md:563`) đang dựa trên một cột **trần, chưa có hợp đồng semantics**. Phải chốt: dùng cột này, hay định nghĩa `first_response_at` mới |

---

## 3. Hồ sơ quyết định

Mẫu mỗi mục: **Vấn đề | Bằng chứng | Phương án A | Phương án B | Rủi ro bảo mật / mixed-state |
Khuyến nghị + lý do | File/migration/test phải đổi nếu chọn | Người ký.**

---

### QĐ-01 — Đường đi hợp lệ cho automation trên máy trạng thái (nút thắt 1)

- **Vấn đề:** Auto-route M3 phải đẩy `new→triaged→assigned` (`003:98,101`) nhưng 4 lớp khóa chỉ nhận
  `Agent`/`Manager`: cạnh DB, trigger role-check, RLS `tickets_update` USING, `check_request` của
  PostgREST, cộng `validateClaims` của API. Trong khi W4-02A cấm cấp role giả cho bot
  (`ke-hoach:508`) và B.9 cấm gán Manager cho bot.
- **Bằng chứng [HIỆN CÓ] [KHÓA]:** `003:97-114`, `003:231-232`, `005:96-105`,
  `db/policies/002_postgrest_claims.sql:34-40`, `apps/api/src/auth.ts:19-21`,
  `apps/api/src/database.ts:36-39`.
- **Phương án A — "service actor inside the machine":** cấp role `Agent` cho một service account
  Keycloak chuyên dụng; bot gọi `PATCH /api/tickets/:id/status` như mọi Agent.
- **Phương án B — "definer RPC + guard service riêng":** bot gọi `POST /api/system/tickets/:id/route`
  (MỘT thao tác nghiệp vụ); controller đi qua **guard service mới** (không dùng `JwtGuard`), rồi gọi
  `private.route_ticket(...)` SECURITY DEFINER, hàm này *tự* kiểm cạnh hợp lệ và tự kiểm
  `actor_type=system` trước khi UPDATE 2 bước; RLS không còn là rào cản vì hàm chạy với quyền owner,
  và **toàn bộ kiểm tra cạnh được tái lập trong hàm** (đúng khuôn mẫu `004:21-55` đã tái lập predicate
  `tickets_read`).
- **Rủi ro A:** vi phạm ràng buộc đã chốt của kế hoạch (`ke-hoach:508`, B.9); một bot mang `Agent`
  automatically có quyền `in_progress→resolved`, `→pending_approval` đọc **toàn bộ** ticket
  (`db/policies/001_rls.sql:25-26` staff reads all) và được `routing_rules` — tức **đặc quyền rộng hơn
  nhiều so với scope nghiệp vụ**; mọi audit log sẽ ghi actor là một "Agent" không phải người ⇒ không
  phân biệt được hệ thống với người (mâu thuẫn thẳng với M3 `ke-hoach:326`). Mixed-state: nếu demo
  dùng tài khoản Agent của `agent.1` (`realm-dxdesk.json:126-134`), người thật và bot thành một.
- **Rủi ro B:** hàm definer là *mặt attack surface mới*: phải `SET search_path = pg_catalog`,
  `REVOKE ALL FROM PUBLIC` (`001:106`, `004:58`, `007:11` là án lệ), và **không** expose qua PostgREST
  (`PGRST_DB_SCHEMAS=public`, `.env.example:33`). Nếu hàm cho phép truyền `team`/`assignee`/`fields`
  tự do thì biến thành "SQL proxy". Mixed-state: hai đường cập nhật (API user + RPC system) phải
  dùng **cùng** bảng cạnh `private.ticket_transitions`, nếu không đồ thị sẽ trôi.
- **Khuyến nghị: B**, với 4 điều kiện không được bỏ: (1) hàm nhận đúng `(p_ticket_id, p_event_id)` —
  **không** nhận `to_status`/`team` từ caller; server tự chọn rule; (2) hàm tự kiểm cạnh
  + `requester_allowed` y hệt `005:86-105`; (3) set context hệ thống qua GUC do guard dựng, không từ
  body (xem QĐ-03, N5); (4) test phủ **cả hai đường** REST và API như `integration.mjs:473-491` đang
  làm. Lý do: phương án A đạt demo nhanh nhưng phá 3 ràng buộc an ninh đã ghi thành văn bản, còn B chỉ
  tốn một migration + một guard.
- **File/migration/test phải đổi nếu chọn:** **MỚI** `db/migrations/008_outbox_actor.sql`
  (context hệ thống + outbox), **MỚI** `apps/api/src/automation-auth.ts` +
  `automation-controller.ts` (tên theo `ke-hoach:793`), `apps/api/src/app.ts:44` (đăng ký controller),
  `infra/keycloak/realm-dxdesk.json` (client confidential — **A-PLATFORM ghi, không phải Quyền**),
  `infra/apisix/apisix.yaml:68-77` (route `/api/system/*` vẫn sau JWT gateway?),
  `tools/testing/gateway-test.mjs:62-90`, **MỚI** `apps/api/test/automation-auth.test.mjs`.
- **Người ký:** **Quyền** (nội dung RPC + guard) + **Nguyên** (realm/gateway) — cả hai, thiếu một là chưa đóng.

---

### QĐ-02 — Cơ chế ghi `assigned_to` (nút thắt 2)

- **Vấn đề:** `assigned_to` không có grant nào cho `authenticated` ⇒ `POST /api/tickets/:id/claim`
  (W4-02C) và auto-assign (W4-02B) hiện **bất khả thi** mà không đổi DB.
- **Bằng chứng:** `db/policies/001_rls.sql:49` (INSERT 4 cột), `003:241-243` (UPDATE 5 cột),
  `005:68` (REVOKE 3 cột) ⇒ hiệu lực = `status, resolution_note`; `001:55` cột `uuid` không FK;
  `003:217` + `db/policies/001_rls.sql:30` yêu cầu `assigned_to IS NULL` khi INSERT.
- **Phương án A:** `GRANT UPDATE (assigned_to) ON public.tickets TO authenticated` + CHECK/trigger.
- **Phương án B:** `private.claim_ticket(p_ticket_id uuid, p_expected_version int)` SECURITY DEFINER,
  `assigned_to := private.user_id()` (danh tính **từ claims**, không từ body) + row lock
  `FOR UPDATE`, `REVOKE FROM PUBLIC`, `GRANT EXECUTE TO authenticated`.
- **Rủi ro A:** mọi token Employee hợp lệ (kể cả `employee.a` demo) đều **tự gán mình vào mọi ticket
  nhìn thấy**; CHECK cấp cột không thể kiểm "thuộc team nào", "đang open", "roster hợp lệ" ⇒ cần trigger
  thứ hai, tức cuối cùng vẫn là B nhưng với bề mặt grant rộng hơn. Mixed-state: `assigned_to` đổi mà
  `status` không đổi → ticket `assigned` nhưng chưa từng đi cạnh `triaged→assigned`.
- **Rủi ro B:** definer bỏ qua RLS — nếu quên kiểm "Agent này có thuộc team của ticket không" thì bot
  hoặc Agent ngoài team claim được. Cần `SELECT ... FOR UPDATE` để hai Agent tranh nhau một thắng
  (`ke-hoach:548`) và cần từ chối khi ticket `closed`/`cancelled` (callback muộn, `ke-hoach:667`).
- **Khuyến nghị: B** — cùng khuôn mẫu an toàn đã được review 3 lần trong repo (`004:21-59`,
  `006:4-37`, `007:5-13`), giữ nguyên tắc "column grants prevent forged ownership"
  (`db/policies/001_rls.sql:48`). A mâu thuẫn trực tiếp với án lệ ADR 0002:18.
- **File/migration/test:** `db/migrations/009_assignment_team.sql` (xem QĐ-11),
  **MỚI** `apps/api/src/ticket-assignment.ts`, `apps/api/src/controllers.ts:149-179` (claim gọi RPC),
  `apps/api/src/dto.ts` (claim **không** có body), `apps/api/test/assignment.test.mjs` (MỚI),
  `apps/api/test/integration.mjs` (thêm ca), `docs/api/contract.md` + `docs/api/openapi.yaml`
  (**A-DOC sở hữu** — Quyền chỉ gửi đề nghị patch).
- **Người ký:** **Quyền** (A-DB/A-API) + **Séc** (consumer claim ở UI).

---

### QĐ-03 — Audit phân biệt tác nhân hệ thống (nút thắt 3 + N5)

- **Vấn đề:** `coalesce(private.user_id(), NEW.requester_id)` gán mọi hành động không-token cho người
  tạo ticket; `actor_id` NOT NULL; không có registry actor.
- **Bằng chứng:** `005:124-136` (dòng 128), `001:65`, `001:47` (`requester_id DEFAULT private.user_id()`),
  `003:176` (bản gốc cũng vậy), `ke-hoach:326` (M3 đòi audit phân biệt), `ke-hoach:473` ("không fallback
  bot thành requester").
- **Phương án A:** giữ cột `actor_id`, thêm **sentinel UUID** hằng số (VD `00000000-0000-4000-8000-…`)
  cho hệ thống; suy ra `actor_type` bằng `actor_id = sentinel`.
- **Phương án B:** migration mới `ALTER TABLE public.ticket_events ADD COLUMN actor_type text NOT NULL
  DEFAULT 'user' CHECK (actor_type IN ('user','system'))` + `actor_label text` (tên service, ví dụ
  `ticket-router`), và sửa trigger: `actor_id := coalesce(private.user_id(), <sentinel>)`,
  `actor_type := CASE WHEN private.user_id() IS NULL THEN 'system' ELSE 'user' END` dựng **từ context
  tin cậy** (GUC `app.system_actor` chỉ do RPC definer set), không từ body.
- **Rủi ro A:** `actor_type` **suy luận** được ⇒ mọi người dùng có UUID trùng sentinel (không có FK
  kiểm chứng, `001:55`) giả làm hệ thống; audit không đọc được tên service nào đã hành động; backfill
  sự kiện cũ không phân biệt nổi. Mixed-state: hai hệ thống "system actor" khác nhau dùng chung một
  con số.
- **Rủi ro B:** nếu đặt điều kiện `actor_type='system'` dựa trên claims **rỗng**, dispatcher quên
  `SET LOCAL ROLE`+claims (N5) sẽ tự động sinh `system` **ngay cả khi thao tác do người thật gọi**
  (đảo ngược tấn công: người dùng bị ghi thành hệ thống, hoặc thao tác hệ thống bị suy ra sai). Thêm
  cột mới ⇒ **tự lọt vào `GET /api/tickets/:id/events`** vì `controllers.ts:102-104` dùng `SELECT *`
  (N2) ⇒ contract/OpenAPI phải đóng băng song song.
- **Khuyến nghị: B**, nhưng chốt thêm 2 điểm cứng: (1) `system` **chỉ** được set trong RPC definer của
  đường automation đã xác thực guard (không phải vì `user_id()` NULL); `NULL user_id` ở đường người dùng
  phải **RAISE**, không fallback im lặng; (2) `ticket_events` **không** đặt ở public như hiện tại? —
  giữ nguyên (bảng đã ở public, [KHÓA]); thay vào đó DTO `/events` phải **liệt kê cột tường minh** thay
  cho `SELECT *` để chặn drift tương lai. Event cũ backfill `actor_type='user'` kèm giải thích
  (`ke-hoach:473`).
- **File/migration/test:** `db/migrations/008_outbox_actor.sql`, `apps/api/src/controllers.ts:97-106`
  (bỏ `SELECT *`), `apps/web/src/types/api.ts` (integrator ghi), `apps/api/test/integration.mjs`
  (audit của system actor phải khác requester), **MỚI** `apps/api/test/actor-audit.test.mjs`,
  `docs/api/contract.md:19-20` (mô tả `event_type`/actor) + `docs/api/openapi.yaml:181-207` (A-DOC).
- **Người ký:** **Quyền** (DB+trigger) + **Nguyên** (định nghĩa "tác nhân hệ thống" trong M3).

---

### QĐ-04 — `ticket_events.event_type`: nới CHECK và phân loại event (nút thắt 4)

- **Vấn đề:** CHECK `('created','status_changed')` (`001:66`) từ chối `assignment_changed`,
  `sla_warning`, `sla_breached`, `approval_decided`, `attachment_added`. Migration 008+ buộc DROP + ADD
  constraint (forward-only).
- **Bằng chứng:** `001:66`; `003:245-246` (xác nhận CHECK đủ cho shape hiện tại); `ke-hoach:449`
  ("audit hiện chỉ `created/status_changed`… không nhét giá trị chưa được DB chấp nhận").
- **Phương án A:** mở rộng CHECK ngay trong 008 với **danh sách đóng, đầy đủ cho cả W4**:
  `('created','status_changed','assignment_changed','approval_decided','sla_warning','sla_breached','outbox_published')`.
- **Phương án B:** không đổi CHECK; mọi event mới ghi vào **một bảng ledger riêng**
  (`private.ticket_events_ex` / outbox) và `ticket_events` chỉ giữ 2 loại lịch sử.
- **Rủi ro A:** `DROP CONSTRAINT`/`ADD CONSTRAINT` trên bảng đang có RLS `FORCE`
  (`db/policies/001_rls.sql:15`) không ảnh hưởng data nhưng **đổi hợp đồng đọc**: UI `/events`
  (`TicketDetailPage.tsx`) chưa biết render loại mới ⇒ crash hoặc hiển thị thô; đồng thời danh sách đóng
  ⇒ tuần 5 thêm loại mới lại phải migration mới. Mixed-state: trigger audit và outbox cùng sinh event
  trùng kind nhưng payload khác cấu trúc.
- **Rủi ro B:** **hai nguồn sự thật** (`ticket_events` vs ledger) ⇒ lịch sử ticket trên UI thiếu bước
  assignment/approval, trái yêu cầu "audit reflect actor" (`ke-hoach:630`); đối soát dispatcher phải union.
- **Khuyến nghị: A**, với quy tắc: mỗi `event_type` mới **phải** khai trong cùng migration một CHECK
  `payload` theo loại (VD `jsonb_typeof(payload->'from')='string'` khi `assignment_changed`) và một hàng
  trong bảng ánh xạ domain→audit→outbox→consumer của W4-00 bước 1 (`ke-hoach:448`). Nếu đội không chốt
  đủ danh sách W4 **ngay bây giờ**, chọn B tạm thời còn hơn ba lần sửa constraint.
- **File/migration/test:** `db/migrations/008_outbox_actor.sql`; `apps/api/src/state-machine.ts` (loại
  event không thuộc domain trạng thái — cân nhắc tách enum); `apps/web/src/pages/TicketDetailPage.tsx`
  (render timeline **Séc**); `apps/api/test/workflow.test.mjs` + `integration.mjs` (audit count 2→n);
  `docs/api/contract.md:19-20`, `docs/api/openapi.yaml:181-207` (A-DOC).
- **Người ký:** **Quyền** đề xuất danh sách; **Séc + Nguyên** ký phần hiển thị/nghiệm thu M3.

---

### QĐ-05 — Kỷ cương grant/revoke cho cột và bảng mới (nút thắt 5 + N2 + N7)

- **Vấn đề:** `ADD COLUMN` không tự động bị REVOKE; `PGRST_DB_SCHEMAS=public` expose mọi bảng public
  (`PGRST_DB_SCHEMAS=public` `.env.example:33`); `SELECT *` trong API tự lộ cột mới.
- **Bằng chứng:** `005:68` (án lệ REVOKE thủ công), `.env.example:33`, `controllers.ts:83`, `:102-104`,
  `001:7` (`authenticated` có USAGE `private`), `004:58-59` / `007:11-13` (án lệ REVOKE FROM PUBLIC).
- **Phương án A:** mặc định repo hiện tại — migration tự quyết định grant khi cần, không có quy trình.
- **Phương án B:** **quy tắc freeze ghi thẳng vào contract W4-00**: (B1) mọi cột do hệ thống sinh
  (`sla_breached`, `sla_breached_at`, `ticket_version`, `assigned_team_id`, `actor_type`)
  **không bao giờ** được cấp UPDATE/INSERT cho `authenticated`; (B2) mọi bảng mới đặt ở `private`
  (outbox, inbox, notice ledger, delivery state) — nếu buộc ở `public` (team, roster, tickets columns)
  thì **phải** `ENABLE + FORCE ROW LEVEL SECURITY` và **không GRANT SELECT except tường minh**, ngay
  trong cùng migration (N7); (B3) API bỏ `SELECT *`, liệt kê cột theo contract cho `tickets` và
  `ticket_events`; (B4) migration mới thêm cột SLA/breach **kèm dòng REVOKE** trong chính file đó.
- **Rủi ro A:** client `authenticated` gọi `PATCH /rest/tickets?id=eq.…` tự đặt `sla_breached=true`
  hoặc đọc `private`-intent; breach flag giả làm M3 "đo sai" mà không log nào tố.
- **Rủi ro B:** bỏ `SELECT *` làm **đổi hành vi payload** (một cột UI đang dùng ngầm có thể mất) và
  chạm `controllers.ts` — shared file, A-API một lượt ghi (`ke-hoach:787`).
- **Khuyến nghị: B**, và chỉ bắt buộc B3 với `ticket_events` + `tickets` trong W4 (2 endpoint có hợp
  đồng đóng băng); các endpoint khác giữ nguyên để khỏi phình scope. Lý do: không có B, mọi QĐ khác ở
  file này đều có thể bị vô hiệu bởi một dòng GRANT tình cờ.
- **File/migration/test:** mọi migration W4; `apps/api/src/controllers.ts:79-96, 97-106`;
  `apps/api/test/integration.mjs` (ca mới: Employee đặt `sla_breached` qua REST → 403/400, cột public
  mới không đọc được qua `/rest/*`), `tools/testing/migration-test.mjs` (kiểm grant sau upgrade).
- **Người ký:** **Quyền** (A-DB/A-API) + **Nguyên** (QA ký bằng chứng ca phủ định).

---

### QĐ-06 — team/roster là bảng mới, và FK cho `assigned_to` (nút thắt 6)

- **Vấn đề:** Không có bảng người dùng ⇒ không kiểm được "Agent này có thật / có thuộc team / còn hoạt
  động"; `assigned_to` là uuid mồ côi (`001:55`).
- **Bằng chứng:** `001:45-58`, `001:60` (index partial trên `assigned_to`), `db/policies/001_rls.sql:46-50`,
  `docs/adr/0002-vai-tro-csdl-rls.md:28` ("chưa mô tả ranh giới team"), `:31` (chỉ cấm bảng user
  **chứa mật khẩu**), `ke-hoach:542`, `realm-dxdesk.json:104-145` (4 user demo có UUID do Keycloak sinh).
- **Phương án A:** `public.teams(id, name, active)` + `public.team_members(team_id, user_id uuid,
  active)` trong đó `user_id` **không FK** (chỉ là Keycloak `sub`) + `tickets.assigned_to` thêm
  `CHECK (assigned_to IS NULL OR EXISTS (SELECT 1 FROM team_members …))` qua trigger.
- **Phương án B:** `public.teams` + `public.team_members` + **FK thật** sang `public.users`, dựng
  `public.users` là **bảng chiếu identity** (id = Keycloak sub, username, display_name, active,
  last_seen_at) do seed/Keycloak-sync nạp, **không có cột credential nào**.
- **Rủi ro A:** `assigned_to` vẫn nhận UUID tùy ý ⇒ roster không bao giờ là ràng buộc, chỉ là "hint";
  UI hiển thị tên phải tra Keycloak admin API (thêm dependency + quyền mới cho demo); seed W4-07
  tạo Agent giả ⇒ `ke-hoach:651` "không có audit của người dùng giả mạo" dễ vỡ.
- **Rủi ro B:** `public.users` là bảng mới ở schema **đang được PostgREST expose**
  (`.env.example:33`) ⇒ nếu quên FORCE RLS hoặc grant SELECT rộng, **mọi Employee đọc được toàn bộ
  danh bạ + nhân viên nào đang bị giao việc** (rò rỉ metadata cá nhân, trái tinh thần `ke-hoach:512`
  "service không được đọc user/profile không liên quan"); FK còn tạo yêu cầu đồng bộ Keycloak↔DB
  (một `sub` bị xóa khỏi realm sẽ chặn ticket cũ nếu `ON DELETE` chọn sai).
- **Khuyến nghị: A cho W4, mở B ở W5** — tức: tạo `teams` + `team_members` (chứa `user_id uuid` =
  Keycloak `sub` + `display_name` do seed/`/api/me` cung cấp), **có** FK `team_members.team_id →
  teams.id`, **không** FK `user_id → users` (vì không có `users`), và ràng buộc "assignee phải thuộc
  roster team của ticket" đặt trong **RPC `private.claim_ticket`** (QĐ-02) chứ không trong CHECK.
  `display_name` trong roster là dữ liệu hiển thị, **không** phải nguồn định danh — định danh luôn là
  `sub` từ claims (`database.ts:39`). Lý do: đạt M3 mà không mở bảng danh bạ mới; ADR 0002:31 không bị
  chạm; tránh đổi ON DELETE trên dữ liệu ticket đã tồn tại.
- **File/migration/test:** `db/migrations/009_assignment_team.sql` (`CREATE TABLE private/ public.teams,
  team_members` + `ENABLE/FORCE RLS` + policy read cho staff + grant hẹp), `db/migrations/002`
  [KHÓA — seed `Network Team` giữ nguyên, mapping ở QĐ-08], **MỚI** `scripts/seed-synthetic.mjs` (Séc,
  `ke-hoach:640`), `apps/api/test/integration.mjs` (ca: Agent ngoài team claim → 403/409; Employee
  không đọc được roster), `docs/api/contract.md` (mapping DB/API/UI).
- **Người ký:** **Quyền** (schema) + **Séc** (roster/seed + UI nhãn) + **Nguyên** (nguồn `sub` từ
  Keycloak realm demo).

---

### QĐ-07 — `assigned` nghĩa là gán **team** hay gán **người**?

- **Vấn đề:** DOCX/kế hoạch dùng `assigned` như "đã giao Network Team", còn code chỉ có
  `tickets.assigned_to uuid` (một người hoặc NULL). M3 đo "tới `assigned` đúng Network Team ≤60 giây"
  (`ke-hoach:326`).
- **Bằng chứng:** `001:55`, `003:101` (cạnh `triaged→assigned`), `ke-hoach:451` ("`assigned_to` có thể
  còn null cho tới khi Agent nhận… không tự suy ra từ tên Network Team"), `ke-hoach:627` (ticket đã
  `assigned` nhưng chưa có team), UI: `TicketListPage.tsx:434-444` in `assigned_to` dưới nhãn "Chưa
  phân công" khi NULL — **nếu chọn gán team thì nhãn này sai ngay khi auto-route chạy**.
- **Phương án A (team):** `assigned` = có `assigned_team_id` hợp lệ; `assigned_to` vẫn NULL cho tới khi
  Agent claim (W4-02C).
- **Phương án B (người):** auto-route bắt buộc ghi `assigned_to` = một Agent cụ (round-robin/least-load).
- **Rủi ro A:** `status='assigned'` nhưng `assigned_to IS NULL` là **state hợp lệ mới** — mọi test/API
  giả định "assigned ⇒ có người" (`TicketDetailPage.tsx:415-426`) phải đổi; queue "chưa nhận" là bắt buộc
  (W4-05) chứ không phải tùy chọn.
- **Rủi ro B:** bot **tự phân công cá nhân** ⇒ cần thuật toán chọn người + test riêng (kế hoạch bắt buộc
  "ghi thuật toán và test riêng", `ke-hoach:451`); vi phạm tinh thần con người tự nhận việc;
  mixed-state nghiêm trọng: bot chọn Agent đã nghỉ/ngoài team vì không có roster (`001:55` không FK);
  SLA 80% nhắc (`ke-hoach:576`) sẽ gửi cho người sai.
- **Khuyến nghị: A** — khớp chữ `ke-hoach:451`, đạt M3 (Network Team) mà không bịa thuật toán phân
  công; đồng thời chốt: **`assigned` + `assigned_to IS NULL` là trạng thái hợp pháp**, và cột
  `assigned_team_id` là điều kiện cần của `assigned` (RPC route không được set `assigned` nếu không có
  team active). Kèm điều chỉnh UI: nhãn "Chưa phân công" → "Chưa có người nhận (team: X)".
- **File/migration/test:** `db/migrations/009_assignment_team.sql` (thêm `assigned_team_id uuid`),
  `db/migrations/003` [KHÓA — không sửa], `apps/api/src/state-machine.ts:52-72` (cạnh không đổi, nhưng
  thêm precondition), `apps/web/src/pages/TicketListPage.tsx:433-450`, `TicketDetailPage.tsx:415-427`,
  test hai trang (Séc), `apps/api/test/integration.mjs` (ca: `assigned` mà `assigned_to` NULL vẫn hợp
  lệ; `assigned` không team bị RPC từ chối), `docs/api/openapi.yaml:396` (nullable + mô tả).
- **Người ký:** **Quyền** đề xuất, **Séc** (UI/queue) + **Nguyên** (M3 accept) ký.

---

### QĐ-08 — `routing_rules.team` đang là text → mapping sang team id

- **Vấn đề:** `routing_rules.team text NOT NULL CHECK (length(btrim(team)) BETWEEN 1 AND 100)`
  (`001:42`), seed bằng chuỗi: `Network Team`/`Identity Team`/`IT Support` (`002:10-14`) và
  `Identity Team`/`IT Support` (`003:82-84`). `teams` mới có UUID ⇒ hai nguồn tên, không toàn vẹn.
- **Bằng chứng:** như trên; policy `routing_read` chỉ staff đọc được
  (`db/policies/001_rls.sql:23-24`); UI không hiển thị `routing_rules` ở đâu cả (grep: chỉ DB).
- **Phương án A (mapping table):** `private.team_aliases(team_text text PRIMARY KEY, team_id uuid)`
  nạp một lần trong migration; route RPC tra `team_text → team_id`; `routing_rules` giữ nguyên
  ([KHÓA], không ALTER).
- **Phương án B (ALTER + backfill):** `ALTER TABLE public.routing_rules ADD COLUMN team_id uuid
  REFERENCES public.teams(id)` + backfill `UPDATE … SET team_id` theo tên đã normalize (lower/btrim),
  rồi REVOKE + CHECK `team_id IS NOT NULL` cho hàng `active=true`.
- **Rủi ro A:** mapping là **bảng tra** dễ trôi (thêm rule mới tên "Network team " ≠ "Network Team") ⇒
  bot âm thầm không tìm thấy team, rơi vào "giữ queue cần can thiệp" (`ke-hoach:527`) ngay trong demo.
- **Rủi ro B:** ALTER trên bảng đã FORCE RLS + có policy `routing_read`; phải giữ `team` text để
  `docs/du-lieu.md:57` và dữ liệu W2/W3 cũ không vỡ; backfill trên DB người dùng có thể gặp tên tự do
  (CHECK cho tới 100 ký tự bất kỳ) ⇒ không map được, phải quyết **fail-closed** (rule `active=false`)
  hay **tự tạo team mới** (tự tạo team = cho phép chuỗi tùy ý thành tổ chức thật, rủi ro báo cáo/pivot
  tuần 5).
- **Khuyến nghị: B với fail-closed:** thêm `team_id` (nullable) trong 009, backfill theo 3 tên đã biết
  (`Network Team`, `Identity Team`, `IT Support`), **không tự tạo team**; RPC route từ chối rule
  `active=true` nhưng `team_id IS NULL` và ghi event `routing_unresolved` (thuộc danh sách QĐ-04).
  Giữ cột `team` text nguyên vẹn để `002`/`003` không đổi nghĩa. Lý do: B cho một nguồn sự thật duy nhất
  mà không cần bảng tra ngầm; fail-closed biến cố "thiếu team" thành tín hiệu có thể đo được thay vì
  demo im lặng gán team giả (`ke-hoach:527`).
- **File/migration/test:** `db/migrations/009_assignment_team.sql` (+ `CREATE UNIQUE INDEX` trên
  `teams.name` normalized), `apps/api/test/integration.mjs` (ca rule tắt/thiếu team — `ke-hoach:531`),
  **MỚI** `apps/api/test/routing.test.mjs`, `docs/api/contract.md` (bảng mapping DB/API), `docs/du-lieu.md:57`
  (A-DOC cập nhật — Quyền chỉ gửi đề nghị).
- **Người ký:** **Quyền** (A-DB) + **Nguyên** (danh sách team/ kênh Mattermost W4-04 phải khớp).

---

### QĐ-09 — Quyền duyệt `pending_approval`: giữ Agent-vs-Manager hay Manager-only?

- **Vấn đề:** Hiện **cả Agent lẫn Manager** được duyệt (`pending_approval→assigned`), chỉ Manager được
  từ chối (`pending_approval→new`). W4-06 dựng queue Manager nhưng kế hoạch ghi rõ "Màn Manager W4-06
  **không tự thay** quyền Agent" (`ke-hoach:455`).
- **Bằng chứng:** `003:111-112` (`ARRAY['Agent','Manager']` vs `ARRAY['Manager']`),
  `apps/api/src/state-machine.ts:67-68`, `apps/api/test/integration.mjs:453-454` (Agent duyệt thành
  công — **test đang khóa hành vi này**), `docs/api/contract.md:112-113`.
- **Phương án A:** giữ nguyên (Agent vẫn duyệt được).
- **Phương án B:** Manager-only cho **cả hai** chiều `pending_approval`.
- **Rủi ro A:** không rủi ro kỹ thuật; nhưng "queue phê duyệt" trở thành **đường vòng**: Agent tự
  duyệt ticket `access` do chính mình tạo? — **không**, vì `assigned` vẫn phải qua cạnh và
  `requester_allowed=false` (`003:111`), song Agent **B** vẫn duyệt ticket của Agent A ⇒ phân tách
  trách nhiệm yếu với nghiệp vụ "cấp quyền hệ thống" (`003:69-75`).
- **Rủi ro B:** **breaking change** cho nhân lực demo (chỉ có `manager.1` — `realm-dxdesk.json:135-144`):
  nếu Manager không online, ticket `access` kẹt ở `pending_approval`, và nếu Manager nghỉ/đăng xuất thì
  không có lối thoát. Mixed-state nặng nhất của QĐ này: `003:111` **[KHÓA]**, DB không sửa được ⇒ muốn
  Manager-only phải **UPDATE bảng `private.ticket_transitions`** trong migration mới. Khi đó
  `apps/api/test/workflow.test.mjs:70-86` (đọc text 003) **đỏ ngay** (N1) — nếu chọn B mà không sửa
  harness là tự phá CI; nếu chỉ ẩn nút ở UI (làm Y-only frontend) thì DB vẫn mở ⇒ trái
  `ke-hoach:612` ("ẩn nút không thay kiểm tra server") và trái `ke-hoach:632`.
- **Khuyến nghị: A cho W4** (giữ Agent-vs-Manager như hiện hành, chỉ thêm queue Manager ở W4-06), vì
  B đòi cùng lúc: migration UPDATE cạnh + viết lại harness parity + thêm ≥2 Manager demo + test
  API/REST/UI parity — chi phí vượt lợi ích nghiệp vụ trong 5 ngày, và không có quyết định nghiệp vụ nào
  trong tài liệu buộc đổi. Ghi rõ: **cấm ẩn nút thay cho đổi quyền**.
- **File/migration/test (nếu chọn B):** `db/migrations/00X_approval_roles.sql`
  (`UPDATE private.ticket_transitions SET allowed_roles=ARRAY['Manager'] WHERE from_status='pending_approval'
  AND to_status='assigned'`), `apps/api/src/state-machine.ts:67`, `apps/api/test/workflow.test.mjs:41-86`
  (chuyển sang đọc **mô hình hiệu lực từ DB**, xem QĐ-14), `apps/api/test/integration.mjs:453`,
  `apps/web/src/lib/ticketWorkflow.ts` (chỉ đọc trừ khi được duyệt, `ke-hoach:800`),
  `infra/keycloak/realm-dxdesk.json` (thêm Manager), `docs/api/contract.md:112`, `openapi.yaml`
  (A-DOC).
- **Người ký:** **Nguyên** (nghiệp vụ/phân quyền) + **Quyền** (hợp đồng DB) + **Séc** (UI).

---

### QĐ-10 — SLA: giữ 24/7 hay business-hours; phản hồi đầu tiên tính bằng gì?

- **Vấn đề:** `sla_due_at = created_at + resolution_minutes` (`003:193-208`), pause chỉ ở `waiting_user`
  (`005:110-118`), ngưỡng = `due + paused + open pause` (`rules.ts:100-110`). Business-hours chưa có ở
  bất kỳ đâu. `response_minutes` có cột nhưng **không code nào dùng** (N9).
- **Bằng chứng:** `db/migrations/001_schema.sql:33-38`, `db/migrations/002_reference_data.sql:8-9`
  (low 2880/480, normal 1440/240, high 480/60, critical 120/15), `apps/api/src/rules.ts:95-110`,
  `ke-hoach:456` (đề xuất giữ 24/7), `ke-hoach:563` (business-hours "chỉ thêm khi 00 chốt nguồn lịch/múi
  giờ/ngày nghỉ"), `docs/api/contract.md:129-139`.
- **Phương án A:** giữ 24/7, một policy snapshot mỗi ticket, giữ deadline qua reopen, pause chỉ ở
  `waiting_user`, **không xóa breach trước đó** (đúng đề xuất của kế hoạch).
- **Phương án B:** business-hours — trừ thời gian ngoài 8h–17h, cần `sla_calendar` mới + recomputing.
- **Rủi ro A:** gần như không có rủi ro bảo mật; rủi ro nghiệp vụ: ticket critical 120 phút có breach
  lúc 2h sáng và notice 80% bắn vào Mattermost giữa đêm (`ke-hoach:580` "không thông báo sau
  closed/cancelled" nhưng chưa có quy tắc chống spam qua đêm).
- **Rủi ro B:** **phá mọi ticket đã có** nếu tính lại `sla_due_at` (cột NOT NULL,
  `003:43`, **không** grant UPDATE cho `authenticated` — `005:68` + guard `005:77-80` từ chối thẳng
  42501); cần definer mới + backfill; mixed-state: hai evaluator chạy đồng thời với hai giả định lịch
  khác nhau ⇒ cờ breach dao động; `> vs >=` cạnh biên (`ke-hoach:779`); `bigint` millis → number JS.
- **Khuyến nghị: A cho M3** (bám `ke-hoach:456`), và chốt **3 phụ quyết** ngay trong W4-00:
  (1) điều kiện breach là `now > effective_deadline` — giữ nguyên `>` của `rules.ts:109`, **cấm** một
  consumer tự đổi thành `>=` (`ke-hoach:779`);
  (2) auto-route **không** được tính là "phản hồi đầu tiên" (`ke-hoach:456`) ⇒ nếu cần số liệu phản hồi,
  dùng `first_response_at` = lần đầu `status` rời `new|triaged|pending_approval` **bởi actor_type='user'**
  (QĐ-03) — **không** dùng `response_minutes` hiện chưa có semantics, hoặc khai báo tường minh nó là
  SLA phản hồi theo policy và chưa hiển thị ở UI;
  (3) notice ledger unique theo `(ticket_id, policy_snapshot, kind)` (B.6.4:780).
- **File/migration/test:** `db/migrations/010_sla_breach.sql` (`sla_breached boolean NOT NULL DEFAULT
  false`, `sla_breached_at timestamptz`, notice ledger ở `private`), `apps/api/src/rules.ts` (hàm dùng
  chung, không viết lại ở n8n — `ke-hoach:557`), **MỚI** `apps/api/src/sla-evaluator.ts` +
  `apps/api/test/sla.test.mjs`, `infra/n8n/workflows/ticket-sla.json` (MỚI),
  `docs/api/contract.md:124-139` + `openapi.yaml` (A-DOC).
- **Người ký:** **Quyền** (công thức + DB) + **Nguyên** (policy demo/scheduler) + **Séc** (UI deadline).

---

### QĐ-11 — Số thứ tự migration 008/009/010 và reserve

- **Vấn đề:** Kế hoạch để "số thật do A-DB cấp sau kiểm tra repo" (`ke-hoach:468`, `:771`); nhiều agent
  có thể tự tạo `008` trùng nhau.
- **Bằng chứng:** `db/migrations/` hiện có đúng `001_schema, 002_reference_data, 003_ticket_workflow,
  004_attachments_upload, 005_ticket_integrity, 006_attachment_lifecycle, 007_attachment_download`
  (đếm bằng `ls`); ledger tên theo `<dir>/<file>` và runner lặp migrations **rồi** policies trong cùng
  một lượt (`infra/postgres/init/02-migrations.sh:22-48`); checksum đổi ⇒ fail cứng (`:33-36`);
  `.env.example:33` (`PGRST_DB_SCHEMAS=public`).
- **Phương án A (một file lớn):** `008_week4.sql` chứa outbox + actor + team + assignment + SLA + notice.
- **Phương án B (ba file theo nguyên tử tính năng — khuyến nghị):**
  - `008_outbox_actor.sql`: `actor_type` cho `ticket_events`, context system actor, **outbox + inbox ở
    schema `private`** (không expose REST), unique event key, REVOKE/PUBLIC, index pending/available.
  - `009_assignment_team.sql`: `teams`, `team_members`, `tickets.assigned_team_id`,
    `routing_rules.team_id` + backfill fail-closed, `private.claim_ticket` + `private.route_ticket`.
  - `010_sla_breach.sql`: `sla_breached` + `sla_breached_at` + notice ledger `private` + REVOKE cột breach
    khỏi `authenticated` (QĐ-05 B4). `ticket_version` phải thuộc 008 vì envelope dùng ngay từ nền outbox.
- **Rủi ro A:** một file fail giữa chừng ⇒ `--single-transaction` rollback toàn bộ (`:27`) nhưng **khó
  review**; quyền GRANT/REVOKE lẫn lộn outbox và assignment, dễ phá quy tắc tối thiểu quyền; nếu phải
  revert một tính năng thì revert cả ba.
- **Rủi ro B:** thứ tự phụ thuộc cứng (009 cần `actor_type` của 008 để audit assignment);
  `010` cần trigger outbox của `008` để phát notice ⇒ **không được cho agent khác nhau ghi song song**;
  và nếu đội quyết định tách `policies/003_*` cho RLS của bảng mới thì chạy **sau** toàn bộ migrations
  (N7) ⇒ bảng `009` phải **tự** bật RLS trong chính 009, không đặt ở policies cũ.
- **Khuyến nghị: B**, reserve ngay trong W4-00: **008/009/010 do A-DB (Quyền) giữ một lượt ghi**; các
  agent khác muốn thêm schema phải xin số **011+** qua lead. Cấm `008a/008b` (runner glob `*.sql` theo
  thứ tự từ điển: `008_x_v2.sql` vẫn áp **trước** `009_…`, nhưng thêm file chen giữa số đã cấp sẽ
  khiến bootstrap mới khác thứ tự upgrade ở DB đã có ledger. Dùng số mới 011+ thay vì chèn file).
- **File/migration/test:** 3 file mới trên; `tools/testing/migration-test.mjs` (bootstrap từ đầu **và**
  upgrade từ DB đã có ticket/tệp, `ke-hoach:478`), `apps/api/test/integration.mjs`,
  `infra/postgres/init/02-migrations.sh` **[KHÔNG sửa]**, `docs/du-lieu.md` + `docs/api/contract.md`
  ghi mapping cột/event (A-DOC).
- **Người ký:** **Quyền** (A-DB là người cấp số duy nhất) — lead xác nhận reserve trên board.

---

### QĐ-12 — Envelope `ticket_version`, idempotency `(consumer,event_id,operation)` và ACK sau durable commit

- **Vấn đề:** Envelope (`ke-hoach:737-748`) có `ticket_version`, nhưng `tickets` **không có cột version**
  nào; optimistic concurrency hiện chỉ dựa `SELECT … FOR UPDATE` trong một giao dịch
  (`controllers.ts:158`).
- **Bằng chứng:** `db/migrations/001_schema.sql:45-58` + `003:30-37` (không có version;
  `updated_at` do trigger set và **không** grant cho `authenticated` — `005:68`);
  `apps/api/src/controllers.ts:156-179`; `grep outbox|inbox|idempot` trong `db`, `apps/api/src`, `tools`,
  `tests` ⇒ **0 kết quả** (chưa tồn tại gì).
- **Phương án A:** dùng `updated_at` làm version.
- **Phương án B:** `tickets.ticket_version int NOT NULL DEFAULT 1`, **chỉ trigger** tăng (khi status đổi
  và khi assignment đổi), đưa vào envelope + `If-Match`-style precondition trong callback.
- **Rủi ro A:** `updated_at` đổi bởi **mọi** UPDATE (kể cả `resolution_note`), độ chính xác μs nhưng
  không đơn điệu theo lô ⇒ hai callback cùng `updated_at` vẫn khác nội dung; `ke-hoach:750` đã tự bác
  ("không dựa timestamp đủ chính xác để thay optimistic concurrency").
- **Rủi ro B:** ALTER NOT NULL trên bảng đang có dữ liệu ⇒ cần `DEFAULT 1` + backfill an toàn; trigger
  tăng version phải nằm trong `guard_ticket_update` mới (`005:70-122` là **bản ghi đè đang hoạt động**,
  nếu `CREATE OR REPLACE` lần nữa phải nhân bản **toàn bộ** logic 005, không được quên SLA check
  `005:77-80` hay reopen-clears-note `005:106-109`); mọi envelope phát trước khi có cột là **hợp đồng
  sai**; consumer phải so `ticket_version` **và** trạng thái hiện hành (`ke-hoach:750`).
- **Khuyến nghị: B**, kèm bộ quy tắc ACK/idempotency khóa thành văn bản:
  1. `event_id` sinh **một lần** trong transaction ghi ticket (outbox cùng transaction), **không** sinh
     lại khi retry (`ke-hoach:754`).
  2. Delivery unique `(event_id, destination)` ở outbox; consumer unique
     `(consumer, event_id, operation)` ở inbox; **payload khác cùng key ⇒ xung đột, từ chối**
     (`ke-hoach:511, 754`).
  3. **ACK chỉ sau durable commit**: producer mark `delivered` chỉ khi consumer đã trả
     `{event_id, result}` sau khi mutation+inbox+audit **cùng transaction** đã commit
     (`ke-hoach:489, 755`). Timeout ≠ rollback đã xảy ra ⇒ at-least-once + consumer idempotent,
     **không hứa exactly-once** (`ke-hoach:499`).
  4. `ticket_version` là precondition nghiệp vụ, không phải duy nhất: callback đọc **current state** và
     từ chối áp event cũ lên trạng thái mới (`ke-hoach:750`, `ke-hoach:667`).
  5. Đích ngoài DB (Mattermost) có **trạng thái gửi/đối soát riêng** + correlation ID; ghi rõ cửa sổ
     duplicate khi ACK thất lạc (`ke-hoach:596, 755`).
- **File/migration/test:** `db/migrations/008_outbox_actor.sql` (outbox/inbox + unique keys + index),
  `db/migrations/010_sla_breach.sql` (hoặc 008: `ticket_version`), `apps/api/src/outbox-dispatcher.ts`
  (MỚI), `apps/api/src/app.ts:43-46` (provider wiring — A-API), `apps/api/test/outbox.test.mjs` (MỚI),
  **MỚI** `tools/testing/workflow-recovery.mjs` (`ke-hoach:802`), `docs/api/contract.md` mục envelope
  + `openapi.yaml` (A-DOC).
- **Người ký:** **Quyền** (envelope + DB) + **Nguyên** (n8n consumer/dispatcher vận hành).

---

### QĐ-13 — `GET /api/tickets?queue=…`: filter server-side và ranh giới RLS

- **Vấn đề:** Endpoint hiện tại không có filter nào ngoài `limit/offset`
  (`controllers.ts:79-88`, `dto.ts:44-49`, `openapi.yaml:82-101`); kế hoạch đòi queue team/status/assignee
  có allow-list nhưng cũng nhắc "queue filter **không thay RLS**" (`ke-hoach:545`).
- **Bằng chứng:** như trên; `db/policies/001_rls.sql:25-26` + `003:232` (staff đọc tất cả);
  `docs/ke-hoach-tuan-4.md:543`, `:606`.
- **Phương án A:** giữ read-scope hiện tại — mọi Agent/Manager thấy toàn bộ mọi team; queue filter chỉ
  là tiết kiệm trang.
- **Phương án B:** **thu hẹp** đọc theo team (policy mới chặn Agent đọc ticket ngoài team).
- **Rủi ro A:** lộ nhãn đề án? — nhân viên IT nội bộ xem toàn bộ là quyết định nghiệp vụ có chủ đích từ
  W2 (ADR 0002:16-17); không có rủi ro bảo mật mới, nhưng "queue=team" chỉ là **trang trí**, người dùng
  vẫn truy cập được ticket khác bằng `GET /api/tickets/:id`.
- **Rủi ro B:** migration policy sửa `tickets_read` semantics + `tickets_update` USING
  (`003:231-232`) ⇒ ảnh hưởng **auto-route** (QĐ-01) và **Manager queue** (W4-06); phá `integration.mjs`
  hiện có (ca "Agent đọc tất cả"); bắt buộc negative tests (`ke-hoach:545`) mà nhóm không còn ngày;
  mixed-state: Manager không còn thấy pending_approval toàn công ty ⇒ W4-06 mất ý nghĩa.
- **Khuyến nghị: A cho M3** + 3 ràng buộc hợp đồng: (1) allow-list tham số
  `queue ∈ {my_open, team_unassigned, team_assigned, pending_approval}`, `status` ∈ `TICKET_STATUS_VALUES`,
  `team_id` **bắt buộc là UUID đã kiểm qua `teams`**, mọi giá trị lạ → 400 (`ke-hoach:547`);
  (2) filter dựng bằng **SQL tham số hóa**, không concatenate (`ke-hoach:767`), không nhận `requester_id`
  từ query; (3) `limit/offset` cũ giữ nguyên semantics + Response ghi rõ **phạm vi tìm kiếm** để UI không
  quảng bá "toàn hệ thống" (`ke-hoach:606`).
- **File/migration/test:** `apps/api/src/controllers.ts:79-88`, `apps/api/src/dto.ts:44-49` (class
  `TicketListQuery`), `apps/api/test/integration.mjs` (injection/unknown filter),
  `apps/web/src/services/api.ts` + `types/api.ts` (**integrator ghi**, `ke-hoach:807`),
  `TicketListPage.tsx` (Séc), `openapi.yaml:82-101` + parameters component (A-DOC).
- **Người ký:** **Quyền** (API/DTO) + **Séc** (UI queue) + **Nguyên** (ranh giới quyền — nếu đội muốn B thì
  phải dời sang W5 và ghi BLOCKED ở W4-05).

---

### QĐ-14 — Harness parity 17 cạnh: sửa test thế nào khi DB đổi mà 003 bị khóa? (N1)

- **Vấn đề:** `workflow.test.mjs` parse **text của `003_ticket_workflow.sql`** và assert đúng 17 cạnh +
  vai trò trùng `ROLE_EDGES`; `integration.mjs` assert 17 cạnh từ DB. Mọi migration thêm cạnh/đổi role
  làm **cả hai đỏ**, và `ke-hoach:775` cấm sửa 003.
- **Bằng chứng:** `apps/api/test/workflow.test.mjs:43, 55-72` (đọc file 003 tại `:57`),
  `apps/api/test/integration.mjs:473-491` (`:475`), `apps/api/src/state-machine.ts:52-72`, `003:90-114`.
- **Phương án A:** test hard-code mới (`assert.equal(edges.length, 19)`) và copy danh sách cạnh sang
  test — tiếp tục đọc text 003.
- **Phương án B:** **nguồn sự thật = DB hiệu lực**: `workflow.test.mjs` nhận `sqlEdges()` đọc từ
  **mô hình tổng hợp** (`003` + các file UPDATE sau) hoặc — tốt hơn — ca parity chuyển sang
  `integration.mjs` (nơi có PostgreSQL thật) và unit test chỉ kiểm TS nội bộ (`TRANSITIONS` ↔ `ROLE_EDGES`).
- **Rủi ro A:** duplicate logic, parity **giả**: test green trong khi DB thật lệch; cụ thể `005:70-122`
  đã `CREATE OR REPLACE` trigger mà test không hề kiểm bản ghi đè ⇒ tiền lệ xấu. Mixed-state: migration
  009 UPDATE cạnh nhưng dev chỉ sửa 008 ⇒ CI không phát hiện.
- **Rủi ro B:** unit test mất khả năng phát hiện "TS vs DB trôi" khi chạy không có DB (CI vẫn chạy
  `npm run integration` riêng — `.github/workflows/ci.yml:81-98`, nên vẫn phủ); phải bảo đảm
  `ROLE_EDGES` được **generate/kiểm** từ DB chứ không thành nguồn thứ hai; và cần sự đồng ý của Nguyên vì
  harness là của A-QA (`ke-hoach:405`).
- **Khuyến nghị: B**, trong cùng commit với migration đầu tiên làm đổi đồ thị (009): `integration.mjs`
  đọc `private.ticket_transitions` **sau khi áp mọi migration** và assert 1:1 với `ROLE_EDGES`
  (đã có khung ở `:473-491`); `workflow.test.mjs` bỏ `sqlEdges()` và giữ các ca thuần TS
  (`:88-135`). Cấm cứng: không được "sửa 003" và không được nới assertion thành `>= 17`.
- **File/migration/test:** `apps/api/test/workflow.test.mjs`, `apps/api/test/integration.mjs`,
  `apps/api/src/state-machine.ts` (nếu thêm cạnh), `.github/workflows/ci.yml` **không đổi gate**
  (`ke-hoach:687`).
- **Người ký:** **Nguyên** (A-QA, sở hữu harness) + **Quyền** (A-DB/A-API).

---

## 4. Hợp đồng đề xuất **chưa tồn tại trong repo**

> Nhãn **[ĐỀ XUẤT — CHƯA TỒN TẠI]**. Cấm frontend/workflow gọi trước khi W4-00 ký và gate A đóng.
> Kiểm chứng "chưa tồn tại": `grep -rn "outbox|inbox|idempot"` trên `db`, `apps/api/src`, `apps/web/src`,
> `tools`, `tests` = **0 kết quả**; `docs/api/openapi.yaml:19-307` chỉ khai 10 path: `/health, /me,
> /categories, /tickets, /tickets/{id}, /tickets/{id}/status, /tickets/{id}/events,
> /tickets/{id}/attachments, /attachments/{id}/download-url, /attachments/{id}/content,
> /device-requests`.

### 4.1 Bảng endpoint

| Endpoint (đề xuất) | Quyền | Body / Query | Thành công | Lỗi phải test | Vì sao chưa tồn tại |
|---|---|---|---|---|---|
| `POST /api/system/tickets/:id/route` **[ĐỀ XUẤT]** | Guard **service riêng** (không dùng `JwtGuard` — N3), service token `aud=dxdesk-api`, role `ticket-automation` | `{ "event_id": "<uuid>", "schema_version": 1 }` — **không** nhận `to`, `team`, `assignee`, `fields` (QĐ-01, QĐ-02) | `200 {event_id, ticket_id, ticket_version, status:"assigned", team_id, routed:true}` sau durable commit | `401` sai iss/aud/role/client/expiry; `403` human token gọi route service; `404` ticket ngoài phạm vi; `200` replay cùng event trả kết quả đã lưu; `409` chỉ cho xung đột thật; `422` ticket đã `closed`/`cancelled`/`pending_approval` (access không auto-bypass — `ke-hoach:527`); `503` thiếu rule/team active | Guard service + RPC chưa có; `validateClaims` từ chối (`auth.ts:19-21`) |
| `POST /api/tickets/:id/claim` **[ĐỀ XUẤT]** | `Agent` thuộc team của ticket (roster — QĐ-06); **không** nhận assignee từ body | rỗng (hoặc `{ }`) | `200 Ticket` với `assigned_to = claims.sub`, `ticket_version+1`, audit `assignment_changed` | `401`; `403` Employee/Manager ngoài scope hoặc Agent ngoài team; `404`; `409` đã có người nhận (race — `ke-hoach:548`); `422` ticket chưa `assigned`/đã khép lại; retry cùng người → **cùng kết quả**, không nhân đôi audit | `assigned_to` không grant nào (`001_rls.sql:49`, `003:242` − `005:68`); không có RPC; `dto.ts` chưa có class |
| `GET /api/tickets?queue=…` **[ĐỀ XUẤT — mở rộng tương thích]** | `Agent`/`Manager` (read-scope giữ nguyên theo QĐ-13) | `queue ∈ {my_open, team_unassigned, team_assigned, pending_approval}`, `status`, `team_id` (UUID đã kiểm), `assignee_id`, `limit(1..100)`, `offset(0..100000)` | `200 {data, limit, offset, queue, scope:"staff-all"}` | `400` filter ngoài allow-list / `team_id` không phải UUID / tổ hợp vô nghĩa (`queue=pending_approval&assignee_id=`); `401` | `controllers.ts:79-88` chỉ `ORDER BY created_at DESC LIMIT/OFFSET`; `ListQuery` chỉ 2 trường (`dto.ts:44-49`); `openapi.yaml:84-86` chỉ khai Limit/Offset |
| `GET /api/queues/pending_approval` **[ĐỀ XUẤT — tùy chọn]** | `Manager` (+Agent nếu QĐ-09 giữ A) | `limit/offset` | `200 {data:[{ticket, requester, fields, age_ms}]}` | `403` Employee; `401` | Chưa có; W4-06 (`ke-hoach:621`) dự kiến `ManagerApprovalsPage.tsx` mới |

`PATCH /api/tickets/:id/status` **giữ nguyên hợp đồng hiện tại** (`openapi.yaml:149`,
`controllers.ts:149-179`); W4 **không** đổi shape body — mọi thứ mới đi endpoint riêng để không phá
client cũ (tối thiểu hóa blast radius, `ke-hoach:550`).

### 4.2 Envelope sự kiện **[ĐỀ XUẤT]**

```json
{
  "schema_version": 1,
  "event_id": "<uuid sinh 1 lần trong transaction ghi ticket>",
  "event_type": "ticket.created | ticket.status_changed | ticket.assignment_changed | ticket.routing_unresolved | ticket.sla_warning | ticket.sla_breached | ticket.approval_decided",
  "occurred_at": "2026-11-02T08:00:00Z",
  "ticket_id": "<uuid>",
  "ticket_version": 1,
  "actor": { "type": "user | system", "id": "<keycloak-sub | service-id>", "label": "ticket-router" },
  "payload": { "category_code": "vpn", "from": "triaged", "to": "assigned", "team_id": "<uuid>", "priority": "normal" }
}
```

Quy tắc: `event_type` envelope **không đồng nhất** với `ticket_events.event_type` (DB) — phải có bảng ánh
xạ `domain event → audit event → outbox → consumer` (W4-00 bước 1, `ke-hoach:448`); `payload` tối
thiểu, **cấm** JWT/token, password, file bytes, URL ký, `resolution_note` nội dung nhạy cảm
(`ke-hoach:751`, `ke-hoach:581`); `actor.id` không bao giờ là requester khi `actor.type=system`.

### 4.3 Idempotency **[ĐỀ XUẤT]**

| Khóa | Nơi lưu | semantics |
|---|---|---|
| `UNIQUE (event_id, destination)` | `private.outbox_delivery` (outbox ở `private`, `ke-hoach:471`) | Một event tới một đích chỉ một lần *có hiệu lực*; retry dùng lại **cùng** `event_id` |
| `UNIQUE (consumer, event_id, operation)` | `private.inbox` (`ke-hoach:511`) | Trùng key + trùng payload ⇒ trả **kết quả đã lưu**, không đổi state lần hai; trùng key + payload khác ⇒ **từ chối xung đột** (409) |
| precondition `ticket_version` | `tickets.ticket_version` (QĐ-12) | Event cũ (`version < current`) ⇒ bỏ qua có ghi dấu `skipped/superseded` kèm lý do (`ke-hoach:781`) |
| `lease` + `locked_until` + `attempts` | `private.outbox` | Hai dispatcher không cùng claim hữu hiệu (`FOR UPDATE SKIP LOCKED`), lease hết hạn ⇒ trả về pending, stale worker **không** ghi đè kết quả của lease mới (`ke-hoach:488, 491`) |

### 4.4 ACK chỉ sau durable commit **[ĐỀ XUẤT]**

1. Dispatcher **commit claim trước** rồi mới gọi HTTP — không giữ transaction DB khi chờ mạng
   (`ke-hoach:488`).
2. Consumer: **mutation + inbox row + audit trong MỘT transaction**; chỉ commit xong mới trả ACK
   (`ke-hoach:511, 755`).
3. Producer mark `delivered` **chỉ khi** ACK khớp `event_id` và phía nhận đã lưu durable — ACK kiểu
   "đã nhận vào RAM" không được tính (`ke-hoach:489`).
4. Timeout/không ACK ⇒ **retry cùng `event_id`**, đọc kết quả đã lưu nếu consumer đã commit;
   "timeout không đồng nghĩa rollback đã xảy ra" (`ke-hoach:753`).
5. Retry có trần: backoff 1/2/4…60s + jitter (`ke-hoach:490`); `4xx`/schema lỗi ⇒ `failed`/quarantine,
   không loop vô hạn; `5xx`/timeout ⇒ retry bounded. Sau ngưỡng vẫn **giữ event** để operator replay có
   kiểm soát (`ke-hoach:491`).
6. Mattermost không hỗ trợ idempotency ⇒ **có thể duplicate** trong cửa sổ ACK mơ hồ; phải ghi rõ, tương
   quan ID + quy trình đối soát là bắt buộc, **không hứa exactly-once message** (`ke-hoach:596, 670`).
7. Webhook vào n8n: `/webhook/*` hiện **không có auth** (`infra/apisix/apisix.yaml:56-61`) ⇒ đề xuất
   **chuyển callback automation sang `/api/system/*`** (đã có `openid-connect` + `limit-req`,
   `:68-77`) hoặc thêm `key-auth`/header bí mật + `limit-req` cho webhook; secret qua env/credential
   store, ví dụ chỉ ở `.env.example`, **không** ghi secret thật vào workflow export/ảnh/log
   (`ke-hoach:512`).

---

## 5. Phụ lục — Ma trận test W4-08A thiết kế từ contract

Quy ước: **Fixture** = unit/integration với DB hoặc stub trong `apps/api/test`, `apps/web/src/test`
(không chứng minh tích hợp); **Stack thật** = `node scripts/dxdesk.mjs up` +
`node scripts/stack-test.mjs --restart-n8n` + `node tools/testing/stack-browser.mjs`
(`ke-hoach:825`). Không ca nào dưới đây được báo PASS chỉ từ tên script (`ke-hoach:805`).

| # | Ca | Điểm tiêm lỗi | Dữ liệu trước | Dữ liệu sau (mong đợi) | Kết quả mong đợi | Fixture / Stack thật |
|---|---|---|---|---|---|---|
| T01 | Rollback mutation **không** để outbox thừa | Trigger/transaction ghi `ticket_events` rồi ép RAISE (vd `resolution_note` sai) | ticket `in_progress`, 1 event `created` | status không đổi, **đúng** 1 event, **0** hàng outbox mới | `422/403`, không `ticket_events`, không `outbox`, không `inbox` | Fixture (DB) — án lệ `integration.mjs:487-490`, `ke-hoach:476` |
| T02 | Hai dispatcher cùng claim một batch | Chạy 2 process `outbox-dispatcher` song song trên cùng pending batch | 1 event pending, `attempts=0` | Chỉ **một** worker có `locked_until` hợp lệ; event gửi đúng 1 lần; `attempts` chỉ +1 phía thắng | `FOR UPDATE SKIP LOCKED`; stale worker không mark delivered của lease mới | Fixture + **stack thật** khi có n8n |
| T03 | Lease hết hạn | Giết dispatcher sau claim, chờ `locked_until` qua | event `locked`, `delivered_at NULL` | event về `pending`, `attempts+1`, **cùng `event_id`** | Gửi lại đúng một hiệu ứng nghiệp vụ (inbox chặn nhân đôi) | Fixture |
| T04 | Timeout **trước** ACK | Chặn consumer sau khi mutation commit, cắt HTTP | event pending, ticket đã route thật | Producer **không** mark delivered; consumer **không** đổi state lần 2 | Retry cùng ID ⇒ đọc kết quả đã lưu, trả ACK lần hai | Fixture |
| T05 | Timeout **sau** ACK (ACK lạc) | Làm hỏng response path sau durable commit | ticket `assigned`, inbox row đã có | `attempts+1` rồi delivered; `assignment_changed` chỉ **1** hàng | Không nhân đôi assignment/audit; `updated_at` không đổi lần 2 | Fixture |
| T06 | Duplicate + reordered events | Phát `ev#3` trước `ev#2`, và phát `ev#3` hai lần | ticket `new` | Thứ tự nghiệp vụ theo `ticket_version`, event cũ `skipped/superseded` có lý do | Callback không áp event cũ lên state mới (`ke-hoach:750`) | Fixture |
| T07 | n8n down → enqueue → restart → replay | `docker compose stop n8n`, tạo 3 ticket, `start n8n` | 3 event pending/failed | 3 event delivered, **giữ nguyên event_id**, 3 ticket `assigned`, 3 audit system | Không mất event đã commit; một hiệu ứng assignment/notice | **Stack thật** (`ke-hoach:666`, `ke-hoach:495`) |
| T08 | Hai Agent tranh claim | Hai JWT Agent khác nhau, cùng ticket, `Promise.all` | `assigned`, `assigned_to NULL` | **Đúng một** `assigned_to`, `ticket_version+1` **một** lần | Một `200`, một `409`; Agent ngoài team → `403`; retry cùng Agent → cùng kết quả | Fixture (DB) + **stack thật** qua browser (`ke-hoach:548`, `ke-hoach:667`) |
| T09 | Service token sai `aud` / `iss` / `role` / `client` / `exp` | 5 token dựng riêng trên `/api/system/tickets/:id/route` | ticket `new` | **không đổi gì**, `0` audit, `0` outbox | `401` (iss/exp/aud gateway) hoặc `403` (role/client); `claim_validator` APISIX (`apisix.yaml:26-38`) và guard service phải **độc lập** chặn | Fixture (unit) + **stack thật** gateway (`tools/testing/gateway-test.mjs:62-90`) |
| T10 | Human token (Employee/Agent) gọi route service; bot token gọi route người dùng | `employee.a` POST `/api/system/.../route`; service token PATCH `/api/tickets/:id/status` | ticket `new` | không đổi | `403` cả hai chiều — ranh giới service/người dùng **hai chiều** (`ke-hoach:514`) | Fixture + stack thật |
| T11 | Callback muộn cho ticket đã `closed`/`cancelled`, hoặc `access` còn chờ duyệt | Đóng ticket trước khi event tới; ticket `access/pending_approval` | `closed` / `pending_approval` | `closed` **không** bị kéo về `assigned`; `pending_approval` **không** auto-assign | `422` (`45001` — `003:89`, guard `005:89-91`); event ghi `skipped` | Fixture (`ke-hoach:667`, `:527`) |
| T12 | Routing thiếu/tắt rule, team không hợp lệ | `UPDATE routing_rules SET active=false` (owner) rồi tạo ticket VPN | 1 rule inactive | ticket giữ `new`, event `ticket.routing_unresolved`, hàng chờ can thiệp | `503`/`422` có thông điệp nghiệp vụ, **không** gán team giả; SLA không đổi (`ke-hoach:527`) | Fixture + stack thật |
| T13 | Mattermost 429 | Giới hạn bot/`limit-req`, gửi dồn | notice pending, ledger `queued` | ledger `retrying` → `sent` sau phục hồi; **không** spam mỗi vòng poll | Retry bounded; log sanitize; correlation ID có; duplicate được ghi nhận là **khả năng**, không phải bug im lặng (`ke-hoach:580, 596`) | **Stack thật** (Mattermost ở `tn04.yml:42-55`) — **lưu ý N6**: phải chốt network/siteURL trước |
| T14 | Mattermost 5xx / unavailable | Stop service `mattermost`, trigger 80% | notice `queued` | `failed`/quarantine + replay được; ticket state **không** đổi | Cờ SLA và outbox **không** phụ thuộc kênh chat; thông báo thất bại không làm rollback assignment (`ke-hoach:594`) | **Stack thật** |
| T15 | Clock-controlled 80% | Đồng hồ ảo ở `sla-evaluator` + policy demo | ticket `in_progress`, `sla_paused_ms` cố định | đúng **một** notice `sla_warning`, ledger unique `(ticket,policy,kind)` | Ngưỡng theo **thời gian xử lý hiệu lực đã trừ pause**, không phải `0.8 × epoch` (`ke-hoach:562`); cạnh biên `>=`/`>` đúng hợp đồng (`ke-hoach:779`) | Fixture (unit/DB) |
| T16 | Clock 100% và ngay sau 100% + pause trước threshold | Chạy qua `effective_deadline`, và kịch bản pause che mốc breach | như trên | `sla_breached=true`, `sla_breached_at` đúng; pause trước ngưỡng **không** báo sớm; breach trước pause **không** mất | Không nhắc 80% đã lỗi thời khi đã quá 100% ⇒ gửi escalation, lưu `skipped/superseded` (`ke-hoach:781`) | Fixture + stack thật |
| T17 | Reopen sau breach, và `closed/cancelled` | `resolved→in_progress` (`005:106-109`), rồi `→closed`, `→cancelled` | `sla_breached=true`, `resolution_note` bị xóa khi reopen | breach **không** bị reset; event cũ còn; **không** notice mới sau khép lại | `response`/`sla_due_at` giữ deadline gốc (`ke-hoach:560`) | Fixture |
| T18 | Client cố giả system actor / breach / assignee qua REST | `PATCH /rest/tickets?id=eq.…` với `{sla_breached:true, assigned_to:<uuid>, actor_type:'system'}`, token Employee | ticket `new` | **không đổi** | Lỗi quyền (`403`/`400`) — không grant (`003:242` − `005:68`), guard `005:77-84`, QĐ-05; **ca bắt buộc trước merge** | Fixture (DB) + stack thật |
| T19 | `current_setting('role')` semantics trong SECURITY DEFINER | Gọi `private.claim_ticket`/`route_ticket` khi API đã `SET LOCAL ROLE authenticated` (`database.ts:37`) | ticket hợp lệ | `guard_ticket_insert/update` **vẫn** áp dụng; không lọt Poka-yoke (`005:22-24`) | Chứng minh RPC mới không vô hiệu hóa kiểm tra 005; nếu lọt ⇒ redesign thành policy thay vì definer | Fixture (DB) — **chưa ai kiểm, N5** |
| T20 | Migration upgrade có dữ liệu thật | DB đã có tickets/attachments/ledger `001…007`, áp `008→010`, chạy lại lần 2 | dữ liệu W2/W3 | dữ liệu giữ nguyên; `001…007` checksum không đổi; rerun = `Skip` | Không sửa file cũ; bootstrap **và** upgrade cùng đạt (`ke-hoach:478`; runner `02-migrations.sh:33-43`) | **Stack thật** (`node tools/testing/migration-test.mjs`) |
| T21 | Parity đồ thị sau migration mới | Áp 009 (thêm cột/cạnh) rồi chạy harness | `private.ticket_transitions` | API `ROLE_EDGES` ≡ DB hiệu lực, cả 2 đường API + `/rest` | Không được "sửa 003 để test qua" (`ke-hoach:775`, QĐ-14) | Fixture + CI |
| T22 | 60 giây M3 end-to-end | Tạo VPN + attachment qua browser, đo `created_at → assigned` commit | 0 ticket | `assigned` đúng team, Mattermost tới, audit `actor.type=system` | `≤60s` **đo từ timestamp thật**, người khác thực hiện, lưu biên bản (`ke-hoach:434`, `:682`) | **Stack thật** (`tools/testing/stack-browser.mjs`) |

**Ba ca không được bỏ qua vì "fixture đã xanh":** T07, T13/T14, T22 — chúng là bằng chứng tích hợp;
fixture chỉ chứng minh cơ chế. Ảnh chụp không thay kiểm thử hành vi (`ke-hoach:843`).

---

## 6. Những câu hỏi cần người trả lời (agent không tự quyết được)

| ID | Câu hỏi | Người trả lời | Chặn ticket | Hệ quả nếu không trả lời |
|---|---|---|---|---|
| **H1** | **QĐ-4 / BTC**: chưa có phản hồi BTC về hạn/năm/giờ/kênh/hồ sơ và phạm vi n8n; `ke-hoach:196` ghi rõ mốc `17:00 06/12/2026` chỉ là **giả định**; ngưỡng fallback là "import lỗi hơn 2 lần trong W4" (`ke-hoach:200`) | Nguyên (liên hệ BTC), Quyền (ghi quyết định) | W4-02B, W4-04, W4-08B, và **gate A C23-07** | Không được phép giả định engine; nếu Node-RED/Kestra được chốt giữa W4 thì W4-02B phải nghiệm thu lại (`ke-hoach:200`) |
| **H2** | Gate **A (C23-11)** đã DONE chưa, và **SHA/CI/máy/BTC** nào chứng minh? W4-00 chỉ mở sau đó (`ke-hoach:391`) | Lead + reviewer | **Toàn bộ file này** | File chỉ là draft; mọi checkbox W4-00 phải để trống |
| **H3** | **Máy demo 16 GB** có sẵn không, model/nhân nào, đã đo peak thật chưa (`ke-hoach:81, 181, 711-719`)? | Nguyên / Séc (A-ENV) | W4-09A/09B, và W4-04 nếu Mattermost + Ollama cùng chạy | Thiếu máy ⇒ giữ `BLOCKED`, không đổi định nghĩa 100% (`ke-hoach:34`) |
| **H4** | **Có cho phép bot mang role `Agent`** trong realm để đạt 60 giây demo không (QĐ-01 phương án A), hay **cấm tuyệt đối** theo `ke-hoach:508` + B.9? | Nguyên (realm) + lead | W4-02A, 02B, 01B, 08A | Nếu cho phép thì phải ghi ADR mới vì nó **mở quyền đọc toàn bộ ticket + routing** cho bot |
| **H5** | Ai là **Manager thật** cho demo, và Manager-only (`QĐ-09` B) có phải yêu cầu nghiệp vụ từ đề án không? Hiện realm chỉ có 1 Manager (`realm-dxdesk.json:135-144`) | Nguyên + người vận hành demo | W4-06 | Nếu Manager không online trong demo thì kịch bản 2 (duyệt/từ chối) fail |
| **H6** | Roster demo lấy từ đâu: **UUID Keycloak do realm import sinh** (`--import-realm`, `docker-compose.yml:68`) hay bảng `public.users` mới (QĐ-06 B)? Ai cam kết đồng bộ khi realm đổi? | Nguyên (realm) + Séc (seed) | W4-02C, W4-07 | `ke-hoach:542, 644` cấm hardcode subject tùy tiện; không có mapping thì seed và audit lệch nhau |
| **H7** | Danh tính "hệ thống" là **sentinel UUID cố định** hay **`private.actor_registry`**? `actor_id NOT NULL` (`001:65`) buộc chọn một | Quyền + Nguyên | W4-01A, M3 audit | Không chốt ⇒ trigger vẫn fallback requester (nút thắt 3) |
| **H8** | Webhook vào n8n có **được phép ở lại `/webhook/*` không auth** (N4) hay phải chuyển sang `/api/system/*` / thêm `key-auth` + `limit-req`? Bind host hiện chỉ `127.0.0.1` (`docker-compose.yml:111`) | Nguyên (A-PLATFORM) | W4-02A, 02B, 08A | Nếu giữ nguyên, không được viết tài liệu rằng callback đã xác thực |
| **H9** | Mattermost (N6): thêm `networks:` chung cho `tn04.yml`/main compose, dùng `host.docker.internal`, hay đưa `mattermost` vào `docker-compose.yml`? SiteURL nào nhúng vào link thông báo (`ke-hoach:589`)? | Nguyên (A-PLATFORM) + Quyền (payload) | W4-04, W4-09A, T13/T14 | Không quyết thì thông báo M3 không thể gửi từ n8n |
| **H10** | Có chấp nhận **đổi 2 endpoint `SELECT *`** thành liệt kê cột tường minh (N2, QĐ-05 B3) — nghĩa là sửa `controllers.ts` shared (A-API một lượt ghi)? | lead + Quyền | W4-01A, 02C | Không đổi thì mọi cột mới tự lọt payload công khai, contract drift không ai ký |
| **H11** | `response_minutes` (`001:36`, `002:8-9`) có semantics nghiệp vụ không và ai dùng (N9)? Có hiển thị "phản hồi" trên UI M3 không? | Nguyên + Séc | W4-03A, W4-05 | Nếu hiển thị mà không có nguồn tính thật là **hứa số liệu giả** (`ke-hoach:563`) |
| **H12** | Số migration **008/009/010** có được A-DB reserve trên board không, và agent nào cần số khác? | Quyền (A-DB) + lead | 01A, 02C, 03A, 07 | Trùng số ⇒ thứ tự áp sai (runner glob từ điển, `02-migrations.sh:22-48`) |
| **H13** | Có được phép **sửa harness parity** (QĐ-14) trong PR của migration, hay phải qua integrator vì CI là của A-QA? | Nguyên (A-QA) + lead | 08A/08B, CI | Không chốt thì migration đầu tiên làm đỏ CI và người ta sẽ nới assertion |
| **H14** | Business-hours (`ke-hoach:456, 563`): đề án có **yêu cầu cứng** không, hay 24/7 là đủ để đóng M3? | Nguyên (đối chiếu DOCX mục 5.3) + lead | W4-03A/03B | Nếu DOCX đòi giờ hành chính thì QĐ-10-A phải ghi **BLOCKED/scope W5** công khai, không im lặng bỏ |

---

## 7. Bảng ký quyết định (trống — phải điền khi W4-00 mở)

| QĐ | Chủ đề | Quyền | Nguyên | Séc | Ngày ký / SHA bằng chứng |
|---|---|---|---|---|---|
| 01 | Đường automation | ☐ | ☐ | — | |
| 02 | Ghi `assigned_to` | ☐ | — | ☐ | |
| 03 | Audit system actor | ☐ | ☐ | — | |
| 04 | `event_type` CHECK | ☐ | ☐ | ☐ | |
| 05 | Kỷ cương grant/revoke | ☐ | ☐ | — | |
| 06 | team/roster + FK | ☐ | ☐ | ☐ | |
| 07 | `assigned` = team hay người | ☐ | ☐ | ☐ | |
| 08 | routing text → team id | ☐ | ☐ | — | |
| 09 | Agent-vs-Manager duyệt | ☐ | ☐ | ☐ | |
| 10 | SLA 24/7 vs business-hours | ☐ | ☐ | ☐ | |
| 11 | Số migration 008/009/010 | ☐ | — | — | |
| 12 | Envelope/version/ACK/idempotency | ☐ | ☐ | — | |
| 13 | Queue filter & read-scope | ☐ | ☐ | ☐ | |
| 14 | Harness parity 17 cạnh | ☐ | ☐ | — | |

**DoD của W4-00 (`ke-hoach:462`):** "không còn câu hỏi làm producer và consumer hiểu khác nhau." → reached
chỉ khi cả 14 QĐ có chữ ký và H1–H14 hoặc đã trả lời hoặc được ghi `BLOCKED` công khai.

**File này là file duy nhất được tạo trong lượt này.** Không sửa `docs/api/contract.md`,
`docs/api/openapi.yaml` (A-DOC), `docs/ke-hoach-tuan-4.md` (lead), code/SQL/migration/policies,
realm, compose. Không commit/push/tag/tạo nhánh. Mọi đề nghị thay đổi file khác phải gửi lead dưới dạng
patch đề xuất kèm QĐ tương ứng.
