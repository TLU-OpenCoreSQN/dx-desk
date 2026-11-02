# Bàn giao kỹ thuật tuần 4 — tự động phân tuyến và hàng đợi hỗ trợ

Ngày cập nhật: 02/11/2026 (ICT). Nhánh làm việc: `develop-secnv`.

Người dùng đã cho phép tiếp tục build theo source hiện có: **“cứ build sao cho phù hợp với prj, source đã có”**. Bản này ghi các quyết định thực thi và bằng chứng kỹ thuật; không ký thay reviewer/BTC hay đóng gate nghiệm thu C23/M3. Phân tích đầy đủ dependency, mâu thuẫn và phạm vi nằm trong [phân tích kế hoạch](phan-tich-ke-hoach-tuan-4-2026-11-02.md).

## Quyết định đã triển khai

| Phần | Hành vi trong source bàn giao |
|---|---|
| Danh tính automation | Client confidential `dxdesk-automation`, client-credentials, audience `dxdesk-api`, realm role `ticket-automation`, DB role `ticket_automation`. Guard/controller riêng; không cấp Employee/Agent/Manager cho bot. PostgREST không được nhận DB role service. |
| Máy trạng thái | Giữ 9 trạng thái/17 cạnh cho người dùng. Service chỉ thực thi các RPC hẹp có kiểm context. VPN `new → triaged → assigned`, giao Network Team; yêu cầu quyền vẫn chờ duyệt. |
| Sự kiện/audit | Envelope version 1, UUID sự kiện, `ticket_version` do DB quản lý; actor hệ thống được ghi rõ, không gán hành động bot cho requester. GET dùng projection tường minh. |
| Outbox/inbox | Ghi event cùng transaction nghiệp vụ. Claim lease 90 giây, fencing token, retry tối đa 8 lần, backoff có jitter và replay thủ công. ACK phải đúng event/ticket/destination và đã durable commit; unresolved không được coi là hoàn thành. Không giữ transaction trong lúc gọi HTTP. |
| Quy tắc thiếu | Không đoán team hoặc bypass duyệt. Unresolved được audit và retry; sửa rule rồi replay bằng CLI khi cần. Event cũ được so với trạng thái/version hiện tại. |
| Team/claim | Ba team chuẩn và roster theo subject Keycloak thật. Agent trong team claim nguyên tử; tranh nhận trả một 200/một 409, cùng Agent retry không nhân đôi audit. Queue lọc/pagination trên server. |
| Phê duyệt | Trang Manager dùng API status hiện có, `expected_version`, quyết định stale trả 409. Từ chối yêu cầu lý do 5–2000 ký tự và audit. Quyền Agent/Manager hiện có được giữ; Employee không vào queue nhân viên. |
| SLA | Ngân sách resolution 24/7 chụp tại thời điểm tạo; trừ thời gian chờ requester. Nhắc tại ≥80%, breach khi >100%, giữ cờ breach qua reopen. `resolved/closed/cancelled` không phát nhắc mới; retry kiểm lại trạng thái và loại nhắc đã lỗi thời. Mỗi loại notice có ledger riêng. `response_minutes` chưa được dùng làm KPI phản hồi đầu tiên. |
| Mattermost | Team Edition 12.0.1 trong cùng mạng Compose, DB/data volume riêng, health bằng `mmctl --local`. Bot gửi UUID/loại sự kiện vào kênh riêng của team; không gửi mô tả, thông tin người yêu cầu, tệp hoặc signed URL. |
| Giới hạn chat | Giao dịch nghiệp vụ có idempotency trong DB. Chat là at-least-once: retry dò 200 bài gần nhất theo event ID để giảm trùng khi POST trước đó không rõ kết quả. Không cam kết exactly-once xuyên DB/Mattermost. |
| n8n | Workflow export không chứa secret, webhook có khóa nội bộ; token service lấy bằng client-credentials. Publisher gọi từng workflow ID, tương thích CLI n8n 2.44.4. Không lưu execution data thành công/thất bại của các workflow nghiệp vụ. |
| Profile | `demo-light`: toàn bộ đường M3, gồm Mattermost. `full`: cùng đường M3 và bật thêm Ollama, không tự tải model. Không gọi full là đo tải AI hoặc tích hợp Wiki.js/Metabase. Các PoC TN-04 vẫn có Compose/CI riêng. |

Migration mới: `008_events_outbox.sql` (actor/version/outbox), `009_teams_routing_claim.sql` (team/route/claim), `010_sla_notices.sql` (SLA/ledger), `011_claim_agent_scope.sql` (claim cần role Agent kể cả khi Manager-only đã thuộc team). Các file 001…007 được giữ nguyên. Migration 011 siết DB/UI và có ca API/SQL độc lập; không sửa checksum 009 đã áp dụng.

