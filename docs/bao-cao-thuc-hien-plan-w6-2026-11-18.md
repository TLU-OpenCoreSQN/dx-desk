# Báo cáo thực hiện kế hoạch W6 — 18/11/2026

## 1. Kết luận

Đã kéo mã `origin/main` bằng `pull --ff-only` vào nhánh triển khai **`feature/w6-plan-20261118`**, nền **`27d36a6bc0f3d88288be2018a53e982b003c6e78`**, và thực hiện phần mã có thể triển khai/kiểm chứng an toàn trên máy hiện tại. **Chưa hoàn tất toàn bộ các gate của kế hoạch; chưa đóng issue hay tuyên bố M5 đạt.**

Đã sửa lỗi treo tải cấu hình module; triển khai nguồn cấu hình doanh nghiệp và `config validate/apply`; chuyển workflow sang cấu hình doanh nghiệp có preflight; bổ sung test công cụ AI/RLS và bộ đánh giá TN-05/TN-06; sửa nguy cơ chuyển tiếp mật khẩu quản trị qua HTTP redirect; cập nhật hướng dẫn và notices.

**Chưa commit, push, mở/merge PR, thay ruleset/quyền GitHub, sửa CI workflow, mua VPS, đổi DNS, gửi thư/BTC hoặc chạy vào DB/realm vận hành.** Lượt này không tự ký QĐ-5/QĐ-6 hay thay quyết định trưởng nhóm.

## 2. Bảo toàn mã và công việc cũ

- Checkout ban đầu: `develop-quyennnv@e216b01`, có sửa chưa commit của người dùng tại `docs/ke-hoach-tuan-4.md` và tài liệu kế hoạch mới.
- Đã sao nguyên hai tài liệu vào `C:/Users/Admin/.qoder/projects/D--MaNguonMo/backup-w6-20261118-0147/`.
- Stash duy nhất của lượt này: **`9bbdeb0b77c07bfcf5faa46ee9de07efb1198db1`**, nhãn `qoder-w6-preserve-20261118-0147`, tạo với `-u` và đúng hai đường dẫn tài liệu.
- Đã đối chiếu nội dung W4 trong stash với bản sao, chỉ chuẩn hóa CRLF/LF khi so; nội dung khớp. SHA-256 bản sao W4: `7af474dcb783725062032d7862fe0ff28651ecbade55ca0018fa485a81cd1eb2`.
- Đã đưa bản kế hoạch sang nhánh triển khai; **không apply/pop stash** sang main mới vì tài liệu W4 không có trên main và sẽ gây nhập nhằng lịch sử.
- Không reset/clean/prune, không xóa nhánh cũ, không gộp nguyên nhánh Quyền với 9 hunk xung đột. Nhánh `main` local cũ không bị force-update; nhánh triển khai chứa mã main mới.

Bản sửa W4 vẫn có đầy đủ trong backup/stash để lấy lại có chọn lọc; không tự chạy `stash pop` hay ghi đè tài liệu đang sửa khi chuyển nhánh.

## 3. Kết quả theo kế hoạch và issue

