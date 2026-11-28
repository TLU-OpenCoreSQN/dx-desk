# Cài đặt và kiểm thử (tuần 2–3)

## Chạy đầy đủ bằng Docker

Cài Docker Engine + Compose v2 hoặc Docker Desktop chạy Linux containers.
Windows cần bật WSL2 theo hướng dẫn Docker Desktop. Cần Internet để tải image.
Node.js >=22.12 để dùng script đa nền tảng; GNU Make là tùy chọn.

Nếu đã có `.env` từ bản cũ, thêm `ATTACHMENT_SIGNING_KEY` ít nhất 32 byte ngẫu nhiên
trước khi dùng tải tệp; mẫu mới có giá trị chỉ dành cho dev. Chạy bằng Node/Make up
để đồng bộ JWKS và sinh `infra/apisix/runtime.yaml`; không tự copy template thành
cấu hình runtime. Xoay khóa xem ADR 0009. Nghiệm thu tuần 3 xem `hoan-thien-tuan-3.md`.

```powershell
Copy-Item .env.example .env
node scripts/dxdesk.mjs up
node scripts/dxdesk.mjs ps
node scripts/dxdesk.mjs verify
```

Trên Linux/macOS có GNU Make:

```sh
cp .env.example .env
make up
make test-stack
```

Mở `http://localhost:9080` để vào web, `http://localhost:8080` để quản trị Keycloak.
User dev: `employee.a`, `employee.b`, `agent.1`, `manager.1`, mật khẩu `DxDesk@2026`.
Admin Keycloak lấy từ `.env`. Đây là tài khoản mẫu dùng cho demo cục bộ.
Web đăng nhập bằng redirect Keycloak, không nhận mật khẩu trong form của ứng dụng.

### Đơn vị của người dùng (W5-02)

Luồng duyệt đề nghị thiết bị xác định quản lý trực tiếp bằng thuộc tính Keycloak `department` (mã chữ thường,
số, gạch nối). `make up` chạy `scripts/setup-directory.mjs`: khai báo thuộc tính trong user profile (chỉ quản
trị viên sửa được), thêm mapper đưa claim `department` vào access token của `dxdesk-web` và gán đơn vị cho
tài khoản demo chưa có: `employee.a`, `manager.1` → `phong-hanh-chinh`; `employee.b` → `phong-ke-toan`;
`agent.*` → `phong-cntt`. Script chạy lặp an toàn và không ghi đè đơn vị đã gán tay.

Gán đơn vị cho tài khoản khác: Keycloak Admin → realm `dxdesk` → Users → chọn người dùng → trường **Đơn vị**.
Người dùng phải đăng nhập lại để token mới mang claim. Một đơn vị cần ít nhất một tài khoản vai trò
`Manager` cùng mã thì đề nghị mới có người duyệt. Nghiệm thu trên stack có `AUTOMATION_ENABLED=true`:
`node tools/testing/week5-device.mjs` (báo cáo ở `.local/reports/week5-device.json`).

### Ứng dụng 2 "Xin cấp thiết bị" (W5-01)

`make up` dựng thêm container `device-request` (Nginx phục vụ SPA, không công bố cổng) và route APISIX
`/thiet-bi/*`. Mở **http://localhost:9080/thiet-bi/** hoặc bấm "Xin cấp thiết bị (ứng dụng 2)" ở thanh bên
DX-Desk; đã đăng nhập DX-Desk thì không phải đăng nhập lại. Client Keycloak `dxdesk-device` do realm JSON
(cài mới) hoặc `scripts/setup-directory.mjs` (realm có sẵn) tạo.

Thử luồng: `employee.a` gửi đề nghị → `manager.1` duyệt → `agent.1` chuẩn bị rồi bàn giao.
Phát triển riêng: `npm ci --prefix apps/device-request && npm run dev --prefix apps/device-request`
(cổng 5174, đường dẫn `/thiet-bi/`, proxy `/rest` tới stack đang chạy ở cổng 9080).

### Bật, tắt module giao diện (W6-11)

Giao diện DX-Desk chia thành bốn module: `core` (trang chủ, luôn bật), `desk` (phiếu hỗ trợ, bảng việc,
phê duyệt), `devices` (yêu cầu cấp thiết bị và liên kết ứng dụng 2) và `data` (danh mục dữ liệu, báo cáo).
Nguồn chuẩn là `modules.enabled` trong `config/doanh-nghiep/cau-hinh.json`. Lệnh `config apply` sinh
`config/doanh-nghiep/modules.json`; không sửa độc lập projection này. Container `web` mount thư mục
cấu hình vào `/etc/dxdesk/enterprise` bên ngoài web root; Nginx chỉ công bố đúng `modules.json` qua
`/config/modules.json`, không công bố cấu hình doanh nghiệp hoặc workflow. Trình duyệt đọc lúc tải trang:

```json
{ "enabled": ["core", "desk", "devices", "data"] }
```

Bỏ một mã khỏi danh sách nguồn, chạy `config apply` rồi tải lại trang: menu, lối tắt ở trang chủ và route
của module đó biến mất, không cần build lại image hay khởi động lại container. Tệp thiếu, sai dạng hoặc
request/body vượt 5 giây thì giao diện dùng fallback bật tất cả module, không giữ màn hình tải vô hạn.
Tắt module chỉ ẩn giao diện; quyền truy cập dữ liệu vẫn do RLS quyết định.

Mỗi module khai báo trong `apps/web/src/modules/<mã>/manifest.ts` (mã, tên, biểu tượng, đường dẫn, vai trò
Keycloak tối thiểu). Menu chỉ hiện mục đúng vai trò; vai trò cao hơn bao hàm vai trò thấp hơn
(Employee < Agent < Manager).

### Cấu hình doanh nghiệp (W6-12)

Cài dependency kiểm schema rồi kiểm tra nguồn cấu hình, không cần `.env` hoặc DB cho bước validate:

```bash
npm ci --prefix tools/testing
node scripts/dxdesk.mjs config validate
```