## Đối chiếu 17 đầu việc W4

`REVIEW kỹ thuật` nghĩa là đã có source và kiểm thử, vẫn chờ người nghiệm thu theo DoD gốc. Không đồng nghĩa DONE gate.

| Mã | Phần bàn giao | Trạng thái/phần còn lại |
|---|---|---|
| W4-00 | Contract API/OpenAPI, quyết định actor/team/approval/SLA, phân công 3 agent | REVIEW kỹ thuật; chữ ký thành viên còn mở. Hồ sơ draft cũ giữ làm lịch sử, contract bàn giao theo báo cáo này. |
| W4-01A | Outbox/inbox, audit hệ thống, version | REVIEW kỹ thuật; native integration kiểm atomicity/quyền/replay. |
| W4-01B | Dispatcher, lease/fencing, retry/replay | REVIEW kỹ thuật; unit HTTP và phục hồi n8n thật. |
| W4-02A | Service guard/controller và callback | REVIEW kỹ thuật; tách token người/service, không mở quyền REST. |
| W4-02B | Auto-route VPN và thông báo | REVIEW kỹ thuật; Keycloak → APISIX → API/DB → n8n → Mattermost thật. |
| W4-02C | Teams/roster/queues/claim | REVIEW kỹ thuật; tranh nhận đồng thời qua hai JWT Agent thật. |
| W4-03A | SLA evaluator/cờ/ledger | REVIEW kỹ thuật; clock biên, pause/reopen/catch-up trong native integration. |
| W4-03B | Scheduler và nhắc/escalation | REVIEW kỹ thuật; scheduler n8n + evaluator dự phòng ở worker, real-clock acceptance bằng policy demo ngắn. |
| W4-04 | Mattermost/kênh/bot/persistence | REVIEW kỹ thuật; local accounts cho demo, không tuyên bố SSO enterprise. Xác nhận license/BTC nếu đề án yêu cầu vẫn mở. |
| W4-05 | Bảng việc Agent, nhận và xử lý | REVIEW kỹ thuật; unit + browser thật. |
| W4-06 | Queue Manager phê duyệt | REVIEW kỹ thuật; unit + browser thật, stale/reason qua API thật. |
| W4-07 | Generator ≥500 phiếu giả lập, seed/manifest/identity map | REVIEW kỹ thuật; deterministic, dry-run mặc định, apply transaction ở DB demo/test có xác nhận; không bơm 500 phiếu vào DB vận hành hiện tại. |
| W4-08A | Ma trận auth/race/retry/clock/failure | REVIEW kỹ thuật; API unit, PostgreSQL/PostgREST và stack tests. |
| W4-08B | Browser/CI/lệnh thống nhất | REVIEW kỹ thuật; giữ hồi quy W3 trước khi bật automation, rồi chạy M3. Kết quả CI phải đối chiếu SHA PR. |
| W4-09A | Compose full/demo-light và startup lặp lại | REVIEW kỹ thuật; bootstrap local idempotent, secret chỉ ở `.env` ignored; config cả hai profile. |
| W4-09B | Sampler toàn project + host/WSL | Có công cụ và số đo local; **chưa nghiệm thu máy demo 16 GB, full/model peak và tải mục tiêu**. |
| W4-GATE | Demo M3/review/report/release | **Còn mở**: reviewer con người, bằng chứng ngoài repo, máy mục tiêu, CI đúng SHA và quyết định release. |

## Chạy và kiểm tra

```powershell
Copy-Item .env.example .env # chỉ khi chưa có .env
node scripts/dxdesk.mjs up
node tools/testing/week4-stack.mjs
node tools/testing/week4-browser.mjs
```

Web `http://localhost:9080`; Keycloak mặc định `http://localhost:8080`. Stack local review dùng Keycloak cổng 28080 theo `.env` riêng. Tài khoản demo `employee.a`, `employee.b`, `agent.1`, `agent.2`, `manager.1`, mật khẩu mặc định `DxDesk@2026`. Agent xem `/work-queue`, Manager xem `/approvals`.

Mattermost `http://localhost:18065`, tài khoản demo `agent.1`, `agent.2`, `manager.1`; mật khẩu được sinh trong `.env` dưới khóa `MATTERMOST_DEMO_PASSWORD`, khác mật khẩu Keycloak. Bot/token/admin secret không được đưa vào Git. Roster demo cho cả ba nhân viên vào ba team để kiểm thử; triển khai dùng chung phải cấu hình membership thực tế. Bootstrap tự động chỉ hỗ trợ Keycloak localhost; không tự sửa realm dùng chung.