| Hạng mục | Đã thực hiện | Trạng thái thực tế / còn thiếu |
|---|---|---|
| F01 — timeout module | Deadline 5 giây phủ fetch và JSON body, AbortController, fallback cũ, dọn timer; test fake timer và Chromium thật | Mã và kiểm thử local đạt; chưa PR/CI mới/merge |
| #52 — config apply | Schema v1, canonical cau-hinh.json, validate offline, một transaction DB, upsert khóa nghiệp vụ, retry idempotent, projection sau commit, khóa xuyên commit→publish | 41 unit test cấu hình + 8 ca PostgreSQL dùng một lần đạt; form động đã thử browser fixture; còn Compose/gateway end-to-end và review |
| #53 — workflow doanh nghiệp | Di chuyển nguyên 4 workflow JSON sang config/doanh-nghiep/workflows, preflight trước up/reload; import/publish cùng nguồn và giữ ID | Validator/test/mount check đạt; chưa chạy n8n restart thật vì không có Docker |
| #58 — công cụ AI | Bổ sung kiểm tool theo role, chặn tham số lạ, thống kê không lộ A/B, proof gắn owner/args, giữ retry và audit | Bộ tích hợp thật PostgreSQL/PostgREST/API 34/34 đạt; chưa chạy lại qua APISIX/Keycloak thật, chưa đóng checklist |
| #61 — TN-05 | 10 câu lõi tổng quát + 5 mở rộng; 2 flow VPN cố định không cộng điểm model; runner streaming/TTFT, review độc lập và scoring ≥8/10 | 32 test synthetic của runner đạt; chưa có kết quả model thật hoặc QĐ-5 |
| #62 — TN-06 | 20 ticket giả tiếng Việt, nhãn/rubric, runner classification-only, scoring ≥16/20 và review facts/summary, không tự chấm không-bịa | Đã có bộ công cụ/dữ liệu; chưa chạy 20 mẫu trên model thật, chưa độc lập duyệt nhãn, chưa nghiệm thu API/DB toàn luồng |
| #54 — tài nguyên | Runner ghi model digest, SHA/hash, TTFT delta nội dung và mẫu RAM host; phân biệt cold/warm/metadata | Chưa đo container/WSL/OOM hoặc máy demo 16 GB; không lấy RAM host hiện tại làm kết quả máy demo |
| #55 — CSV | Rà nhánh đồng đội `origin/feature/w6-15-import-nhan-vien@2aa9f02`, không viết trùng và không tự nhập nhánh chưa an toàn | Có phát hiện cần chủ nhánh sửa; chưa tích hợp/import 50 người |
| #56 — Internet | Giữ nguyên quyết định/phạm vi trong kế hoạch, không dựng một URL giả hay đổi hạ tầng chưa được cấp | Chờ VPS/DNS/quyền triển khai, public SSO và backup/restore thực |
| #17 — SLA lead | Không tự chọn một Manager làm trưởng nhóm hoặc nới scope thông báo | Chờ mapping team→lead→Mattermost hoặc quyết định đổi yêu cầu; chưa triển khai recipient |
| #64/#65 — email | Giữ đúng gate “chỉ làm sau QĐ-6 = Có” | Chưa có quyết định của đội; chưa triển khai hoặc đóng email thay người dùng |
| F02 — ruleset/review | Hậu kiểm mã độc lập và sửa hai phát hiện trong code mới | Không thay ruleset/CI, không giả approval của PR đã merge |
| F03/F04 — máy sạch/BTC | Giữ các mục chờ bằng chứng; không tick thay thành viên hoặc BTC | Chưa nghiệm thu máy sạch độc lập, chưa có văn bản n8n/BTC mới |
| F05 — tài liệu/Git | README, cài đặt, ADR workflow và notices đúng mã mới; lưu backup/stash | Tài liệu W4 lịch sử chưa nhập trở lại main; không dọn nhánh tùy tiện |
| F06 — nghiệm thu cuối | Đã chạy regression local, DB tách biệt và browser fixture | Chưa đủ full-stack/model/máy sạch/review/CI mới để đóng M5 |

## 4. Thay đổi theo nhóm tệp

### 4.1. Web và cấu hình runtime

- `apps/web/src/modules/config.ts`: deadline 5 giây bao trùm cả header/body; request được hủy và loader luôn thoát loading khi timeout.
- `apps/web/src/test/modules.test.tsx`: thêm 4 ca timeout/header/body/timer và HTTP/JSON lỗi; tổng suite module 18 test.
- `apps/web/nginx.conf`, `infra/compose/docker-compose.yml`: mount thư mục cấu hình **ngoài web root** tại `/etc/dxdesk/enterprise`, chỉ alias chính xác modules.json; không lộ canonical config, workflow hoặc CSV qua static server. Mount thư mục cho phép thấy file mới sau rename projection.
- `tools/testing/browser-smoke.mjs`: giữ Vite server/Chromium và các fixture hiện có; thêm ca header treo, body HTTP 200 chưa kết thúc, bật/tắt device module và trường asset_code từ category runtime.

### 4.2. Cấu hình doanh nghiệp

- Mới: `scripts/enterprise-config.mjs`, `config/schema.json`, `config/doanh-nghiep/cau-hinh.json`.
- `scripts/dxdesk.mjs`: thêm `config validate`/`config apply`, giữ lệnh `config` kiểm Compose như cũ.
- Mới: `tests/enterprise-config.test.mjs`, `tools/testing/enterprise-config.mjs` chạy PostgreSQL dùng một lần với toàn bộ migrations/policies hiện có.
- `tools/testing/check-config.mjs`: schema/projection/workflow check được nối vào lệnh kiểm cấu hình hiện hành; không đổi file workflow CI.
- `tools/testing/package.json`/lockfile: ghim Ajv 8.20.0. Đã đồng bộ API dependencies theo lockfile main để có jsonld/PDFKit đúng phiên bản, không sửa API package manifest.
- `.gitignore`: không đưa lock/tệp projection tạm vào Git.

Apply kiểm toàn bộ trước ghi và trong transaction DB; không xóa mục bị bỏ khỏi JSON, không sửa clock ticket cũ, không đổi migration 001–026. Khóa exclusive filesystem giữ từ trước BEGIN đến xong publish; lệnh cạnh tranh fail trước ghi. Khóa cũ không bị tự đánh cắp/xóa. DB và file không giả atomic: lỗi publish sau commit được báo rõ, retry sửa projection mà không thay row version.