`config/schema.json` định nghĩa phiên bản 1: `teams`, `categories`/`requirement_fields`, `routing`,
`sla_policies` theo priority và `modules.enabled`. Trường động hiện hỗ trợ chuỗi; mỗi trường có thể khai
báo thêm `placeholder` (ví dụ trong ô nhập) và `hint` (dòng giải thích), tối đa 200 ký tự, để form tạo
phiếu hướng dẫn người dùng theo cách gọi của doanh nghiệp. Bắt buộc giữ module
`core`; mã trùng, trường lạ, JSON trùng khóa hoặc policy sai bị từ chối. Validate offline chưa xác nhận
tham chiếu tới nhóm/danh mục hiện có trong DB; kiểm tra đó chạy trong apply.

Sau khi stack thử đã khởi động, quản trị viên được phép áp dụng bằng tài khoản PostgreSQL quản trị
trong `.env`; lệnh này **ghi cấu hình DB**, không dùng trên dữ liệu vận hành khi chưa được đồng ý:

```bash
node scripts/dxdesk.mjs config apply
```

Có thể truyền đường dẫn JSON sau `validate`/`apply`; file mặc định là `config/doanh-nghiep/cau-hinh.json`.
Giữ một nguồn chuẩn khi quản lý triển khai. `node scripts/dxdesk.mjs config` không có subcommand vẫn
chỉ kiểm Compose như trước.

Apply upsert theo mã nghiệp vụ trong một transaction, không xóa mục vắng trong JSON; thay đổi vô hiệu
hóa phải tường minh. SLA mới áp cho ticket mới, không viết lại clock lịch sử. Chạy hai lần không đổi
row version nếu nội dung không đổi. Quyền ứng dụng bình thường không được áp cấu hình.

Khóa `.config-apply.lock` được giữ từ trước ghi DB đến khi publish projection; lệnh cạnh tranh dừng
trước khi ghi. Nếu tiến trình chết, kiểm PID trong file và xác minh đã dừng trước khi quản trị viên
xử lý khóa; không tự xóa khóa đang tồn tại. DB và filesystem không có transaction chung: lỗi publish
sau commit báo `CONFIG_PROJECTION_FAILED`, giữ projection cũ khi rename chưa thành công; sửa quyền
hoặc mount rồi chạy lại cùng cấu hình để phục hồi idempotent. Không dùng rollback migration để
sửa lỗi projection.

Nghiệm thu TN-07: thêm danh mục `peripheral` tên “Cấp thiết bị ngoại vi”, field `asset_code` bắt buộc,
routing tới nhóm active và đổi một policy; validate/apply, tải lại form rồi tạo ticket mới. Kiểm thiếu
field bị chặn, định tuyến/deadline đúng, apply lần hai không trùng và ticket cũ không đổi deadline.
Harness `node tools/testing/enterprise-config.mjs` chạy trên PostgreSQL dùng một lần, không dùng DB
hiện tại; browser fixture riêng không được gọi là nghiệm thu Compose/PostgREST trọn luồng.

### Workflow doanh nghiệp (W6-13)

Nguồn workflow duy nhất nằm trong `config/doanh-nghiep/workflows/`. Cả importer và publisher mount
vào `/import/workflows`; ID workflow cũ giữ nguyên. Kiểm toàn bộ JSON, ID duy nhất và cấu trúc trước
khi `up`/`n8n-reload` thay đổi dịch vụ:

```bash
node infra/n8n/validate-workflows.mjs
node scripts/dxdesk.mjs n8n-reload
```

`n8n-reload` chỉ chạy trên stack được phép; lỗi preflight xảy ra trước bước dừng n8n. Publisher vẫn
chỉ bật workflow hello khi automation tắt, không tự xóa workflow vắng trong thư mục. Kiểm restart
trên stack thật bằng `node scripts/stack-test.mjs --restart-n8n`; unit test không thay bằng chứng này.

### Bộ đánh giá AI tuần 6 (W6-05, W6-08, W6-14)

`config/evaluation/assistant-questions.json` có 10 câu lõi tổng quát và 5 câu mở rộng, trong đó hai
luồng VPN cố định chỉ chấm flow, không được cộng vào ngưỡng model 8/10. `ticket-triage.json` có 20
ticket giả tiếng Việt với nhãn/rubric; nhãn cần reviewer độc lập xác nhận trước nghiệm thu.

```bash
node tools/testing/week6-evaluate.mjs --help
node tools/testing/week6-evaluate.mjs --timeout-ms 3000
```

> Công cụ này vẫn gọi API Ollama và chưa chuyển sang API bên thứ ba của [ADR 0011](adr/0011-mo-hinh-ai-qua-api-ben-thu-ba.md);
> chưa dùng được cho tới khi cập nhật.

Mặc định chỉ preflight GET: kiểm gateway, role token và model đã có trong Ollama; không pull model,
không sinh câu trả lời hoặc xác nhận hành động. Runtime/token thiếu trả exit khác 0 và
`completed:false`, không coi thiếu máy là kết quả đạt. Token của ba người dùng thử nhập từ biến môi
trường `WEEK6_EMPLOYEE_TOKEN`, `WEEK6_AGENT_TOKEN`, `WEEK6_MANAGER_TOKEN`, không đặt trong command line,
file Git, chat hoặc ảnh.

Chỉ dùng `--run-assistant`/`--run-triage` sau khi có môi trường giả lập được phép; xem `--help` để
cung cấp model, người chạy, phiên bản dữ liệu và đường dẫn output tuyệt đối có thư mục cha sẵn có.
Runner không tự đổi model trên gateway: mỗi lượt phải cấu hình model ở server và ghi nhận đối chiếu
model/digest; `--gateway-model` là xác nhận của người vận hành, không phải bằng chứng protocol.