`week4-stack.mjs` ngắt/khởi động lại n8n của project đang chọn và tạm đặt policy normal 1 phút để tạo một phiếu giả lập, khôi phục policy ngay sau khi tạo. Chạy trên project demo cô lập, không chạy đồng thời với bài kiểm thử khác dùng cùng stack. Phiếu giữ deadline snapshot để đo bằng đồng hồ thật; không backdate hay sửa deadline trực tiếp.

```sh
# Theo dõi hàng đợi; replay một event failed sau khi sửa nguyên nhân
node scripts/replay-outbox.mjs status
node scripts/replay-outbox.mjs <event-uuid>

# Mẫu đo đang chạy; không khởi động dịch vụ/model thay operator
node scripts/benchmark-stack.mjs --profile=demo-light --project=dxdesk-sec-review --duration=30 --interval=1000

# Dữ liệu: dry-run mặc định; file identity map phải dùng subject thật
node scripts/seed-synthetic.mjs --help
node --test tests/seed-synthetic.test.mjs
```

`AUTOMATION_ENABLED=false` dùng cho baseline W3 trên stack mới: không chạy dispatcher/bootstrap W4 và chỉ publish workflow hello. Đổi thành true rồi chạy lại `up` để nạp tích hợp M3. `.env`, log, screenshot và manifest sinh tại `.local/` không được commit. Không xóa volume để vượt lỗi migration.

## Bằng chứng và giới hạn

Báo cáo máy sinh ở `.local/reports/`: `integration.json`, `week4-stack.json`, `week4-browser.json`, ảnh queue/detail, log unit và CSV/JSON `stack-memory-*`. CI đính kèm report qua artifacts; kết luận nghiệm thu luôn dùng run đúng SHA PR, không suy từ badge nhánh khác.

- API unit: 61/61; web unit: 108/108; seed/sampler: 8/8 ở lượt local 02/11.
- PostgreSQL/PostgREST native: 25/25 nhóm, gồm permission, atomic route/claim, retry/quarantine, SLA biên/reopen và stale notices. JWT của native suite là fixture ký RSA; real Keycloak có bộ stack/browser riêng.
- Stack thật: 8/8 nhóm auth/chat/claim/approval/recovery/queue và real-clock SLA đạt. VPN giao Network Team trong 2.213 giây ở lượt đầu. Browser thật 5/5 nhóm đạt, gồm từ chối có audit và queue ở 375 px/landscape; các lượt VPN có ảnh đều dưới 60 giây. Sửa lỗi harness reload/khẳng định trước khi dữ liệu và navigation hoàn tất; sửa worker để n8n 404 lúc activation vẫn retry. CI kiểm lại trên SHA bàn giao.
- Sampler local ghi toàn bộ container của `dxdesk-sec-review`, host và cấu hình WSL; không dùng làm bằng chứng máy mục tiêu 16 GB hay tải model/full. Peak giữa hai mẫu có thể bị bỏ lỡ.
- Migration runner/checksum/upgrade chạy trên Linux CI có `psql`; máy Windows hiện tại không có `psql` native nên không ghi PASS local cho nhóm này.
- Hồi quy W3 local: stack 16 nhóm; browser thật 5 nhóm PKCE/TOTP (đúng/sai/cũ), VPN ảnh, signed bytes, EICAR và workflow; startup lặp lại giữ ticket/tệp đạt. Assertion audit giữ 1 created + 5 status và kiểm thêm đúng 1 assignment event của W4, không cho lời gọi bị chặn sinh event thừa.
- CI phát hiện readiness probe Wiki.js thoát Node 13 ngay lúc cold start (unsettled top-level await). Bổ sung handle giữ loop sống trong thời gian chờ có giới hạn và đóng body probe; PoC local cô lập đã đạt 2 nhóm init/login/strategy sau sửa. Không đổi tiêu chí nghiệp vụ để bỏ qua lỗi.

Mẫu tài nguyên local (10 giây, 4 mẫu, `demo-light`, không model): host có 16.78 GB vật lý,
Docker engine cap 8.13 GB; tổng container cao nhất 3.56 GB, host used cao nhất 15.33 GB
(đơn vị GB thập phân, gồm cả các ứng dụng khác trên Windows). Không cộng hai số này.
Host đã vượt mốc tham chiếu 14 GB nên chưa kết luận đủ headroom cho demo: cần đo máy sạch,
cùng dataset/kịch bản và full/model peak, thử fallback được chủ demo chốt rồi review.
Số đo này ghi đúng giới hạn thay vì coi cap hoặc idle là nghiệm thu 16 GB.

C23 chưa đóng đủ: DOCX gốc/xác nhận BTC n8n, reviewer con người, máy demo 16 GB và quyết định release vẫn cần chủ dự án hoàn tất. Source và PR là bàn giao kỹ thuật, chưa phải release cuối.