### 4.3. Workflow

- 4 tệp `device-request.json`, `hello.json`, `ticket-events.json`, `ticket-sla.json` được **di chuyển**, nội dung JSON đối chiếu với HEAD khớp hoàn toàn.
- Mới `infra/n8n/validate-workflows.mjs`, `tests/workflows.test.mjs`; cập nhật publisher và mount importer/publisher.
- Preflight JSON/ID/trùng/cấu trúc chạy trước khi dừng n8n; publisher kiểm toàn bộ trước khi publish từng workflow. Không tự xóa workflow đã nạp.
- Git diff chưa stage sẽ hiện D ở đường dẫn cũ và ?? ở đường dẫn mới; đó không phải mất 4 workflow.

### 4.4. AI và bảo mật

- Mới `tools/testing/week6-evaluate.mjs`, `tests/week6-evaluate.test.mjs`, `config/evaluation/assistant-questions.json`, `config/evaluation/ticket-triage.json`.
- Không sửa prompt/logic ứng dụng để làm đẹp điểm. Runner không login, pull model, confirm đề xuất, tạo ticket/task hoặc viết DB; generation phải bật bằng flag tường minh trên môi trường giả được phép.
- Điểm core chỉ tính 10 câu không cố định; 2 flow VPN nằm trong phần mở rộng. 6/10 model đúng + 2/2 flow đúng không thể pass ngưỡng 8/10.
- Review gắn runId/answerHash, reviewer khác operator, chấm privacy/consent/facts/summary tường minh; không dùng keyword matching thay review chất lượng.
- `apps/api/test/integration.mjs`: bổ sung các guard tool/parameter/RLS/proof; không đổi endpoint hay nới quyền API.
- `scripts/setup-directory.mjs`: thêm `redirect: 'error'` để request mang password/token không đi theo HTTP redirect; `tests/setup-directory.test.mjs` xác nhận server đích không nhận credentials khi có 307.

## 5. Bằng chứng kiểm thử đã chạy

| Nhóm | Lệnh | Kết quả |
|---|---|---|
| Root tests, gồm config/evaluate/workflow/setup/seed | `node --test tests/*.test.mjs` | **95/95 PASS**, 0 fail |
| Web unit | `npm run test --prefix apps/web` | **176/176 PASS**, 18 file |
| API unit | `npm run test --prefix apps/api` | **76/76 PASS**, build API thành công |
| Assistant unit hiện có | `node --test apps/assistant/*.test.mjs` | **6/6 PASS** |
| API + PostgreSQL/PostgREST dùng một lần | `npm run integration --prefix tools/testing` | **34/34 PASS**, DB thử riêng đã dừng |
| Cấu hình + PostgreSQL dùng một lần | `node tools/testing/enterprise-config.mjs` | **8/8 PASS**: seed/xmin, field/routing/SLA, rollback, preflight, omission/rename, SQL-data boundary, projection retry, quyền app |
| Browser/Vite | `node tools/testing/browser-smoke.mjs` | **12/12 PASS**, không uncaught page error; desktop/mobile và HTTP/auth fixtures |
| Cấu hình | `node scripts/dxdesk.mjs config validate`; `npm run check --prefix tools/testing` | PASS schema, canonical/projection, workflow/mount và checks cũ |
| Build cuối | `npm run build --prefix apps/web`; `npm run build --prefix apps/api` | PASS |
| License metadata | `python -m reuse lint` | **Chưa chạy được: không có python trên PATH**; không gọi kiểm metadata thủ công là REUSE lint |
| Runtime AI preflight | `node tools/testing/week6-evaluate.mjs --timeout-ms 1000 --output ...` | **Exit 1 / completed:false**, không có Ollama/model/role tokens; không sinh hoặc ghi nghiệp vụ |
| Scope | `git diff --check`; diff các migrations, realm gốc, CI | PASS whitespace; không thay migrations, realm gốc hay CI workflow |

### Tệp bằng chứng local

- `.local/reports/browser.json`: `passed:true`, bắt đầu 09:12:46 ICT, xong 09:13:06 ICT ngày 18/11.
- `.local/reports/web-config-header-timeout.png`, `web-config-body-timeout.png`, `web-module-devices-disabled.png`, `web-enterprise-category.png` và ảnh regression web khác.
- `.local/reports/week6-preflight-20261118.json`: thiếu runtime/model/token, `results:[]`, `evaluationCompleted:false`. RAM host ghi trong report không phải máy demo 16 GB.
- Lượt API tích hợp cuối dùng project DB tách biệt `.local/pg-test-RenwSy`; không dùng DB đang có của người dùng.