Report có raw answer, trace công khai, TTFT tính từ delta nội dung đầu, model digest, SHA/hash cấu
hình và mẫu RAM host. Sao reviewTemplate thành file ngoài repo rồi reviewer khác người chạy điền
đúng/sai, privacy/consent, facts/summary và ghi chú; dùng `--score`/`--reviews` để chấm offline. Không tự
đổi keyword match thành đánh giá không bịa. Điểm model ≥8/10 và category ≥16/20 tính từng lượt;
bất kỳ lỗi quyền/xác nhận đều fail. Triage standalone chỉ gọi phân loại và rút gọn chuỗi như API,
không thay nghiệm thu DB/audit/duyệt đề xuất. RAM host không thay RAM container/WSL; full-stack peak,
OOM, máy 16 GB và QĐ-5 vẫn cần số đo và xác nhận riêng.

### Nhập nhân viên từ CSV (W6-15)

Doanh nghiệp mới cấp tài khoản hàng loạt bằng `scripts/import-nhan-vien.mjs`. Tệp CSV (UTF-8, dấu phẩy) có
tiêu đề `tai_khoan,ho_ten,email,vai_tro,nhom_xu_ly` và cột tùy chọn `don_vi`:

| Cột | Ý nghĩa |
| --- | --- |
| `tai_khoan` | Tên đăng nhập Keycloak: chữ thường không dấu, số, `.`, `-`, `_` |
| `ho_ten` | Họ tên; từ đầu thành họ (`lastName`), phần còn lại thành tên (`firstName`) |
| `email` | Không trùng trong tệp và không trùng tài khoản Keycloak khác |
| `vai_tro` | `Employee`, `Agent` hoặc `Manager` (realm role) |
| `nhom_xu_ly` | Tên nhóm xử lý (ví dụ `Network Team`) hoặc UUID; nhiều nhóm cách nhau bằng `;`. Chỉ Agent và Manager |
| `don_vi` | Mã đơn vị (W5-02), ví dụ `phong-ke-toan`; chỉ gán khi tài khoản chưa có đơn vị |

Mẫu: `config/doanh-nghiep/nhan-vien.mau.csv`. Tệp `config/doanh-nghiep/nhan-vien.gia-lap-50.csv` là
**dữ liệu giả lập** 50 người (40 Employee, 7 Agent, 3 Manager, email `@gia-lap.dxdesk.local`) để thử trên stack demo.

```sh
# 1. Kiểm tra tệp, không cần stack
node scripts/dxdesk.mjs import-nhan-vien config/doanh-nghiep/nhan-vien.gia-lap-50.csv --offline
# 2. Chạy thử: đối chiếu Keycloak và danh sách nhóm, in kế hoạch từng dòng, không ghi gì
node scripts/dxdesk.mjs import-nhan-vien config/doanh-nghiep/nhan-vien.gia-lap-50.csv
# 3. Chạy thật; mật khẩu tạm của người mới tạo ghi ra tệp NGOÀI thư mục kho
node scripts/dxdesk.mjs import-nhan-vien config/doanh-nghiep/nhan-vien.gia-lap-50.csv \
  --thuc-hien --xuat-mat-khau ../mat-khau-tam.csv
# Hoặc: make import-nhan-vien CSV=config/doanh-nghiep/nhan-vien.gia-lap-50.csv NV_ARGS="--thuc-hien --xuat-mat-khau ../mk.csv"
```

Khi chạy thật, mỗi người mới có mật khẩu tạm 20 ký tự sinh ngẫu nhiên (CSPRNG), credential `temporary` và
required action `UPDATE_PASSWORD`, nên lần đăng nhập đầu phải đổi mật khẩu. Mật khẩu không in ra màn hình;
`--xuat-mat-khau` bắt buộc khi có người cần tạo, tệp phải nằm ngoài kho, không được tồn tại trước và được
tạo với quyền 600. Giao riêng cho từng người rồi xóa tệp. Agent/Manager có `nhom_xu_ly` được đưa vào nhóm qua
`POST /api/system/roster` bằng token dịch vụ `dxdesk-automation` (cần `AUTOMATION_ENABLED=true` và
`AUTOMATION_CLIENT_SECRET` trong `.env`), lô tối đa 100 người. Roster chỉ thêm hoặc cập nhật, không xóa thành
viên đang có của nhóm. Thông tin Keycloak lấy từ `.env` (`KEYCLOAK_PUBLIC_URL`, `KEYCLOAK_REALM`,
`KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`); biến môi trường cùng tên ghi đè `.env`, `DXDESK_GATEWAY_URL`
đổi địa chỉ cổng (mặc định `http://localhost:$APISIX_PORT`).

Chạy lại an toàn: tài khoản đã có thì không tạo lại, không đổi mật khẩu, chỉ bổ sung vai trò hoặc thành viên
nhóm còn thiếu. Báo lỗi theo dòng: thiếu cột, tài khoản/email sai dạng, vai trò sai, Employee có nhóm, nhóm
không tồn tại hoặc ngừng hoạt động, tài khoản hoặc email trùng trong tệp, email đã thuộc tài khoản Keycloak
khác, tài khoản đã có vai trò DX-Desk khác (script không tự đổi vai trò, sửa tay trong Keycloak Admin). Chạy thử
có dòng lỗi trả mã thoát 1; chạy thật từ chối ghi khi còn dòng lỗi, trừ khi thêm `--bo-qua-dong-loi` để chỉ
ghi các dòng hợp lệ. Người dùng mới phải đăng nhập lại để token mang vai trò; Agent thấy hàng đợi của nhóm
ngay khi roster được ghi.

Đưa một kỹ thuật viên có sẵn vào nhóm bằng tay (khi không dùng CSV): lấy `id` người dùng trong Keycloak Admin
→ Users, `id` nhóm từ `GET /api/system/teams`, rồi gọi roster bằng token dịch vụ:

```sh
TOKEN=$(curl -s -d grant_type=client_credentials -d client_id=dxdesk-automation \
  -d client_secret="$AUTOMATION_CLIENT_SECRET" \
  http://localhost:8080/realms/dxdesk/protocol/openid-connect/token | jq -r .access_token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9080/api/system/teams | jq '.data[] | {id, name}'
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"members":[{"team_id":"<id nhóm>","user_id":"<id Keycloak>","display_name":"Họ tên","active":true}]}' \
  http://localhost:9080/api/system/roster
```

