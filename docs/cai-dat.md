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

## Xử lý sự cố

- **Volume cũ lệch với `.env` hoặc realm hiện hành.** Realm chỉ được import khi tạo mới; volume
  Keycloak từ trước tuần 3 có thể thiếu mapper `api-audience` của `dxdesk-web` (APISIX trả 403
  "required audience claim not present"). Tương tự, volume Mattermost giữ mật khẩu admin/token bot
  cũ nếu `.env` đã sinh lại. Cách sạch nhất trên máy dev: `make reset` (xóa dữ liệu); hoặc sửa tay
  mapper trong Keycloak và đặt lại mật khẩu bằng `mmctl --local user change-password`, rồi xóa
  `MATTERMOST_BOT_TOKEN` trong `.env` để `up` cấp token mới.

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