Các số PASS ở trên thuộc mã **chưa commit** trong working tree; SHA 27d36a6 là nền, không giả rằng commit đó đã chứa thay đổi mới. CI #170 chỉ là CI của baseline main, **không phải CI cho diff chưa push**.

### Lỗi gặp và đã xử lý trong quá trình kiểm

- Lượt integration đầu thiếu `jsonld` do node_modules còn từ checkout cũ; đã `npm ci --prefix apps/api` theo lockfile main, chạy lại API + integration thành công.
- Lượt browser đầu kiểm link sidebar visible khi mobile menu đang đóng; đã sửa assertion sang mở route thiết bị và kiểm nút biểu mẫu, giữ nguyên app UI; lượt cuối 12/12 PASS.
- Rà độc lập phát hiện projection có thể cũ khi hai apply cạnh tranh và gate AI cộng flow cố định; đã thêm khóa/gate regression và chạy lại đầy đủ test liên quan.

## 6. Rà nhánh CSV của đồng đội

Nhánh `origin/feature/w6-15-import-nhan-vien@2aa9f02` đã có importer, CLI, 50 mẫu và tests; không được viết lại song song. Suite đúng ref có 10 test pass nhưng mock còn thiếu ca thực:

1. Helper token HTTP theo redirect có thể chuyển password ở body sang origin khác; đã sửa helper trên nhánh local này, vẫn cần đối chiếu khi tích hợp nhánh CSV.
2. Importer dùng `team.members` trong khi contract automation_teams của main không trả members, nên không chứng minh được rerun roster zero-write. SQL upsert chống trùng không có nghĩa là no-op.
3. Có cửa sổ tạo user xong nhưng lookup/write file mật khẩu thất bại, để lại tài khoản chưa có thông tin bàn giao; cần thiết kế retry an toàn, không tự reset tài khoản cũ.
4. CSV parser còn chấp nhận header trùng và ký tự ngoài dấu quote đóng; cần reject rõ thay vì lấy cột đầu.

Khuyến nghị chủ nhánh sửa/test rồi review PR; chưa tự copy, cherry-pick hay merge phần chưa an toàn, chưa post comment ra GitHub thay người dùng.

## 7. Những mục chưa thể hoàn tất

1. **Docker/n8n/Nginx/Compose thật:** máy không có Docker. YAML/mount/Node/DB/browser fixture đã kiểm, nhưng không thay n8n reload/restart và nginx alias trên container thật.
2. **Model/TN-05/TN-06/RAM16GB:** preflight thiếu model, service và token; cần môi trường full, cấu hình model, máy demo và reviewer độc lập. Không có điểm 8/10,16/20 hoặc QĐ-5 được xác nhận trong lượt này.
3. **SLA trưởng nhóm #17:** cần danh tính lead theo từng team và mapping Mattermost, hoặc quyết định đổi yêu cầu được đội đồng ý; chưa tự chọn Manager bất kỳ.
4. **CSV #55:** chờ nhánh đồng đội sửa các điểm trên, review/tích hợp rồi chạy 50 người trên realm thử được cấp.
5. **Internet #56:** cần VPS/domain/quyền triển khai và lịch backup/restore được cho phép. Chưa có URL public hoặc bằng chứng restore mới.
6. **Review/ruleset/CI:** cần chủ kho cho phép thay settings/pipeline, reviewer độc lập và yêu cầu push/PR cụ thể. Chưa tạo approval, sửa lịch sử hay bỏ gate.
7. **Máy sạch, n8n/BTC, thông báo bàn giao:** cần thành viên/đơn vị bên ngoài; chưa lưu xác nhận mới hoặc gửi thư.
8. **Email #64/#65:** chờ QĐ-6; không làm trước gate hoặc tự đóng issue.
9. **REUSE lint:** cần môi trường có Python/REUSE hoặc CI được phép chạy để xác nhận thêm.

## 8. Các bước tiếp theo, không tự thực hiện

1. Review diff local và chọn quyền tiếp tục commit/push/PR. Hiện chưa có commit mới để gắn bằng chứng CI.
2. Cấp máy Docker/full và role tokens qua môi trường an toàn, chạy Compose/nginx/workflow, TN-07 end-to-end; sau đó chạy runner với model thật và reviewer, đo container/host đúng scope.
3. Chốt mapping lead và QĐ-6; cấp điều kiện VPS nếu muốn triển khai Internet. Không gửi secret/OTP/recovery codes vào chat.
4. Phối hợp chủ nhánh CSV sửa và tích hợp; không ép một nhánh đang có vấn đề vào main chỉ để tick issue.
5. Hoàn tất review, REUSE lint, máy sạch và BTC; lúc đó mới đối chiếu điều kiện đóng issue/M5 theo kế hoạch.