Phương án thay thế có sẵn trong Keycloak (không qua script, không đưa người vào nhóm xử lý):

- **Partial import**: Keycloak Admin → realm `dxdesk` → Realm settings → Action → **Partial import**, chọn tệp
  JSON dạng `{"users":[{"username":"...","email":"...","firstName":"...","lastName":"...","enabled":true,
  "realmRoles":["Employee"],"requiredActions":["UPDATE_PASSWORD"],"credentials":[{"type":"password",
  "value":"...","temporary":true}]}]}`, chọn xử lý khi trùng *Skip*. Phải tự sinh mật khẩu tạm và tự giữ kín tệp.
- **Đồng bộ LDAP/Active Directory**: Realm settings → User federation → Add LDAP providers, khai báo URL máy
  chủ, Bind DN, Users DN; chế độ `READ_ONLY` hoặc `UNSYNCED`; thêm mapper *role-ldap-mapper* hoặc
  *group-ldap-mapper* để ánh xạ nhóm AD sang `Employee`/`Agent`/`Manager`, rồi *Sync all users*. Mật khẩu do
  AD quản lý nên không cần mật khẩu tạm. Nhóm xử lý vẫn đưa vào bằng roster như trên.

### Wiki.js tri thức (W5-08)

Hồ sơ `demo-light` và `full` có Wiki.js 2.5.315 tại `http://localhost:18030` (đổi bằng `WIKI_PORT`,
`WIKI_PUBLIC_URL`) và một PostgreSQL riêng không công bố ra host. `up` tự sinh `WIKI_DB_PASSWORD`,
`WIKI_ADMIN_PASSWORD`, `WIKI_CLIENT_SECRET` vào `.env`, rồi `scripts/setup-wiki.mjs`:

- tạo/cập nhật client Keycloak `wikijs` (confidential, chỉ callback `/login/keycloak/callback`,
  claim `dxdesk_roles`, không mang audience `dxdesk-api`);
- hoàn tất cài đặt lần đầu, bật OIDC + `autoLogin`, chặn khách đọc bài;
- tạo nhóm Wiki trùng tên vai trò: `Employee` chỉ đọc/bình luận, `Agent`/`Manager` sửa bài;
- nạp 6 bài trong `docs/wiki/*.md` (CC BY 4.0); chạy lại chỉ cập nhật bài có nội dung đổi.

Người dùng vào bài lần đầu thấy trang "Unauthorized" của Wiki.js; bấm **Đăng nhập** sẽ chuyển
thẳng tới Keycloak (đã có phiên thì không hỏi lại mật khẩu) rồi quay về đúng bài.
Quản trị cục bộ: `http://localhost:18030/login?all=1`, tài khoản `wiki.admin@dxdesk.local`,
mật khẩu `WIKI_ADMIN_PASSWORD` trong `.env`. Nghiệm thu: `node tools/testing/week5-wiki.mjs`.

Khởi tạo lần đầu ClamAV cần tải cơ sở dữ liệu mẫu virus; chờ healthcheck vài phút.
Nếu Docker chưa chạy, lệnh phải báo lỗi; không coi build web cục bộ là full stack.

## Phát triển từng ứng dụng

```sh
npm ci --prefix apps/api
npm run build --prefix apps/api
npm test --prefix apps/api
npm ci --prefix apps/web
npm run dev --prefix apps/web
```

Web dev tại `http://localhost:5173`, proxy API qua APISIX 9080.
Biến Vite trong `apps/web/.env.example`; token chỉ ở memory.
API cần `DATABASE_URL`, `OIDC_ISSUER`, `OIDC_JWKS_URL`, `OIDC_AUDIENCE`.
Không chạy API bằng database superuser. Docker cung cấp sẵn cấu hình này.

## Kiểm thử TN-02 không cần Docker

```sh
npm ci --prefix apps/api
npm run build --prefix apps/api
npm ci --prefix tools/testing
npm run integration --prefix tools/testing
```

Harness dùng PostgreSQL portable 17.10, tải PostgREST chính thức 16.4 có kiểm
SHA-256. Chạy trên Windows x64/Linux x64; OS khác đặt `TEST_POSTGREST_BIN`.
Cần cho phép lifecycle script của package embedded-postgres.
Database tách biệt nằm dưới `.local/pg-test-*`, không sửa database đang dùng.
Tiến trình được dừng sau test. Bản portable khác patch với image PostgreSQL 17.11;
chạy thêm nghiệm thu Docker trước khi phát hành.

Kết quả lưu ở `.local/reports/integration.json` và `integration.tap`.

## Kiểm tra giao diện trên trình duyệt

```sh
npm ci --prefix apps/web
npm ci --prefix tools/testing
# Chạy trong tools/testing:
npx playwright install chromium
npm run browser
```

Harness tự khởi chạy/dừng Vite, dùng fixture xác thực và HTTP trong trình duyệt,
không đưa fixture vào ứng dụng. Kiểm tra desktop 1440 px, mobile 390 px, form,
phân quyền Critical và xóa giao diện dữ liệu sau 401. Báo cáo và ảnh ở `.local/reports`.
Đây là kiểm thử UI fixture; SSO native thật có harness riêng bên dưới và vẫn cần
nghiệm thu đường đi APISIX bằng stack Docker.

## Kiểm chứng migration runner

```sh
# Cần psql và sh trong PATH; CI Linux cài postgresql-client.
node tools/testing/migration-test.mjs
```

