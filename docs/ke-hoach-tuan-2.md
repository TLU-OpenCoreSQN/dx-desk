# Kế hoạch và tiến độ tuần 2 — DX-Desk

**Tuần:** 19–25/10/2026. **Mốc:** demo nội bộ 24/10, chuẩn bị v0.1.0 ngày 25/10.
**Cập nhật:** 21/10/2026 (giờ Việt Nam).
**Nhánh làm việc:** `develop-quyennnv`. **Workspace:** `D:\MaNguonMo`.
**Nguồn:** slide `DX-Desk_Hop-doi-tuan-2_ban-1.1.pptx`, slide 9–18, README,
CONTRIBUTING và danh mục ADR có sẵn trong repo.

> Cập nhật 31/10/2026: các ô tick bên dưới được đối chiếu lại với CI run #42
> (`41160760838`, push `main`, SHA `d2ee443`, 12/12 job xanh). Chỉ tick mục có
> dòng PASS trong log job của đúng SHA đó; chi tiết ở
> [Chặng 10](#31102026---chặng-10-đối-chiếu-lại-với-ci-trên-main). Nhật ký 21/10 và
> 26/10 giữ nguyên làm lịch sử.

## Cách đọc và cập nhật

- `[x]` chỉ đánh dấu khi có kết quả thực tế của mục đó.
- `[ ]` là chưa làm, đang làm hoặc đang chờ; ghi trạng thái ngay bên cạnh.
- Viết code, build, kiểm thử và nghiệm thu là các mục riêng.
- Không đánh dấu thử nghiệm đạt bằng dữ liệu giả hoặc chỉ vì đã có script.
- Cập nhật file này sau từng chặng, trước khi kết thúc phiên và khi có trở ngại.
- Các việc GitHub/Telegram cần quyền tài khoản và thao tác bên ngoài được theo dõi riêng.
  Chưa push, mở PR, tạo release hay gửi tin cho BTC trong phiên này.

## Tóm tắt hiện tại

- [x] Clone repo vào workspace; tạo và chuyển sang `develop-quyennnv`.
- [x] Đọc slide đủ 18 trang và tài liệu trong repo.
- [x] Xác định Nguyên = TV1, Quyền = TV2, Séc = TV3.
- [x] Đọc quy tắc RTK và quy trình Antigravity Lead.
- [x] Kiểm tra môi trường: Node 24.11.1, npm và Git Bash có sẵn.
- [x] Xác nhận máy chưa có Docker Desktop/Docker CLI, WSL chưa cài.
- [x] Viết bản đầu schema, RLS, API NestJS và hợp đồng API.
- [x] Backend cài dependency, build và 6 unit tests thành công.
- [x] Frontend đã nhận, review scope và tích hợp vào `apps/web`.
- [x] Frontend build production và 35/35 tests đạt; đã sửa luồng hết phiên và phân trang.
- [x] Frontend desktop/mobile: 7/7 nhóm kiểm tra Chromium đạt (fixture, chưa phải SSO thật).
- [x] SSO native: 10/10 kiểm tra đạt với Keycloak 26.8.1 thật, gồm ticket,
  thiết bị, RLS API/PostgREST, refresh và logout; không đi qua APISIX.
- [x] Cấu hình tích hợp Compose/API/web/Keycloak đã viết và kiểm cú pháp.
- [x] Xác thực xuyên suốt bằng stack thật. *31/10: run #42 PASS `Keycloak users authenticate`, `Token accepted by API and PostgREST` và đăng nhập PKCE trên trình duyệt qua APISIX.*
- [x] PostgreSQL/PostgREST thực tế: 8/8 integration tests PASS, gồm kiểm thử TN-02.
- [x] Nghiệm thu toàn stack bằng Docker. *31/10: job stack của run #42 trên VM GitHub sạch, không phải máy cục bộ.*
- [x] ADR, báo cáo kiểm thử, hướng dẫn demo và script đóng gói review cục bộ đã có.

## Trình tự thực hiện

1. Chốt contract và schema; triển khai backend.
2. Giao frontend độc lập, Codex tiếp tục hạ tầng và kiểm thử.
3. Kiểm chứng RLS/API/PostgREST và sửa lỗi có bằng chứng.
4. Nhận frontend, review và tích hợp, kiểm thử giao diện.
5. Hoàn thiện TN-01/TN-02/TN-05, CI, tài liệu, checklist release.
6. Chạy kiểm tra cuối và cập nhật báo cáo theo kết quả thực tế.

## Checklist phiên tiếp tục 21/10/2026

Theo yêu cầu tiếp tục lúc 06:47 UTC (13:47 giờ Việt Nam), dùng chính file này
làm kế hoạch và nhật ký, không tạo bản kế hoạch trùng. Tick sau từng mốc để phiên
sau biết chính xác phần đã xong, phần đang làm và điều kiện còn thiếu.

- [x] Đọc kế hoạch, báo cáo, trạng thái Git và bằng chứng phiên trước; giữ nguyên
  các thay đổi chưa commit của dự án.
- [x] Ghi kế hoạch phiên tiếp tục trước khi sửa mã hoặc chạy kiểm thử.
- [x] Phát hiện `.local/reports/native-sso.json` đã ghi 9/9 PASS lúc
  02:50:47 UTC ngày 21/10; đây là kết quả đã lưu, chưa phải lượt chạy lại phiên này.
- [x] Chạy lại build API/web và kiểm thử SSO native với Keycloak thật; ghi kết quả
  thực tế, không suy rộng sang APISIX hoặc toàn stack Docker.
- [x] Đồng bộ báo cáo kiểm thử, hướng dẫn tái lập và các checkbox SSO tương ứng.
- [x] Kiểm cấu hình, unit tests và diff sau thay đổi; ghi lệnh/kết quả vào nhật ký.
- [x] Tạo lại gói review cục bộ chứa bằng chứng SSO, ghi đường dẫn và SHA-256;
  gói review không phải bản phát hành.
- [x] Chốt điểm tiếp tục và liệt kê rõ các mục bị chặn bởi Docker, máy demo
  hoặc tài khoản bên ngoài; không cài hệ thống hay push/release trong phiên này.

**Điểm dừng hiện tại:** SSO native mở rộng 10/10 PASS, API 6/6, web 35/35,
TN-02 8/8, migration 4/4 PASS; build API/web, cấu hình và diff PASS. Tài liệu và
gói review đã xong, đường dẫn/SHA-256 ở cuối chặng 7. Dùng `npm.cmd` thay `npm`
trên máy này. Chặng 8 tiếp tục xử lý môi trường Docker; không còn test native đang chờ.

**Bước triển khai tiếp theo sau phiên này:** khi có Docker Linux containers,
chạy `node scripts/dxdesk.mjs up` và `node scripts/stack-test.mjs --restart-n8n`,
sau đó chạy `up` lần hai và `node scripts/stack-test.mjs --verify-preserved`.
Đọc `docs/cai-dat.md` trước, không dùng reset để khắc phục lỗi migration.
TN-05 cần máy demo 16 GB; GitHub/Telegram cần tài khoản và thao tác bên ngoài.
Chưa cài Docker/WSL, chưa commit/push/PR/tag/release hoặc gửi tin BTC trong phiên này.

## TV1 — Nguyễn Phú Nguyên: nền tảng và DevOps

### W2-01 — Kho mã và bảng việc

- [x] Repo có LICENSE Apache-2.0, REUSE.toml, README, CHANGELOG, CONTRIBUTING.
- [x] Có mẫu Issue và pull request.
- [x] Có file kế hoạch tuần 2 với ô tick và phân công.
- [x] Chuẩn bị nội dung 12 Issue tại `docs/github-issues-tuan-2.md`.
- [ ] Tạo/sắp xếp bảng GitHub Projects và Milestone trên GitHub — chưa thao tác.
- [x] Cập nhật README với React/NestJS, quyền dữ liệu, lệnh Windows và tài liệu.

### W2-02 — CI

- [x] Repo ban đầu có REUSE, Compose config, APISIX config, shellcheck, khung build/test.
- [x] Cập nhật CI chạy build/test thật cho web và API, không bỏ qua khi thiếu script.
- [x] Thêm job TN-02 và job nghiệm thu stack; chưa chạy GitHub.
- [x] REUSE snapshot nguồn đạt; lockfile khớp dependency; npm ci web/API đạt.
- [x] Chạy build, unit/integration/browser, audit, config, ShellCheck, REUSE và diff tại máy.
- [x] CI GitHub xanh trên PR/main. *31/10: run #42 trên `main` (`d2ee443`) xanh 12/12 job.*

### W2-03 — Docker Compose Tầng 1 và ứng dụng

- [x] Repo ban đầu có 7 dịch vụ Tầng 1 và image ghim phiên bản.
- [x] Bổ sung cấu hình mật khẩu API và audience JWT vào `.env.example`.
- [x] Viết tài khoản `api_login` riêng, NOINHERIT/NOBYPASSRLS.
- [x] Sửa script tạo role/database dùng quoting của psql.
- [x] Viết runner migration có checksum và transaction cho từng file.
- [x] Thêm service API/web, route APISIX, healthcheck và thứ tự startup.
- [x] Tích hợp audience mapper vào realm Keycloak.
- [x] Viết `make up`, `make migrate`, `make test` và script Windows.
- [x] Compose config, YAML/route/env và ShellCheck đạt; chưa xác nhận container runtime.
- [x] Chạy sạch toàn stack, đủ dịch vụ healthy. *31/10: run #42, `node scripts/dxdesk.mjs up` trên VM sạch rồi `PASS Gateway health`, `API ready through APISIX`.*
- [x] Kiểm tra startup lần hai không làm mất dữ liệu. *31/10: run #42, `make up` lần hai + `stack-test.mjs --verify-preserved` PASS `Ticket from previous startup is preserved` và `Scanned attachment remains readable by a new signed URL after restart`.*

### W2-04 / QĐ-4 — n8n

- [x] Repo ban đầu có workflow hello và service import/publish.
- [x] Rà lại import/publish, bổ sung lệnh credentials-import và n8n-reload.
- [x] Viết script kiểm tra webhook trước/sau restart và báo lỗi rõ ràng.
- [x] Viết ADR 0006 về n8n ngoài kho mã và quy trình import.
- [x] Chạy webhook thật và thử restart. *31/10: run #42 PASS `n8n imported workflow responds` và `n8n workflow survives restart`.*
- [ ] Ghi kết quả giữ n8n hay điều kiện chuyển Node-RED/Kestra, không kết luận giả. *31/10: phần kỹ thuật đã có (import và restart ổn định trên CI, ghi trong ADR 0006); quyết định QĐ-4 vẫn chờ BTC xác nhận giấy phép/phạm vi n8n.*

### W2-05 — Keycloak

- [x] Realm có Employee, Agent, Manager và 4 user mẫu.
- [x] Có client web, API và client Appsmith cho thử nghiệm.
- [x] Bổ sung audience `dxdesk-api`, PKCE và post-logout redirect URI.
- [x] Import realm vào database native sạch và kiểm token Keycloak thật:
  10/10 kiểm tra SSO PASS; môi trường native, không phải container.
- [x] Kiểm tra import từ máy sạch Docker và token thật trên stack đích. *31/10: run #42, realm nạp trên VM sạch, PASS `Keycloak users authenticate` và `Token accepted by API and PostgREST`.*
- [x] Đăng nhập trình duyệt → APISIX → API/PostgREST bằng token thật. *31/10: run #42, `stack-browser.mjs` đăng nhập PKCE + OTP rồi tạo/xử lý ticket qua APISIX; đường PostgREST được `stack-test.mjs` kiểm bằng token Keycloak thật.*

### W2-11 — Xác nhận hạn nộp

- [x] Soạn nội dung hỏi BTC và nơi lưu bằng chứng trong `docs/phat-hanh-tuan-2.md`.
- [ ] Người trong nhóm gửi Telegram cho BTC.
- [ ] Lưu câu trả lời xác nhận hạn 06/12/2026.

### W2-12 — Phát hành v0.1.0

- [x] Cập nhật CHANGELOG và release notes dự thảo.
- [x] Chuẩn bị hướng dẫn đóng gói và checklist PoF.
- [ ] Kiểm thử máy sạch và review các phần của ba thành viên. *31/10: máy sạch đã có qua VM CI (run #42); review của thành viên khác vẫn chưa có.*
- [ ] Commit/PR được duyệt, CI xanh, gộp main. *31/10: PR #3, #4, #5, #7 đã gộp `main` và CI xanh; chưa có review được duyệt nên chưa tick.*
- [ ] Tạo tag và GitHub Release v0.1.0 cùng gói `.tar.gz`.
- [ ] Báo cáo thầy sau nghiệm thu.

## TV2 — Nguyễn Văn Quyền: backend và quy trình

### W2-06 — Schema v1 và RLS

- [x] Viết migration 7 bảng: tickets, ticket_events, attachments, categories,
  sla_policies, routing_rules, device_requests.
- [x] Thêm khóa ngoại, CHECK constraint, index và dữ liệu danh mục/SLA/routing ban đầu.
- [x] Viết RLS Employee đọc của mình, Agent/Manager đọc dữ liệu nghiệp vụ.
- [x] Chặn Critical đối với người không có vai trò Manager tại RLS.
- [x] Giới hạn cột INSERT để client không giả requester/status/assignee/timestamps.
- [x] Audit tạo ticket được sinh từ database.
- [x] Viết kiểm tra issuer/identity trước request PostgREST.
- [x] Chạy migration trên PostgreSQL 17.10 thật.
- [x] Kiểm tra RLS đủ 3 vai trò và 2 nhân viên độc lập.
- [x] Kiểm tra danh mục sai/input sai/ghi trái quyền/audit/metadata đính kèm.
- [x] Viết harness migration chạy lần hai/checksum/rollback và đưa vào CI.
- [x] Harness migration: 4/4 PASS với psql 17.10 portable, PostgreSQL 17.10 và Git Bash.
- [x] Ghi ADR 0002 và `docs/du-lieu.md`.

### W2-07 — NestJS API và TN-02

- [x] Viết khung NestJS/TypeScript, cấu hình build và Dockerfile.
- [x] Viết JWT guard: RS256, JWKS, issuer, audience, exp, sub và realm role.
- [x] Viết kết nối PostgreSQL và kiểm tra login không phải superuser/BYPASSRLS.
- [x] Mỗi request dùng transaction, SET LOCAL ROLE và claims tham số hóa.
- [x] Rollback và trả connection vào pool, bỏ connection khi rollback thất bại.
- [x] Viết health, me, categories, ticket list/create/detail/events.
- [x] Viết luồng tối thiểu device requests để kiểm chứng phương án React.
- [x] Validation DTO, phân trang, lỗi HTTP không lộ SQL hoặc bí mật.
- [x] Ghi contract tại `docs/api/contract.md`.
- [x] Cài dependency và build thành công (NestJS 11.2.7, audit 0 vulnerabilities).
- [x] Unit tests JWT/transaction/validation: 6/6 PASS.
- [x] Integration tests HTTP API + PostgreSQL thật: PASS.
- [x] TN-02 với PostgREST 16.4 thật: PASS, JWT fixture có chữ ký RSA.
- [x] Rollback và 24 request đồng thời qua pool 2 connection không lẫn claims.
- [x] Viết ADR 0003, nêu giới hạn portable/Keycloak; cập nhật kết quả cuối sau vòng kiểm tra.
- [x] OpenAPI và hướng dẫn cài đặt/chạy API.

### Review/hỗ trợ của Quyền

- [x] Review mã/cấu hình W2-01…W2-04; phần nghiệm thu runtime vẫn chờ Docker.
- [x] Review kỹ thuật TN-01 và triển khai React dự phòng; còn chờ đội chấp nhận ADR.
- [ ] Hỗ trợ TN-05 và kiểm tra số đo nếu có môi trường phù hợp.

## TV3 — Nguyễn Văn Séc: frontend và thử nghiệm

### W2-08 — React, Vite, Tailwind và OIDC

- [x] Đã giao brief frontend với hợp đồng API, scope và tiêu chí kiểm thử.
- [x] Nhận file worker; xác nhận scope chỉ `apps/web`; đã đọc auth/API/UI và sửa lỗi phát hiện.
- [x] Giao diện tiếng Việt, responsive, loading/empty/error/offline; đã xem ảnh desktop/mobile.
- [x] Keycloak Authorization Code + PKCE S256, token chỉ trong bộ nhớ;
  SSO native thực đã đạt, SSO qua APISIX còn chờ.
- [x] SSO thực native: đăng nhập PKCE, hiển thị username, refresh,
  không lưu token vào web storage, logout xóa dữ liệu; harness 10/10 PASS.
- [x] Refresh trước API, xóa dữ liệu khi logout/hết phiên/401; unit và browser fixture đạt.
- [ ] Gọi API thật qua APISIX; hiển thị username và vai trò. *31/10: phần gọi API thật qua APISIX đã đạt trong run #42; chưa có kiểm thử stack nào assert username/vai trò trên header.*
- [x] Danh sách/tạo/chi tiết ticket và trang xin cấp thiết bị tối thiểu; kiểm form/payload đã đạt.
- [x] Ứng dụng không có fixture hoặc dữ liệu giả; fixture chỉ ở harness kiểm thử độc lập.
- [x] Build, 35/35 tests và 7/7 nhóm kiểm tra trình duyệt desktop/mobile đạt.
- [x] Viết Docker production web và Vite dev proxy; chưa build image vì thiếu Docker.

### W2-09 — TN-01 / QĐ-1: Appsmith hay React

- [x] Đọc tài liệu chính thức: native OpenID Connect được gắn nhãn Enterprise.
- [x] Đối chiếu pricing chính thức: SAML/OIDC thuộc Enterprise.
- [x] Viết ADR 0004, phân biệt đánh giá tài liệu và thử runtime.
- [x] Chọn React chung web theo phương án dự phòng trong slide; chờ review đội.
- [x] Backend device requests đã kiểm chứng RLS từng người bằng token ký thật.
- [x] Luồng React/Keycloak native tạo thiết bị `pending`, Employee B không đọc được,
  Agent/Manager đọc được trên API và PostgREST; kiểm mobile không tràn ngang đạt.
- [ ] Kiểm chứng toàn bộ luồng React/Keycloak trên trình duyệt với stack thật. *31/10: luồng ticket đã đạt trên stack thật (run #42); trang xin thiết bị chưa được `stack-browser.mjs` chạy.*
- [x] Ghi rõ chưa thử Appsmith runtime tại môi trường này.

### W2-10 — TN-05 vòng 1: RAM và Ollama

- [x] Viết `scripts/benchmark.mjs` lấy RAM Docker và tốc độ Ollama có timestamp.
- [x] Công cụ ghi metadata máy, phiên bản, model/digest, prompt, warmup và 3 lượt đo.
- [x] Công cụ xuất JSON/CSV và có hướng dẫn tái lập; chưa có số đo thành công.
- [ ] Đo khi Tầng 1 đang chạy trên máy demo 16 GB — cần môi trường thực tế.
- [x] Viết ADR 0005 với trạng thái chưa đo, chưa chọn model cuối tuần 6.

## Kiểm thử và bằng chứng

Mỗi dòng chỉ cập nhật PASS khi lệnh thực tế kết thúc thành công.

- [x] API: `npm ci`, `npm run build` PASS; audit 0 vulnerabilities.
- [x] API: `npm test` — 6/6 PASS.
- [x] PostgreSQL/RLS/API: 8/8 integration tests PASS.
- [x] PostgREST: TN-02 với tiến trình thật PASS.
- [x] Web: `npm ci`, build PASS; 35/35 tests; audit 0 vulnerabilities.
- [x] UI: desktop/mobile, form, lỗi kết nối và 401: 7/7 nhóm đạt; lưu ảnh + browser.json.
- [x] SSO native: 10/10 PASS lúc 06:58:03 UTC ngày 21/10, có ảnh thiết bị mobile
  và ticket thật; phiên này chưa duyệt ảnh trực quan do công cụ không hỗ trợ ảnh.
- [x] REUSE: `reuse lint` đạt trên snapshot file Git không bị ignore.
- [x] ShellCheck 0.11.0 chạy 5 script shell: PASS sau sửa migration.
- [x] Compose v2.40.3 portable chính thức: `config -q` PASS, chưa chạy daemon/container.
- [x] Stack: `make up` từ máy sạch, health, login, webhook. *31/10: run #42; lượt đầu chạy runner Node mà `make up` dùng chung, lượt hai chạy chính `make up`.*
- [x] Stack: `make up` lần hai/restart n8n, không mất dữ liệu. *31/10: run #42, xem W2-03.*
- [x] `git diff --check` PASS; rà auth/RLS, cấu hình, script và phần tích hợp frontend.

## Trở ngại và việc cần môi trường ngoài

1. Máy Windows hiện chưa có Docker Desktop và chưa cài WSL. Không thể tuyên bố
   7 dịch vụ healthy, chạy Keycloak/APISIX/n8n/ClamAV/SeaweedFS hay số đo TN-05.
2. PostgreSQL portable 17.10 và PostgREST 16.4 đã chạy TN-02 đạt 8/8 tests.
   JWT RSA fixture không thay thế phép thử đăng nhập Keycloak xuyên suốt.
   SSO native với Keycloak thật nay đạt 10/10 nhưng dùng Vite proxy thẳng NestJS,
   vẫn chưa thay thế nghiệm thu APISIX/container.
3. Chưa có `gh` trong PATH. Các việc GitHub và trao đổi BTC chưa thực hiện.
4. Không có bản đầy đủ “ý tưởng 1.3” và “kế hoạch triển khai 1.1” ngoài slide dẫn
   chiếu. Chỉ triển khai theo thông tin đã đọc, ghi rõ quyết định bổ sung trong ADR.

## Điểm tiếp tục nếu phiên bị gián đoạn

- Đọc file này trước, sau đó `git status` và các file đang sửa.
- API ở `apps/api`; migration ở `db`; contract ở `docs/api/contract.md`.
- Antigravity job: `agy-2026-10-20-7c7ebf66`.
- Worktree frontend: `C:\Users\Admin\.codex\antigravity-lead\worktrees\agy-2026-10-20-7c7ebf66`.
- Brief: `work/frontend-w2.json` (ignored). Worker chỉ được sửa `apps/web/`.
- Helper: `C:/Users/Admin/.codex/skills/antigravity-lead/scripts/lead.mjs`.
- Frontend worker đã nhận và tích hợp; không cần chạy lại job. Các kiểm tra cục bộ đã đạt.
- SSO native: xem `tools/testing/native-sso.mjs` và hướng dẫn tại `docs/cai-dat.md`;
  bản phân phối Keycloak đã có, không cần tải lại. Dùng database test mới mỗi lần chạy.
- Các thay đổi hiện chưa commit. Không reset/xóa thay đổi để đồng bộ worker.

## Nhật ký thực hiện

### 21/10/2026 — Chặng 1: khảo sát và khung triển khai

- Đọc scope tuần 2, xác định phần việc của từng người.
- Viết schema/RLS và NestJS API bản đầu; chưa khẳng định kiểm thử đạt.
- Giao frontend độc lập cho Antigravity.
- Phát hiện thiếu Docker/WSL và bắt đầu tìm đường kiểm thử PostgreSQL native.
- Tạo kế hoạch này theo yêu cầu người dùng, sẽ cập nhật cùng quá trình triển khai.

### 21/10/2026 — Chặng 2: build, hạ tầng và kiểm thử

- API build và 6 unit tests PASS; nâng NestJS lên 11.2.7, npm audit không còn cảnh báo.
- Bổ sung Compose API/web, APISIX route, mapper audience, lệnh chạy Windows bằng Node,
  script nghiệm thu stack và công cụ đo TN-05 có đầu ra JSON/CSV.
- PostgreSQL native 17.10 đã khởi chạy, schema/migrations nạp thành công.
- Lần chạy TN-02 đầu chưa đạt vì PostgREST Windows nạp nhầm DLL trong PATH.
  Đã xác định cách dùng libpq đi kèm PostgreSQL portable; đang chạy lại.
- Worker frontend lượt đầu không sửa file vì RunCommand bị chặn. Đã phản hồi
  cho worker dùng công cụ sửa file, Codex chịu trách nhiệm install/build/test.

### 21/10/2026 — Chặng 3: TN-02 đạt và tích hợp frontend

- TN-02 đạt 8/8 tests với PostgreSQL 17.10 + PostgREST 16.4, JWT RSA fixture.
- Sửa độ lệch kiểm tra token hết hạn giữa API/PostgREST bằng pre-request check.
- Compose config kiểm bằng binary chính thức đã xác minh checksum: PASS.
- ShellCheck: PASS.
- Frontend đã tích hợp; sửa refresh thất bại/401/logout để xóa phiên và dữ liệu.
- Bỏ mật khẩu demo và chi tiết hạ tầng khỏi giao diện người dùng; chỉnh menu mobile.
- Dependency frontend bản worker cũ có advisory, đang nâng Vite/Vitest và refresh lockfile.
- Đã ghi ADR 0002–0006, OpenAPI, hướng dẫn cài đặt/dữ liệu/demo, 12 Issue mẫu và release checklist.
- REUSE phát hiện một chuỗi SPDX minh họa sai trong CONTRIBUTING có sẵn: đã sửa.
  Trên Windows REUSE quét cả dependency trong thư mục untracked; sẽ kiểm snapshot
  các file Git không bị ignore thay vì gán giấy phép của đội cho thư viện bên ngoài.

### 21/10/2026 — Chặng 4: giao diện build/test đạt, kiểm tra trình duyệt

- Sửa lỗi TypeScript trong bản frontend nhận được, phân trang rỗng, nhãn bộ lọc,
  hết phiên/401 và phản hồi cũ sau logout. Bổ sung 8 kiểm thử hồi quy: tổng 35/35 PASS.
- Build production PASS. Nâng Vite 7, Vitest 4, Tailwind 4, React Router 7;
  npm audit frontend: 0 vulnerabilities. npm 11.2 trên máy lỗi resolver;
  npm 11 mới chạy tạm qua npx đã cài được, không đổi npm toàn máy.
- Kiểm tra YAML, route, env, audience và lockfile: PASS.
- Đang kiểm tra npm ci sạch và trình duyệt desktop/mobile. UI harness dùng fixture
  HTTP/xác thực tách biệt, không được ghi nhận là Keycloak hay nghiệm thu stack thật.
- Đang chuẩn bị snapshot kiểm REUSE và báo cáo bằng chứng tại `.local/reports`.

### 21/10/2026 — Chặng 5: xác minh và bàn giao cục bộ

- npm ci sạch API/web đạt; backend 6/6, TN-02 8/8, frontend 35/35, browser 7/7.
- Đã xem ảnh desktop/mobile, sửa khả năng xuống dòng ở chi tiết phiếu và Việt hóa lịch sử.
- Báo cáo chi tiết: `docs/bao-cao-kiem-thu-tuan-2.md`; bằng chứng ở `.local/reports`.
- REUSE, ShellCheck, Compose config và kiểm cấu hình/lockfile đạt.
- Bổ sung CI browser và migration; stack lần hai kiểm lại ID phiếu cũ để xác nhận giữ dữ liệu.
- Thử chạy migration harness báo thiếu psql, ghi blocked thật; chưa tick nghiệm thu runner.
- Có script `node scripts/package-review.mjs` để lưu snapshot nguồn và bằng chứng kèm SHA-256.
- Phần cần tiếp tục: Docker/Keycloak/APISIX/n8n runtime, migration runner, TN-05, GitHub và BTC.
  Không còn frontend worker cần chờ. Không có tiến trình ứng dụng/test được chủ ý để chạy nền.

### 21/10/2026 — Chặng 6: tiếp tục kiểm runner migration

- [x] Build web giữ LICENSE/NOTICE của 11 thư viện runtime trong `dist/THIRD-PARTY-LICENSES.txt`.
- [x] Đã tạo gói review đầu tiên tại `.local/releases/review-xL7HTY/`; sẽ tạo lại sau chặng này.
- [x] Lấy `psql` 17.10 portable từ archive EDB qua HTTPS, kiểm CRC ZIP và lưu SHA-256 cục bộ.
  Không cài Windows service và không dùng database ứng dụng đang có.
- [x] Migration runner đạt 4/4: chạy lần đầu/lần hai, giữ dữ liệu, checksum thay đổi bị chặn,
  lỗi SQL rollback cả DDL/ledger rồi chạy lại được. Bằng chứng `.local/reports/migrations.json`.
- [x] Kiểm Keycloak native với Java có sẵn: lượt đầu 9/9 PASS, chặng 7 mở rộng 10/10 PASS.
  Harness: `tools/testing/native-sso.mjs`; Java 25 đã có tại `C:/Program Files/Java/jdk-25`.
  Download có thể tiếp tục bằng `node work/fetch-keycloak-chunks.mjs`, lưu từng phần
  dưới `.local/bin/keycloak-download-parts`; kiểm SHA-256 của release chính thức trước giải nén.
  Chạy test Windows bằng `powershell -NoProfile -File work/run-native-sso.ps1` sau khi tải xong.

- Review thêm JWT: đã siết roles thành mảng chuỗi và kiểm nbf trên PostgREST để khớp API.
  Chạy lại TN-02 8/8 và migration 4/4 đều PASS với thay đổi này.

- [x] Keycloak 26.8.1 đã tải đủ và kiểm SHA-256 release chính thức thành công.
- [x] Kiểm thử SSO native với JDK 25 đã hoàn tất; báo cáo ở `.local/reports/native-sso.json`.

### 21/10/2026 - Chặng 7: khôi phục tiến độ và kiểm chứng lại

- [x] Đọc lại kế hoạch và báo cáo thực tế trước khi làm tiếp; thêm checklist phiên này.
- [x] Báo cáo SSO phiên trước có 9/9 PASS, kết thúc 02:50:47 UTC; chưa suy rộng
  kết quả đó thành nghiệm thu gateway hoặc Docker.
- [x] API/web TypeScript và web Vite build chạy trực tiếp bằng Node thành công.
- [x] Lệnh `npm run build` không có đầu ra và timeout; đã tìm thấy `npm` bị
  ưu tiên từ System32. Chạy lại bằng `npm.cmd`: build API/web đều PASS.
- [x] Chạy lại SSO native: 9/9 PASS, có đăng nhập/refresh/logout Keycloak thật,
  tạo ticket và RLS API/PostgREST. Báo cáo `.local/reports/native-sso.json`.
- [x] Unit tests: API 6/6, web 35/35 PASS; `node tools/testing/check-config.mjs` PASS.
- [x] Bổ sung kiểm trang thiết bị với phiên SSO thật và dữ liệu riêng của hai Employee.
  Lượt mở rộng đầu đã tạo thiết bị HTTP 201 nhưng thất bại ở selector thông báo
  vì giao diện có kèm mã yêu cầu. Đã sửa selector theo nội dung thật; lượt chạy lại
  kết thúc 06:58:03 UTC đạt 10/10. TN-02 chạy lại độc lập đạt 8/8.
- [x] Đồng bộ báo cáo kiểm thử, hướng dẫn cài đặt, ADR 0003/0004 và nhãn ảnh
  trong script đóng gói: `web-*` là fixture, `native-sso-*` là luồng Keycloak thật.
- [x] `powershell -NoProfile -File work/run-migration-test.ps1`: 4/4 PASS.
- [x] `node tools/testing/run-integration.mjs`: 8/8 PASS.
- [x] `node tools/testing/check-config.mjs`, `node --check tools/testing/native-sso.mjs`
  và `git diff --check`: PASS. Build/unit chạy bằng `npm.cmd` như ghi ở trên.
- [x] Kiểm lại môi trường: không tìm thấy `docker`/`gh` trong PATH, WSL chưa cài.
- [x] `node scripts/package-review.mjs`: tạo gói
  `.local/releases/review-l38P0s/dx-desk-week2-review.tar.gz`.
- [x] `tar -tzf` xác nhận có kế hoạch, nhãn snapshot, `native-sso.json` và hai ảnh SSO.
  `Get-FileHash -Algorithm SHA256` khớp file `.sha256` do script tạo:
  `99a1e4adcb9715814705d9992d9044efd55a99e75e18691c747a4c4ec3e58a03`.
- [x] Chốt bàn giao: gói là snapshot review, chưa phải release; kế hoạch trong gói
  được chụp ngay trước khi đóng gói nên chưa có chính đường dẫn/hash ở các dòng này.
  File kế hoạch trong workspace là nhật ký mới nhất. Không có tiến trình test
  được cố ý giữ chạy nền; harness đã dừng Keycloak/PostgREST/Vite/PostgreSQL.
- [ ] Nghiệm thu Docker/APISIX/n8n, startup lần hai và giữ dữ liệu: cần Docker/WSL.
- [ ] TN-05: cần máy demo 16 GB và Ollama/model thực tế, không tạo số đo thay thế.
- [ ] PR/CI GitHub/release, review của đội và Telegram BTC: chưa thực hiện.

### 21/10/2026 - Chặng 8: xử lý điều kiện để nghiệm thu đầy đủ

Người dùng yêu cầu tiếp tục thay vì dừng ở kiểm thử cục bộ. Ghi kế hoạch trước
khi cài môi trường hoặc chạy nghiệm thu; không tự coi yêu cầu này là quyền
khởi động lại máy, công bố release hoặc gửi thông tin ra ngoài.

- [x] Kiểm tra lại môi trường: Windows 11 Home build 26300, RAM khoảng 40 GB,
  ổ C còn khoảng 106 GiB, ổ D còn khoảng 268 GiB, có hypervisor.
- [x] Xác nhận phiên PowerShell không có token quản trị nâng quyền; chưa tìm thấy
  Docker, Ollama, GitHub CLI hoặc winget trong PATH, không có dịch vụ Docker/WSL.
- [x] Xác định hướng tiếp tục: cần cài WSL2 và Docker Desktop/Linux containers,
  có thể cần UAC và khởi động lại. Không thay đổi BIOS từ các chỉ số CPU:
  `HypervisorPresent=True` nên chưa kết luận firmware virtualization bị tắt.
- [ ] Xin phép cài WSL2/Docker Desktop; không tự restart máy hoặc xóa dữ liệu.
- [ ] Sau khi được phép, cài môi trường bằng nguồn chính thức; ghi từng kết quả
  và trạng thái cần restart trước khi tiếp tục.
- [ ] Docker chạy được: `node scripts/dxdesk.mjs up`, sửa lỗi thực tế nếu có,
  chạy `node scripts/stack-test.mjs --restart-n8n`.
- [ ] Chạy `up` lần hai và `node scripts/stack-test.mjs --verify-preserved` — chưa chạy được (thiếu Docker). Harness `migration-test.mjs` tại máy có kiểm "Second run preserves data" nhưng đó không phải `stack-test.mjs`.
- [ ] Chạy kiểm trình duyệt qua APISIX, đồng bộ báo cáo và đóng gói review mới.
- [ ] TN-05 vẫn cần máy demo mục tiêu 16 GB và Ollama/model; RAM máy hiện tại
  khoảng 40 GB không phải môi trường mục tiêu, không ghi số đo thay thế là đạt.
- [ ] GitHub/release/Telegram và review độc lập vẫn cần tài khoản, người phụ trách
  và quyền thao tác cụ thể; không đánh dấu bằng kết quả kiểm thử cục bộ.

**Điểm tiếp tục chặng 8:** đã kiểm tra máy và ghi checklist; chờ quyết định cài
WSL2/Docker Desktop trước khi thay đổi hệ thống. Không có cài đặt đang chạy nền.

### 26/10/2026 - Chặng 9: đính chính trạng thái (không viết lại nhật ký cũ)

Các mục ở chặng 6-8 ghi "chưa push/PR/CI" là đúng tại thời điểm 21/10 nhưng đã
lỗi thời; đính chính ở đây để nhật ký vẫn giữ nguyên tính trung thực của nó:

- [x] Số lượng test nền đã thay đổi: `node tools/testing/run-integration.mjs` hiện
  **9/9 PASS** (thêm test máy trạng thái tuần 3), `apps/api` 22 unit test,
  `apps/web` 64 test, harness migration **4/4 PASS** trong đó có
  "Second run preserves data and migration timestamps" chạy tại máy.
- [ ] Bước "Khởi chạy lần hai, giữ dữ liệu" (mục 113 và 385) vẫn **chưa có nghiệm thu**
  ở cả máy lẫn CI: câu PASS "Second run preserves data and migration timestamps" là
  của `tools/testing/migration-test.mjs` (PostgreSQL nhúng, không có APISIX/Keycloak/
  PostgREST), KHÔNG phải `scripts/stack-test.mjs --verify-preserved` trên stack Docker.
- [ ] Trạng thái push/PR/CI GitHub **không kiểm chứng được từ workspace này**:
  `git remote -v` rỗng, không có `remotes/origin/*`, nhánh `develop-quyennnv`
  không có upstream. Mọi thông tin "PR #3, CI #9 xanh, CI #10 đỏ" đến từ giao diện
  GitHub trong phiên trước, không phải từ `git` trên máy. Người phụ trách cần cấu
  hình remote (hoặc làm việc từ bản clone có remote) rồi mới push/tạo PR/tag.
- [ ] TN-05 (máy demo 16 GB) và review của đội/Telegram BTC: vẫn chưa thực hiện.

### 31/10/2026 - Chặng 10: đối chiếu lại với CI trên main

Đọc log của CI run #42 (`41160760838`, push `main`, SHA `d2ee443`, 12/12 job xanh)
bằng `gh run view --log`, không dựa vào ảnh màn hình. Các ô ở phần checklist phía
trên đã được tick hoặc ghi chú theo kết quả này; nhật ký chặng 1-9 giữ nguyên.

- [x] Docker/APISIX/n8n, startup lần hai và giữ dữ liệu (mục treo ở chặng 7-9):
  job stack chạy `dxdesk.mjs up`, `stack-test.mjs --restart-n8n`, `stack-browser.mjs`,
  rồi `make up` + `stack-test.mjs --verify-preserved`, tất cả PASS.
- [x] Số test hiện tại trên CI: API 44, web 70, integration 19 trên PostgreSQL/PostgREST,
  migration 5 nhóm (`First run applies all 9 SQL files`, có nâng cấp từ schema tuần 2),
  browser fixture 7 nhóm, gateway container 6 nhóm.
- [x] Mục chặng 9 "trạng thái GitHub không kiểm chứng được" đã hết hiệu lực: kho
  này có `origin`, PR #3, #4, #5, #7 đã merge.
- [ ] TN-05 trên máy demo 16 GB: chưa đo.
- [ ] Review của thành viên khác, Telegram BTC, GitHub Projects/Milestone,
  tag/Release v0.1.0 và báo cáo thầy: cần người phụ trách, không tick bằng CI xanh.