Test tạo cluster riêng, kiểm chạy lần đầu/lần hai, giữ dữ liệu, từ chối checksum
thay đổi và rollback DDL/ledger khi file SQL lỗi. Ngày 21/10/2026 đã đạt 4/4 trên
Windows với PostgreSQL 17.10 portable, psql 17.10 và Git Bash. psql nằm tại
`.local/bin/psql-17.10/pgsql/bin`, chỉ thêm PATH cho tiến trình kiểm thử.
Nguồn client: [archive EDB](https://www.enterprisedb.com/download-postgresql-binaries),
được [PostgreSQL](https://www.postgresql.org/download/windows/) dẫn tới.
Manifest tải giữ URL/ETag/CRC ZIP/SHA-256 cục bộ; không coi SHA cục bộ là chữ ký nhà phát hành.
Khi chạy lại stack lần hai, dùng `node scripts/stack-test.mjs --verify-preserved`
để kiểm phiếu và audit của lần nghiệm thu trước vẫn còn.

## Kiểm thử SSO native (bổ sung khi không có Docker)

Harness `tools/testing/native-sso.mjs` đạt 10/10 kiểm tra ngày 21/10/2026.
Nó dùng Keycloak 26.8.1 + JDK 25, PostgreSQL riêng, NestJS, PostgREST và Chromium thật.
Web dev dùng Vite proxy trực tiếp tới API, nên không thay thế nghiệm thu APISIX/n8n.
Chỉ dùng một bản phân phối Keycloak riêng cho test; realm được sao chép vào thư mục import.
Tải ZIP chính thức và đối chiếu SHA-256 release trước khi giải nén, không dùng
bản Keycloak có cấu hình/dữ liệu vận hành. Cài dependencies, build API/web và cài
Chromium theo các phần trên trước khi chạy. Trên máy Windows này, dùng `npm.cmd`
thay cho `npm` vì PATH ưu tiên launcher `C:/Windows/System32/npm` làm lệnh bị treo.

```powershell
$env:TEST_KEYCLOAK_HOME = (Resolve-Path .local/bin/keycloak-26.8.1).Path
$env:TEST_JAVA_HOME = 'C:/Program Files/Java/jdk-25'
$env:TEST_POSTGREST_BIN = (Resolve-Path .local/bin/postgrest-v16.4-win32/postgrest.exe).Path
node tools/testing/native-sso.mjs
```

Cổng 5173 cần trống để khớp redirect URI đã khai báo trong realm. Các cổng khác cấp
tự động, chỉ bind loopback. Harness dừng các tiến trình và database khi kết thúc,
lưu báo cáo không chứa token tại `.local/reports/native-sso.json`.
Kiểm tra gồm PKCE thật, ticket/audit, vai trò/RLS, tạo yêu cầu thiết bị bằng trình
duyệt và quyền đọc trên API/PostgREST, mobile không tràn ngang, refresh/logout.
Ảnh `native-sso-ticket.png` và `native-sso-device-mobile.png` là luồng thật,
khác ảnh fixture `web-*`. Harness dùng tài khoản demo trong realm và database test
riêng dưới `.local/sso-test-*`, không kết nối database vận hành.
Xem [hướng dẫn native chính thức Keycloak](https://www.keycloak.org/getting-started/getting-started-zip).

## Bật OTP cho demo (W3-07)

Mặc định realm `infra/keycloak/realm-dxdesk.json` KHÔNG bật OTP: harness `tools/testing/native-sso.mjs`
và nghiệm thu CI đăng nhập bằng password grant (direct access); thêm `CONFIGURE_TOTP` vào
`requiredActions` của 4 user demo ngay trong realm chuẩn sẽ làm các luồng đó hỏng. Vì vậy OTP
làm dạng hồ sơ tùy chọn, bật khi diễn demo và tắt khi chạy harness.

Cách 1 — bật/tắt trên stack đang chạy bằng `kcadm.sh` (khuyên dùng; giữ nguyên dữ liệu):

```sh
set -a; . ./.env; set +a
docker compose --env-file .env -f infra/compose/docker-compose.yml exec keycloak \
  /opt/keycloak/bin/kcadm.sh config credentials --server http://127.0.0.1:8080 \
  --realm master --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD"

# Xem id của user demo (chữ số UUID trong kết quả):
docker compose --env-file .env -f infra/compose/docker-compose.yml exec keycloak \
  /opt/keycloak/bin/kcadm.sh get users -r dxdesk -q username=employee.a

# Bật CONFIGURE_TOTP (thay <ID> bằng UUID; REST Keycloak cũng chấp nhận username ở vị trí này):
docker compose --env-file .env -f infra/compose/docker-compose.yml exec keycloak \
  /opt/keycloak/bin/kcadm.sh update users/<ID> -r dxdesk -s 'requiredActions=["CONFIGURE_TOTP"]'

# Bỏ yêu cầu enrollment; không xóa credential OTP đã cấu hình:
#   ... update users/<ID> -r dxdesk -s 'requiredActions=[]'
```

Lần đăng nhập trình duyệt tiếp theo của user đó, Keycloak bắt đầu bằng màn hình quét mã QR
trình authenticator rồi mới cho vào ứng dụng; các lần sau yêu cầu mã TOTP 6 số (chu kỳ 30 giây,
HmacSHA1 — khai trong cả hai tệp realm). Khi user đã quét QR xong mà muốn đặt lại, xóa TOTP
của user trong Admin Console (mục Credentials) rồi làm lại.

Cách 2 — dựng máy sạch/CI với OTP bật sẵn cho cả 4 user: realm dự phòng
`infra/keycloak/realm-dxdesk-otp.json` (bản sao realm chuẩn thêm `requiredActions`), nạp qua
hồ sơ compose chồng:

```sh
docker compose --env-file .env \
  -f infra/compose/docker-compose.yml \
  -f infra/keycloak/compose-otp.yml up -d
```

Lưu ý: import chỉ tạo realm khi chưa tồn tại (xem mục Migration), nên cách này dành cho máy
sạch hoặc sau `down -v`; với stack đang chạy dùng cách 1.

Nghiệm thu M2 số 1 ("đăng nhập SSO + OTP, tạo ticket VPN có ảnh chụp màn hình"): bật OTP cho
`employee.a` bằng cách 1, đăng nhập web qua Keycloak bằng trình duyệt, quét QR bằng ứng dụng
TOTP bất kỳ (FreeOTP/Authenticator), nhập mã, tạo ticket VPN kèm ảnh chụp màn hình, kiểm tra
ticket ở trạng thái `new` và có bản ghi `ticket_events`. Chứng minh harness không hỏng: tắt
credential OTP trong Admin Console của tài khoản kiểm thử (hoặc dùng user khác chưa bật)
rồi chạy `node tools/testing/native-sso.mjs`. Chỉ xóa requiredActions không tắt TOTP đã đăng ký.
Chưa chạy thật các lệnh trên — máy phát triển chưa có Docker, tất cả các lệnh `docker compose
exec ... kcadm.sh` **chờ Docker/CI kiểm chứng**; cú pháp theo tài liệu kcadm của Keycloak 26.

## Theo dõi nhật ký yêu cầu qua cổng APISIX

- `docker compose --env-file .env -f infra/compose/docker-compose.yml logs apisix` — nhật ký
  error/runtime của APISIX (image ghi error.log ra stdout; không có curl trong container).
- `docker compose ... exec apisix cat /usr/local/apisix/logs/access.log` — access log mặc định
  của APISIX ghi lại từng yêu cầu đi qua cổng (kèm request id); không cần cài plugin ghi log.
- Route `/api/*` có `limit-req` (30 req/giây/source, burst 10, trả 429).
  APISIX kiểm JWT bằng `openid-connect` cho `/api/*` và `/rest/*`: RS256,
  khóa công khai đồng bộ từ JWKS, issuer và audience `dxdesk-api` (ADR 0009).
  API và PostgREST cũng tự kiểm chữ ký. `/api/health` có route công khai riêng.
  Không coi cấu hình rate limit là nghiệm thu runtime 429.

## Báo cáo Metabase (W5-06)

Đặt `COMPOSE_PROFILES=full` trong `.env` rồi chạy `make up` (hoặc `node scripts/dxdesk.mjs up`).
Runner tạo tài khoản nội bộ Metabase, cấu hình nguồn PostgreSQL chỉ đọc và nạp
dashboard cùng các câu hỏi từ `infra/metabase/dashboard.mjs`. Metabase có CSDL riêng cho
cấu hình, chạy ở `http://localhost:18031`. Các mật khẩu và khóa ký nằm trong `.env`.
Dashboard dành cho Manager ở `/bao-cao`. Bản OSS dùng URL nhúng ký có hạn 5 phút theo
[ADR 0008](adr/0008-sso-keycloak-cho-ung-dung-co-san.md).

Báo cáo tổng hợp theo múi giờ Việt Nam. Tỷ lệ thủ công tạm tính bằng số sự kiện
`status_changed` do người thực hiện chia tổng số sự kiện chuyển trạng thái của tuần.
Lượt tự phục vụ lấy từ view W5-08. Hàng KPI VPN chỉ hiện khi đã nạp kịch bản vào
DB demo theo [thẻ dữ liệu](data/README.md).

## Migration và cập nhật

Migration có checksum và ledger `migration_meta.applied`, áp dụng nguyên tử mỗi file.
Không sửa file đã chạy ở môi trường dùng chung; thêm migration mới.
`node scripts/dxdesk.mjs migrate` áp dụng thay đổi và reload schema PostgREST.
Không dùng `make reset` để cập nhật schema vì lệnh đó xóa dữ liệu.

Nếu nâng từ khung Tầng 1 cũ, thêm biến mới từ `.env.example` vào `.env`.
Runner tạo `api_login` cho database cũ nếu chưa có. Realm Keycloak import chỉ diễn ra
khi realm chưa tồn tại: với realm cũ, thêm mapper audience `dxdesk-api` cho client
`dxdesk-web` qua Admin Console hoặc import vào database demo mới có chủ đích.
Không tự xóa volume Keycloak để cập nhật cấu hình.

## Sao lưu và khôi phục (W7-01)

### Phạm vi

| Có trong bản sao | Cách lấy |
|---|---|
| CSDL DX-Desk (phiếu, lịch sử, outbox, đề nghị thiết bị, hội thoại trợ lý), Keycloak (người dùng, OTP, client), n8n (workflow, lịch sử chạy) | `pg_dump -Fc --create` trong container `postgres` |
| Vai trò PostgreSQL của cụm chính (`api_login`, `authenticator`, `ticket_automation`…) kèm hash mật khẩu | `pg_dumpall --roles-only` |
| Mattermost, Wiki.js, Metabase (khi hồ sơ đang chạy các dịch vụ này) | `pg_dump` trong container CSDL riêng của từng ứng dụng |
| Tệp đính kèm và biên bản PDF trong SeaweedFS | nén volume `seaweedfs-data`; tạm dừng các dịch vụ ghi trong cùng cửa sổ sao lưu để CSDL khớp với tệp |

Không có trong bản sao, và giới hạn khi khôi phục:

- **`.env` và mọi secret** (khóa ký URL tải tệp, khóa mã hóa n8n, token bot Mattermost, mật khẩu CSDL).
  Giữ một bản `.env` riêng ở nơi an toàn, tách khỏi thư mục bản sao. Khôi phục phải dùng **cùng `.env`** với
  lúc sao lưu. Nếu dùng `.env` khác: mật khẩu vai trò CSDL bị đưa về giá trị cũ, n8n không giải mã được
  credential, URL tải tệp cũ mất hiệu lực.
- Chỉ mục Qdrant của trợ lý: dựng lại từ Wiki.js khi `up` (`wiki-index`).
- Chữ ký virus ClamAV: tải lại khi container khởi động.
- Tệp tải lên trong Mattermost (volume `mattermost-data`): DX-Desk chỉ gửi thông báo chữ, không gửi tệp.
- Bản sao nằm cùng máy với stack: mất máy là mất cả bản sao. Phải chép thư mục bản sao sang máy khác
  (xem lịch bên dưới).

### Sao lưu

```sh
node scripts/dxdesk.mjs backup     # hoặc: make backup
```

- **Nơi lưu:** mỗi lần chạy tạo một thư mục `dxdesk-<thời điểm UTC>` trong `BACKUP_DIR` (mặc định `.local/backups`, đã nằm trong `.gitignore`). Thư mục có `manifest.json` ghi SHA-256 từng tệp, commit và phiên bản PostgreSQL/SeaweedFS.
- **Số bản giữ:** giữ `BACKUP_KEEP` bản hoàn chỉnh mới nhất (mặc định 7) và xóa bản cũ hơn.
- **Kiểm tra dung lượng:** trước khi chạy, lệnh so dung lượng trống với kích thước dữ liệu, cộng thêm 20% và 256 MiB. Không đủ thì dừng, không ghi gì.
- **Nhật ký:** kết quả từng lần (thành công hay lỗi) ghi thêm vào `BACKUP_DIR/backup.log`. Lỗi giữa chừng thì xóa thư mục dở dang.
- **Cửa sổ bảo trì:** API, PostgREST, Keycloak, n8n, Wiki.js, Mattermost, Metabase và các tiến trình AI đang chạy được tạm dừng trước khi dump CSDL. Trong thời gian sao lưu không đăng nhập, tạo phiếu hoặc tải tệp; bố trí lịch lúc ít người sử dụng. Các dịch vụ trước đó đang chạy được bật lại kể cả khi dump lỗi.
- **Chống trùng:** khóa theo project Compose ngăn hai lệnh sao lưu/khôi phục chạy đồng thời. Trùng tên bản sao trong cùng giây sẽ báo lỗi và giữ bản đã có. Nếu tiến trình bị tắt cưỡng bức, kiểm tra không còn lệnh đang chạy rồi mới gỡ thư mục khóa được nêu trong lỗi.
- **Khôi phục:** kiểm đủ các CSDL theo hồ sơ, role và SeaweedFS; tên CSDL phải khớp `.env`. Kiểm checksum và đọc thử mọi dump/bản nén trước khi dừng hoặc xóa dữ liệu. Lỗi SQL khi khôi phục role phải dừng, không tiếp tục xóa CSDL.

Bản sao chứa toàn bộ dữ liệu người dùng và hash mật khẩu CSDL, nên phải đặt ở nơi chỉ người vận hành đọc được.

Lịch hằng ngày trên VPS Ubuntu (ADR 0010), chạy lúc 02:15 rồi chép sang máy khác:

```sh
crontab -e
15 2 * * * cd /opt/dx-desk && /usr/bin/node scripts/dxdesk.mjs backup >> .local/backups/cron.log 2>&1 && rsync -a --delete .local/backups/ sao-luu@<máy-khác>:/srv/dxdesk-backups/
```

Trên Windows (máy dev), chạy trong PowerShell:

```powershell
schtasks /Create /SC DAILY /ST 02:15 /TN "DX-Desk backup" /TR "cmd /c cd /d D:\duong-dan\dx-desk && node scripts\dxdesk.mjs backup >> .local\backups\cron.log 2>&1"
```

Mỗi tuần, đọc dòng cuối của `backup.log` và thử khôi phục một bản theo mục dưới đây.

### Khôi phục

Lệnh khôi phục **xóa và thay** toàn bộ CSDL cùng tệp đính kèm của project Compose hiện hành:

```sh
node scripts/dxdesk.mjs restore .local/backups/dxdesk-20261128T074943Z --xac-nhan
node scripts/dxdesk.mjs up
# hoặc: make restore BACKUP=.local/backups/dxdesk-20261128T074943Z && make up
```

Các bước lệnh thực hiện:

1. Kiểm tra SHA-256 của mọi tệp theo manifest, và kiểm tra bản chính (major version) PostgreSQL khớp với stack. Tệp hỏng thì dừng, chưa xóa gì.
2. Dừng mọi dịch vụ, chỉ bật lại các container CSDL.
3. Tạo lại vai trò, rồi với từng CSDL: `DROP DATABASE … WITH (FORCE)` và `pg_restore --create --exit-on-error`.
4. Thay nội dung volume SeaweedFS bằng bản nén.
5. Chạy `up` để bật lại các dịch vụ còn lại. `up` không đổi `.env` khi các secret đã có sẵn.

Diễn tập trên môi trường tách biệt, không đụng dữ liệu đang chạy. Dừng stack chính bằng `down` để nhả cổng; lệnh này giữ volume. Sau đó khôi phục vào một project Compose khác:

```sh
node scripts/dxdesk.mjs down
COMPOSE_PROJECT_NAME=dxdesk-restore node scripts/dxdesk.mjs restore <thư-mục> --xac-nhan
COMPOSE_PROJECT_NAME=dxdesk-restore node scripts/dxdesk.mjs up
COMPOSE_PROJECT_NAME=dxdesk-restore node scripts/dxdesk.mjs verify
docker compose -p dxdesk-restore --env-file .env -f infra/compose/docker-compose.yml down -v   # chỉ xóa project diễn tập
node scripts/dxdesk.mjs up
```

Kết quả diễn tập ngày 28/11/2026 (commit `a96cc05` cộng thay đổi W7-01, hồ sơ `full`):

- Bản sao: 3,3 MiB, mất 40–45 giây.
- Khôi phục: 74 giây.
- Đối chiếu với stack gốc: 11 bảng ở 6 CSDL khớp số dòng (68 phiếu, 373 sự kiện, 20 tệp, 57 người dùng Keycloak, 367 bài Mattermost…).
- 3 tệp đính kèm tải qua API có SHA-256 trùng với bản gốc.
- `agent.1` đăng nhập được, `verify` qua 15/15.

## Xử lý sự cố

- **Volume cũ lệch với `.env` hoặc realm hiện hành.** Realm chỉ được import khi tạo mới; volume
  Keycloak từ trước tuần 3 có thể thiếu mapper `api-audience` của `dxdesk-web` (APISIX trả 403
  "required audience claim not present"). Tương tự, volume Mattermost giữ mật khẩu admin/token bot
  cũ nếu `.env` đã sinh lại. Cách sạch nhất trên máy dev: `make reset` (xóa dữ liệu); hoặc sửa tay
  mapper trong Keycloak và đặt lại mật khẩu bằng `mmctl --local user change-password`, rồi xóa
  `MATTERMOST_BOT_TOKEN` trong `.env` để `up` cấp token mới. Riêng mật khẩu của các user demo
  (`agent.1`, `manager.1`…) không cần sửa tay: mỗi lần `up` thử đăng nhập bằng
  `MATTERMOST_DEMO_PASSWORD` và chỉ đặt lại khi bị từ chối.

- `401` sau login: kiểm tra issuer trong token khớp `KEYCLOAK_PUBLIC_URL/realms/dxdesk`,
  audience có `dxdesk-api`, JWKS đã đồng bộ; không in token vào báo cáo.
- `403` khi tạo Critical: chỉ Manager có quyền. Employee/Agent phải chọn mức khác.
- `404` ticket: bản ghi không tồn tại hoặc không thuộc quyền đọc.
- Database chưa sẵn sàng: xem log postgres, kiểm tra migration checksum và role API.
- Keycloak đã có realm cũ: import file mới không tự cập nhật realm đang tồn tại.
- Web thiếu kết nối: xác nhận `node scripts/dxdesk.mjs ps`, URL Keycloak và cổng 9080.
- `make` không có trên Windows: dùng các lệnh Node ở trên.
- npm 11.2 lỗi `edgesOut` khi cập nhật dependency: dùng `npx --yes npm@11 install`
  để chạy bản npm 11 mới tạm thời. `npm ci` từ lockfile đã kiểm thành công trên máy này.
- Windows báo EPERM với thư viện `.node`: dừng Vite/test watcher của dự án trước `npm ci`.

`node scripts/dxdesk.mjs down` dừng và giữ volume.
Mọi cổng được bind localhost cho phát triển. Triển khai Internet, TLS, OTP bắt buộc
và hardening gateway là các mốc sau; không dùng cấu hình dev để công bố trực tiếp.
### Chỉ mục ngữ nghĩa Wiki (W6-01)

Hồ sơ `full` chạy Qdrant và tiến trình `wiki-index` trong mạng Compose. Mô hình AI chạy
ở nhà cung cấp bên thứ ba qua API chuẩn OpenAI-compatible, mặc định Google Gemini
([ADR 0011](adr/0011-mo-hinh-ai-qua-api-ben-thu-ba.md)); không cần tải mô hình về máy.
Chọn `COMPOSE_PROFILES=full` và đặt khóa API trong `.env` (không commit), rồi chạy `make up`:

```sh
AI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_API_KEY=<khóa API Gemini>
ASSISTANT_CHAT_MODEL=gemini-flash-latest
ASSISTANT_EMBED_MODEL=gemini-embedding-001
```

Đổi nhà cung cấp chỉ cần đổi bốn biến trên. Kiểm tra đồng bộ chỉ mục:

```sh
docker compose --env-file .env -f infra/compose/docker-compose.yml logs wiki-index
```

Nội dung sáu bài hỗ trợ được gửi tới nhà cung cấp để nhúng; câu hỏi trợ lý và tiêu đề/mô tả
phiếu (khi gợi ý phân loại) cũng được gửi đi. Chỉ dùng dữ liệu synthetic khi demo.

Tiến trình đọc sáu bài hỗ trợ đã xuất bản qua GraphQL Wiki.js, kiểm tra thay đổi mỗi
60 giây và thay thế đoạn cũ trong Qdrant. Bài bị ẩn hoặc xóa sẽ mất khỏi kết quả tìm kiếm.
`make up` cấp khóa Wiki cho nhóm giới hạn ở sáu đường dẫn này trong hồ sơ `full`.
Wiki.js 2.5 yêu cầu quyền quản lý ở cấp trang để API đọc nội dung nguồn.
Nếu khóa hết hạn, chạy lại `make up`. Qdrant và tiến trình đồng bộ chỉ có địa chỉ nội bộ.

### Cảnh 4 với trợ lý IT (W6-03, W6-04, W6-09)

Màn `/tro-ly` lưu các cuộc trò chuyện riêng của từng tài khoản trong PostgreSQL.
Chọn **Cuộc trò chuyện mới** để bắt đầu ngữ cảnh mới. Danh sách bên trái cho phép
mở lại, đổi tên và xóa hội thoại. Xóa hội thoại sẽ xóa toàn bộ tin nhắn và bộ nhớ
của hội thoại đó. Tải lại trang hoặc đăng nhập lại sẽ khôi phục lịch sử đã lưu.
Trên điện thoại, nút **Mở lịch sử hội thoại** mở danh sách này.

Mỗi lần gửi tiếp, server đọc lịch sử của chính cuộc trò chuyện đang chọn. Khi
lịch sử vượt khoảng 48.000 ký tự, các lượt cũ được tóm tắt vào bộ nhớ của hội thoại,
giữ các lượt gần nhất trong prompt. Lịch sử đầy đủ vẫn có thể tải qua **Tải tin nhắn cũ**.
Nút **Dừng trả lời** giữ phần đã nhận và cho phép gửi tiếp. Một hội thoại xử lý một
lượt tại một thời điểm. Sau sự cố tiến trình, lượt đang dở được mở lại sau lease 5 phút.
Một tin nhắn nhận tối đa 8.000 ký tự. Enter gửi tin và Shift+Enter xuống dòng.

Nghiệm thu tạo/đổi tên/xóa, ngữ cảnh liên tục, tải lại và cách ly giữa tài khoản:

```sh
node tools/testing/assistant-conversations.mjs
```

Trong hồ sơ `full`, khi đã đặt `AI_API_KEY` và chỉ mục Wiki đã sẵn sàng, mở **Trợ lý AI** từ menu Desk. Bật Mattermost và outbox demo để kiểm tra
thông báo task của quản lý.

```sh
npm ci --prefix tools/testing
npx --prefix tools/testing playwright install chromium
node tools/testing/week6-assistant.mjs
```

Bài nghiệm thu tạo phiếu và task trên stack demo. Employee hỏi về VPN, thử hủy
và xác nhận phiếu. Manager đối chiếu số phiếu VPN theo hai khoảng thời gian tương
ứng rồi xác nhận task. Agent mở phiếu mới, sửa đề xuất và kiểm tra lịch sử.
