# Kế hoạch thực thi: đóng tuần 2–3 lên 100%, sau đó triển khai tuần 4

**Lập/cập nhật:** 02/11/2026 (ICT). **Đề án:** DX-Desk, TLU-OpenCoreSQN.
**Trạng thái:** giai đoạn A chưa đóng đủ evidence. Kỹ thuật W4 đã triển khai và kiểm thử theo chỉ đạo mới của người dùng (ngoại lệ ở mục 0/A.9). Xem [bàn giao 17 đầu việc](hoan-thien-tuan-4.md). Nghiệm thu C23/M3, chữ ký và bằng chứng bên ngoài vẫn mở.
**Bắt đầu nhận việc:** [C23-01 — khóa snapshot và phạm vi release](#c23-01).  
**Đọc trước nếu bạn quay lại sau 02/11:** [phân tích và phân công lượt tiếp theo](phan-tich-ke-hoach-tuan-4-2026-11-02.md). [A.8 Nhật ký chạy bằng chứng 02/11](#a-8) ghi lượt trước trên `72f72d7`/`7e27ec3`; bản sửa harness sau đó đã được commit tại `cbd9c52`, tài liệu tại `c493b34`/`c683d2e`, và đã tích hợp vào `develop-secnv` ở `ed1f1b5`. CI, review và nghiệm thu vẫn phải đối chiếu SHA bàn giao mới; không dùng trạng thái lịch sử làm kết luận hiện tại.
**Nguồn:** DOCX `DX-Desk_Ke-hoach-trien-khai_OLP-PMNM-2026_ban-1.1.docx`, mục 3.1, 4.3–4.5, 5.1–5.3, 6, 9–11; [kế hoạch W2](ke-hoach-tuan-2.md), [W3](ke-hoach-tuan-3.md), [hoàn thiện W3](hoan-thien-tuan-3.md), [release checklist](phat-hanh-tuan-2.md).

## 0. Cách sử dụng và thứ tự bắt buộc

**Ngoại lệ thực thi được người dùng cho phép ở lượt tiếp theo ngày 02/11:** sau khi được nêu các gate bên ngoài, người dùng trả lời **"cứ build sao cho phù hợp với prj, source đã có"**. Lead được tiếp tục triển khai và kiểm thử kỹ thuật W4 theo source và các mặc định kỹ thuật nhất quán đã ghi trong hồ sơ thực thi; không phải chờ BTC/máy demo/chữ ký để viết code. Quyền mới này thay thế điều cấm triển khai W4 trước C23-11 trong các mục bên dưới **chỉ về việc thực thi kỹ thuật**. Dependency kỹ thuật giữa producer/consumer, bảo mật và kiểm thử vẫn bắt buộc. Nó không đóng C23-11/W4-00/W4-GATE, không ký thay đội, không tạo bằng chứng BTC/máy sạch/16 GB và không cho phép công bố 100%.

Các quy tắc dưới đây giữ tiêu chuẩn đóng đủ tuần 2–3/M3 và lịch sử gate gốc. Khi triển khai theo ngoại lệ, ghi rõ `DOING/REVIEW kỹ thuật — gate nghiệm thu còn mở`; không tự đổi checkbox tổng thành DONE.

1. **Làm giai đoạn A trước:** 12 ticket C23 để đóng nợ tuần 2–3 (11 ticket lập ngày 02/11 cộng C23-12 phát hiện khi chạy bằng chứng).
2. **Gate A:** C23-11 chỉ DONE khi C23-01…10 và C23-12 đủ bằng chứng. Lead và reviewer xác nhận ngày, SHA, CI, máy demo, quyết định BTC và release/report.
3. **Chỉ sau gate A mới làm giai đoạn B:** 17 ticket W4 ánh xạ đầy đủ W4-01…09 gốc. Không viết code/contract/test W4 song song khi nợ A chưa đóng.
4. Nếu thiếu môi trường, phản hồi hoặc quyền: ghi BLOCKED và làm các ticket C23 độc lập còn lại. Không tick thay, không tự giảm scope, không tự bỏ qua thứ tự.
5. Ngày 07/11 demo và 08/11 chốt M3 là mốc kế hoạch gốc, **không phải lời hứa sẽ giữ được khi A bị chặn**. Nếu A đóng muộn, lead lập lại lịch B và báo ảnh hưởng; không tăng tốc bằng cách bỏ test/review.
6. Mỗi ticket có checklist và hướng làm bên dưới; trước khi giao agent phải điền owner thực nhận, file được ghi, dependency DONE và reviewer. Đây là board Markdown local, chưa phải GitHub Issues đã được tạo.

| Giai đoạn | Tổng ticket | DONE tại lúc lập | Trạng thái | Điều kiện mở bước sau |
|---|---:|---:|---|---|
| [A — Đóng nợ W2–W3](#phase-a) | 12 | 0 | Kế hoạch sẵn sàng nhận việc; C23-02 đã có 5/7 bằng chứng, C23-12 đang DOING; vài ticket chờ người/máy | C23-11 DONE |
| [B — Triển khai W4/M3](#phase-b) | 17 | 0 | REVIEW kỹ thuật theo ngoại lệ; gate nghiệm thu còn mở | W4-GATE DONE |

Các số 0/12 và 0/17 là **gate mới chưa đóng**, không phủ nhận code/bằng chứng đã có. Không dùng tổng 29 ticket để đo % toàn đề án.

<a id="phase-a"></a>

## A. Đóng nợ tuần 2–3

### A.1. Ý nghĩa của 100%

- **100% kỹ thuật M2**: đủ các ca SSO/OTP, VPN kèm ảnh và audit, Critical→403, EICAR, tải tệp ký, RLS/máy trạng thái và quyết định QĐ-2/QĐ-3, có bằng chứng đúng SHA.
- **100% đóng tuần 2–3**: kỹ thuật ở trên **và** review độc lập, máy sạch, TN-01/02/03/04/05 theo phạm vi tuần, xác nhận BTC, bảng việc, phát hành M1 và báo cáo. Không dùng CI để ký thay người review hoặc số đo máy demo.
- Không thực hiện lại toàn bộ tính năng đã có chỉ để tạo ticket. Việc đã có bằng chứng lịch sử chỉ cần xác minh lại trên snapshot bàn giao; không gọi PoC là tích hợp hoàn chỉnh.
- Không gộp các checkbox lặp trong nhật ký 21/10, 26/10, 31/10 thành nhiều đầu việc. Backlog này là nơi theo dõi **nợ hiện hành**; nhật ký cũ giữ nguyên.
- Nếu thiếu máy 16 GB, trả lời BTC hoặc review thì giữ trạng thái `BLOCKED`, không đổi định nghĩa 100% để làm đẹp tiến độ.

### A.2. Baseline và bằng chứng đã có

| Nội dung | Kết quả đã đối chiếu | Hệ quả khi lập kế hoạch |
|---|---|---|
| Checkout làm việc | `develop-quyennnv`, tip `75f0103` sau 5 commit ngày 02/11 (`cbd9c52`, `c493b34`, `c683d2e`, `6e9b8a8`, `75f0103`); gốc là `72f72d7` | Không dùng nhánh `main` cục bộ cũ làm snapshot; C23-01 cần ghi full SHA của phương án chọn |
| Remote main ngày 02/11 | `7e27ec3b27dbb16a08de775940d285df667e2ef9` | Hơn checkout một commit về quy ước nhánh/CI/tài liệu; chưa tự đồng bộ trong lượt lập kế hoạch |
| CI lịch sử | Run #42, ID `41160760838`, SHA `d2ee443`: tài liệu ghi 12/12 job xanh | Không gán kết quả này cho SHA hiện tại; xem [M2 ngày 31/10](ke-hoach-tuan-3.md#trạng-thái-tiêu-chí-m2-31102026-ci-run-42-trên-d2ee443) |
| **CI đối chiếu 02/11 (API Actions)** | Run #49 `b243b31` **FAILURE**; run #50/#51 `72f72d7` **FAILURE**; run #52 ID `41321384189` trên `7e27ec3` **FAILURE 1/12 job** — 11 job xanh gồm `stack` (Keycloak/APISIX/DB/n8n/Mattermost/ClamAV/SeaweedFS thật) và `tn04-runtime` 3 bản; job đỏ duy nhất là `giao diện desktop và mobile (fixture)`, log dừng tại `browser-smoke.mjs:114` chờ text `Thông tin bắt buộc theo danh mục` trong khi UI redesign đổi thành `Thông tin bổ sung theo danh mục` (`apps/web/src/pages/CreateTicketPage.tsx:422`) | **`main` đang ĐỎ** và nguyên nhân là harness chưa theo kịp UI, không phải lỗi stack. 23 dòng PASS của job `stack` trong run #52 là bằng chứng stack thật được C23-02 dùng; bản sửa harness đã push (`c683d2e`) và được CI **#53 xác nhận 12/12 xanh**, trong đó có job fixture; `origin/main` vẫn đỏ cho tới khi merge. |
| Run mới nhất xanh | **#55 ID từ API Actions trên `75f0103` = tip `develop-quyennnv`, success 12/12 job** (kể cả job fixture và job stack); trước đó #53 trên `c683d2e` cũng 12/12. Mốc xanh cũ trên main là #47/#48 (`488fa07`) | **Ứng viên snapshot cho C23-01: `75f0103`** vì là tip xanh CI, chứa fix harness + docs đối chiếu + plan + hồ sơ. `origin/main` (`7e27ec3`) **vẫn đỏ job fixture** vì chưa merge; mọi bằng chứng "CI xanh" phải dẫn `c683d2e`/`75f0103`, không dẫn main |
| Khảo sát tại máy | Chạy lại 02/11 trên `72f72d7` (không Docker): API **44/44**, web **81/81 (10 file)**, `check-config` PASS, `run-integration` **19/19** (PG 17.10 + PostgREST 16.4 nhúng), `migration-test` **5/5 PASS** (dùng psql portable trong `.local/bin`), `browser-smoke` **7/7 PASS sau sửa harness**, `npm audit` 0 lỗ hổng. Vẫn cần Docker/CI: `gateway-test`, `docker compose config`, `reuse lint`, `stack-test`, `stack-browser`, `tn04-runtime` | Đây là bằng chứng native/fixture tại máy, **không thay** nghiệm thu stack thật; nghiệm thu stack thật hiện có trên run #52 (`7e27ec3`) |
| Release | `git ls-remote --tags origin` không trả tag khi đối chiếu 02/11 | Chưa có căn cứ đóng tag/release; phải kiểm tra lại trước khi tạo để tránh trùng |
| Tệp, gateway, OTP | Có code và bằng chứng lịch sử ClamAV/SeaweedFS thật, browser OTP, URL HMAC, JWT gateway | Không tạo lại upload/JWT/OTP như tính năng còn thiếu |
| TN-04 | Wiki.js/Mattermost TE/Metabase OSS chạy PoC riêng | SSO Wiki/nhóm/quyền, bot ticket và báo cáo sản phẩm không được coi là hoàn tất; tích hợp thuộc mốc sau |
| **Thiếu: văn bản gốc của đề án** | `DX-Desk_Ke-hoach-trien-khai_OLP-PMNM-2026_ban-1.1.docx` **không có trong repo**: `find -iname *.docx` = 0 kết quả và `git log --all --diff-filter=A -- *.docx` rỗng, nên cũng không bị `.gitignore` chặn | Kế hoạch này và W3 nhiều lần yêu cầu "đọc DOCX mục 5.3/6". **Người khácclone sẽ không đối chiếu được yêu cầu gốc.** Phải một trong hai: commit DOCX (hoặc trích bảng yêu cầu 5.3/6/QĐ-1…7 vào một file được track như `docs/de-an-goc.md`), hoặc ghi rõ ai đang giữ file và nơi cất. Đây là gate của C23-01, không phải việc phụ |
| **Plan này chưa được commit** | `git status` ngày 02/11: `?? docs/ke-hoach-tuan-4.md` | Prompt giao việc bắt agent mở `docs/ke-hoach-tuan-4.md`; khi file còn untracked thì worktree/nhánh khác không thấy backlog. Phải commit tài liệu (được ủy quyền) trước khi giao ticket |

**Các tệp phải đọc trước khi nhận ticket:** [README](../README.md), [CONTRIBUTING trên main](../CONTRIBUTING.md), [hoàn thiện tuần 3](hoan-thien-tuan-3.md), [bản sửa sau review](sec-dev-fixes.md), [báo cáo tuần 2](bao-cao-kiem-thu-tuan-2.md), [cài đặt](cai-dat.md), [dữ liệu](du-lieu.md), [contract](api/contract.md), [OpenAPI](api/openapi.yaml), [ADR](adr/README.md), và DOCX gốc. `CONTRIBUTING.md` tại checkout cũ cần được đối chiếu với `origin/main`.

### A.3. Quy tắc ticket và điều phối nhiều agent

**Trạng thái:** `TODO → READY → DOING → REVIEW → VERIFY → DONE`; dùng `BLOCKED` kèm lý do, người cần trả lời và ngày kiểm tra lại. Chỉ `DONE` có ô tổng `[x]`.

**Owner là đề xuất theo đề án**, không phải cam kết rằng thành viên đã nhận: Nguyên = TV1, Quyền = TV2, Séc = TV3. Agent hỗ trợ thực thi; con người vẫn chịu trách nhiệm review, môi trường, xác nhận bên ngoài và release.

| Nhóm agent | Vùng việc | Không được tự làm |
|---|---|---|
| `A-LEAD` | Khóa snapshot, điều phối phụ thuộc, tổng hợp quyết định | Tự ký review hoặc bỏ qua gate |
| `A-QA` | Test, tái lập máy sạch, đối chiếu artifact | Gọi fixture là stack thật |
| `A-SEC` | RLS, JWT, upload, quyền, dependency/license review | Tự nới quyền hoặc sửa migration đã áp |
| `A-ENV` | Máy Docker/demo, đo tài nguyên, profile | Tự cài WSL/restart máy hoặc xóa volume |
| `A-DOC` | ADR, contract, đối chiếu checklist, báo cáo | Tự tick theo báo cáo miệng |

- Một ticket chỉ có **một writer**; reviewer độc lập không sửa cùng file lúc writer đang làm. Dùng worktree/nhánh riêng khi cần; không xóa/stash/reset công việc của người khác.
- Nếu phát hiện conflict, dừng tại file đó, báo lead; giữ cả nghiệp vụ mới và giao diện hiện hành. Không chọn toàn bộ ours/theirs để đi tắt.
- Owner của migration, Compose/realm, CI, API contract phải được lead khóa theo lượt. Các agent khác gửi patch/đề nghị, không cùng ghi một file.
- Không công bố ticket/Project/Issue, gửi Telegram, báo thầy, push, merge, tag hoặc release chỉ vì nó xuất hiện trong kế hoạch. Xin ủy quyền đúng hành động ở lượt thực hiện; kế hoạch này chỉ tạo backlog trong repo.
- Ticket `BLOCKED` phải có bước tiếp theo cụ thể; vẫn được làm ticket C23 độc lập khác. Theo yêu cầu mới: chặn toàn bộ triển khai W4 cho đến khi C23-11 DONE; chỉ làm các ticket C23 độc lập khác trong lúc chờ.

### A.4. Bảng điều phối đóng nợ

Ô tổng đang trống vì các **gate đóng nợ mới** chưa nghiệm thu; không phủ nhận các tính năng đã đạt ở baseline.

| Hoàn tất | Ticket | Ưu tiên | Owner / agent | Phụ thuộc | Trạng thái ban đầu | Kết quả bàn giao |
|---|---|---|---|---|---|---|
| [ ] | [C23-01](#c23-01) Snapshot và phạm vi release | P0 | Nguyên + lead / A-LEAD | — | READY | SHA, phạm vi, reviewer, lựa chọn release |
| [ ] | [C23-02](#c23-02) Kiểm thử đúng snapshot | P0 | Nguyên, Quyền hỗ trợ / A-QA | C23-01 | TODO | CI và artifact đúng SHA |
| [ ] | [C23-03](#c23-03) Máy sạch và demo độc lập | P0 | Nguyên điều phối, người khác cài / A-QA | C23-01, C23-02 | TODO | Biên bản cài/demo M1–M2 |
| [ ] | [C23-04](#c23-04) Review kỹ thuật chéo | P0 | Quyền/Séc/Nguyên review chéo / A-SEC | C23-01 | TODO | Hai review, findings và kết luận |
| [ ] | [C23-05](#c23-05) Chốt TN-01…04 và tài liệu | P1 | Séc/Quyền/Nguyên theo ADR / A-DOC | C23-02, C23-04 | TODO | Quyết định được xác nhận, trạng thái hiện hành |
| [ ] | [C23-06](#c23-06) TN-05 trên máy demo 16 GB | P0 | Séc chính, Nguyên môi trường / A-ENV | C23-01; có máy/model | BLOCKED: cần xác nhận môi trường | JSON/CSV và phân tích thật |
| [ ] | [C23-07](#c23-07) Xác nhận BTC và QĐ-4 | P0 | Nguyên gửi, Quyền ghi QĐ-4 / A-DOC | Phản hồi con người/BTC | BLOCKED: chưa có bằng chứng trả lời | Hạn/kênh/hồ sơ và n8n/fallback |
| [ ] | [C23-08](#c23-08) Bảng việc và milestone | P1 | Nguyên / A-LEAD | C23-01; quyền thao tác | TODO | Issue/Project hoặc board local có mapping theo phạm vi đã chốt ở C23-01 |
| [ ] | [C23-09](#c23-09) Snapshot phát hành an toàn | P0 | Nguyên, cả đội nghiệm thu / A-QA + A-SEC | C23-02…08, C23-12 | TODO | Checklist release, gói/hash, phê duyệt |
| [ ] | [C23-10](#c23-10) Tag/Release và báo cáo M1–M2 | P0 | Nguyên / A-DOC | C23-09; quyền xuất bản/gửi | TODO | Release URL, gói và báo cáo thật |
| [ ] | [C23-11](#c23-11) Chốt 100% và bàn giao W4 | P0 | Cả đội / A-LEAD | C23-01…10 | TODO | Biên bản đóng tuần có bằng chứng |
| [ ] | [C23-12](#c23-12) Harness browser lệch UI đã merge | P0 | Nguyên / A-QA | Snapshot C23-01; lỗi phát hiện trong khi chạy C23-02, không chờ C23-02 DONE | REVIEW: sửa đã commit tại `cbd9c52`; chờ evidence CI đúng SHA bàn giao | Job fixture xanh trên snapshot; PR vào `main` vẫn cần review/CI |

<a id="c23-01"></a>

#### C23-01 — Khóa snapshot và chọn cách phát hành

**Owner:** Nguyên; reviewer: Quyền. **Vùng:** quyết định bàn giao/biên bản, không sửa code để tạo snapshot giả.

**Hướng làm:**
1. Đọc Git từ remote; ghi full SHA của nhánh ứng viên, base `main`, diff, trạng thái working tree và mọi merge đang dở. Không dùng `main` local ở `9bb1fb9` như baseline hiện hành.
2. Kiểm tra phần giao diện/theme đã tích hợp với attachments/OTP, không còn marker conflict; đối chiếu migration 001…007 và policies đã được ledger kiểm checksum.
3. Chọn **một** hướng release bằng quyết định đội: (A) snapshot tuần 2 lịch sử, nghiệm thu đúng SHA lịch sử và ghi ngày phát hành thực tế; hoặc (B) phát hành muộn snapshot hiện hành gồm W3/UI, sửa release notes và thống nhất version/phạm vi trước. Không gắn tag lên code W3 rồi mô tả là code W2 thuần.
4. Chốt người review/demo, máy demo, danh sách gate và giới hạn đã biết. Nếu code đổi sau review/test, quay lại C23-02/04 cho SHA mới. Tài liệu hoàn thiện ở C23-05 có thể tạo commit mới: trước C23-09 phải chốt lại SHA cuối và CI tương ứng; không gán run của cha cho commit con. Sửa chỉ-docs có thể tái sử dụng biên bản demo sau khi reviewer xác nhận không đổi executable/schema/config, nhưng phải ghi rõ quan hệ SHA và giới hạn bằng chứng.

**Checklist:**
- [ ] Ghi SHA đầy đủ, base, owner và các file thay đổi.
- [ ] Đội duyệt hướng release/version và phạm vi; không đổi ngày lịch sử.
- [ ] Xác định reviewer, người demo và môi trường; khóa danh sách gate.

**Bằng chứng:** biên bản quyết định + link diff/commit; chưa có thì chưa đóng.

<a id="c23-02"></a>

#### C23-02 — Chạy bộ nghiệm thu đúng SHA

**Owner:** Nguyên; Quyền kiểm lỗi nghiệp vụ. **Đọc:** [CI](../.github/workflows/ci.yml), [stack harness](../scripts/stack-test.mjs), [browser stack](../tools/testing/stack-browser.mjs), [integration runner](../tools/testing/run-integration.mjs).

**Hướng làm:** trên snapshot C23-01, build/test cả API và web; integration PostgreSQL/PostgREST; migration bootstrap/nâng cấp/checksum/rollback; REUSE, audit dependency, YAML/Compose, gateway container; browser fixture; sau đó stack/browser thật. Dùng các lệnh ở mục 6, không báo trước số test giả định. CI hiện có 12 job mở rộng matrix; ghi từng job, không chỉ badge. Nếu lượt chạy phát hiện bug như C23-12, giao sửa ngay trên snapshot ứng viên, rồi chạy lại ca ảnh hưởng và CI; không đòi C23-02 DONE trước khi được sửa chính lỗi đang chặn C23-02.

**Checklist:**
- [x] API/web build và unit test không lỗi; lưu số test thực tế. *(CI run #52 job `build và test ứng dụng (api)` và `(web)` xanh trên `7e27ec3`; máy này trên `72f72d7`: apps/api **44/44 pass**, apps/web **81/81 pass, 10 file**, build sạch.)*
- [x] Integration/RLS/máy trạng thái và migration test đạt, không sửa SQL đã áp. *(CI #52 job `TN-02 RLS + máy trạng thái (PostgreSQL/PostgREST)` xanh; **tại máy này cũng đạt trực tiếp**: `run-integration.mjs` **19/19 pass** với PostgreSQL 17.10 + PostgREST 16.4 nhúng, và `migration-test.mjs` **5/5 PASS** — "First run applies all 9 SQL files", "Second run preserves data and migration timestamps", "Changed applied migration is rejected", "Failed migration rolls back both DDL and ledger, rerun recovers", "Week-2 upgrade preserves historical rows and applies restricted SLA privileges" (02/11/2026 ~02:05 ICT). **Bổ sung vận hành quan trọng:** script đòi `psql` trên PATH; bundle `@embedded-postgres/windows-x64` không kèm, nhưng repo đã có psql portable → chạy `PATH="/d/MaNguonMo/.local/bin/psql-17.10/pgsql/bin:$PATH" node tools/testing/migration-test.mjs`. `git status` xác nhận không có thay đổi trong `db/migrations`, `db/policies`.)*
- [x] REUSE, audit mức High, config, Compose/OTP overlay, gateway JWT/rate/body checks đạt. *(CI #52: `reuse lint`, `docker compose config`, `kiểm tra apisix.yaml` (chứa `gateway-test.mjs`) đều xanh; máy này `check-config.mjs` PASS và `npm.cmd audit --omit=dev --audit-level=high` = **0 lỗ hổng** cho cả api và web.)*
- [x] Stack thật: SSO+OTP, VPN kèm ảnh, audit, Employee Critical→403, EICAR chặn và không lưu file sạch giả, tải bytes đúng bằng URL ký; link sai/hết hạn bị chặn. *(CI #52 job `nghiệm thu stack và browser OTP tuần 3` xanh với 23 dòng PASS, gồm `PKCE browser enrollment requires TOTP...`, `Real ClamAV scan and SeaweedFS upload`, `Critical restricted to Manager`, `browser blocks EICAR without losing the existing ticket`, `browser creates a VPN ticket with a scanned image and downloads exact bytes by signed URL`, `Other employee cannot read ticket on either path`, `Anonymous API denied`.)*
- [x] Lần `up` thứ hai qua Make/Node không mất ticket, audit, tệp; n8n restart có bằng chứng. *(Cùng run #52: `make up` lần hai + `stack-test.mjs --verify-preserved` xanh, có `Ticket from previous startup is preserved`, `Scanned attachment remains readable by a new signed URL after restart`, `n8n imported workflow responds`, `n8n workflow survives restart`.)*
- [ ] Phân biệt rõ 3 PoC TN-04 với tích hợp sản phẩm; upload lỗi không làm tạo ticket trùng. *(Runtime đã có: CI #52 `TN-04 runtime (wikijs/mattermost/metabase)` xanh; phần Compensated upload đã có unit/integration test pass. **Chưa tick** vì vế "phân biệt rõ trong tài liệu" đang được C23-05 làm và cần reviewer xác nhận.)*
- [ ] Run/check/artifact đúng SHA snapshot đều đạt; log/ảnh/JSON không chứa token, password, TOTP secret hay URL ký. *(Phần "run đạt" đã có: **#53 trên `c683d2e` xanh 12/12**. Chưa tick vì hai vế còn mở: (1) C23-01 chưa chốt `c683d2e` là snapshot bàn giao, (2) chưa rà **artifact** của run (tải `.local/reports` từ artifact `week2-stack-evidence`/`week2-browser-evidence` và grep token/password/TOTP/URL ký) — mới chỉ rà console output tại máy, không thấy in secret.)*

**Bằng chứng:** bảng `SHA → run ID → job → PASS line → artifact`, nền tảng/versions và thời gian ICT. Run #42 là đối chiếu lịch sử, không thay lượt này. **Bằng chứng hiện hành:** `7e27ec3` → run #52 / ID `41321384189` → 11/12 job xanh (danh sách PASS line ở trên); `72f72d7` → 44+81 unit, 19/19 integration, `check-config` PASS, 7/7 browser fixture PASS **sau sửa harness chưa commit**; Node v24.11.1, win32 Git Bash, 02/11/2026 ~01:35–01:50 ICT. **Còn thiếu:** một CI run xanh 12/12 trên đúng SHA mà C23-01 chốt.

<a id="c23-03"></a>

#### C23-03 — Người khác cài và demo M1–M2 từ máy sạch

**Owner:** Nguyên điều phối; người thực hiện không phải tác giả phần vừa kiểm. **Đọc:** [cài đặt](cai-dat.md), [demo W2](demo-tuan-2.md), [M2](ke-hoach-tuan-3.md#tiêu-chí-hoàn-thành-tuần-3-m2--nguyên-văn-từ-kế-hoạch-triển-khai).

**Hướng làm:** dùng clone/volume/project Docker riêng cho nghiệm thu, `.env.example` với secret dev riêng; không reset DB đang dùng. Ghi từ pull images đến healthy, chạy browser qua APISIX, không dùng Vite proxy/native portable thay cho nghiệm thu full stack.

- [ ] Người ngoài tác giả chạy lệnh cài đặt mà không phải sửa tay source/config khác hướng dẫn.
- [ ] M1: đủ bảy dịch vụ Tầng 1, web/API sẵn sàng, username/role, dữ liệu RLS và n8n mẫu.
- [ ] M2: đăng ký/đăng nhập OTP, tạo VPN+ảnh, xem events, thử Employee khác và staff, chặn Critical, EICAR, tải ký.
- [ ] Desktop/mobile, tạo/đọc/chuyển trạng thái, xử lý lỗi scanner/storage và retry attachment giữ ID được kiểm.
- [ ] Khởi động lại theo hướng dẫn, dữ liệu/tệp còn; ghi thời gian, ảnh và người demo.

**Lỗi chặn demo:** không đóng ticket; tạo bug có tái hiện và giao owner, chạy lại ca ảnh hưởng sau sửa.

<a id="c23-04"></a>

#### C23-04 — Review chéo và đóng findings

**Owner:** Nguyên điều phối. **Review đề xuất:** Quyền review frontend; Séc review API/contract; Nguyên review infra/license. Hai reviewer độc lập theo checklist release, không tự duyệt công việc của mình.

- [ ] Review RLS cả API/REST, service login không superuser/bypass, JWT issuer/audience, quyền chuyển trạng thái và chống ghi trực tiếp.
- [ ] Review upload intent/cleanup, MIME/size/fail-closed, signed capability, secret/log/URL và dependency.
- [ ] Review tích hợp UI mới với dữ liệu API thật, themes, keyboard/mobile, thông báo lỗi và rollback giao dịch.
- [ ] Ghi finding `mức độ → phạm vi M2 hiện hành/W4 tương lai → file → tái hiện → owner → fix SHA → retest`; không còn lỗi chặn demo M2 hoặc High ảnh hưởng phạm vi M2 chưa xử lý. Finding mô tả năng lực W4 chưa xây phải được reviewer con người xác nhận phân loại và gắn gate W4 tương ứng; giữ OPEN cho tới khi có fix/retest, không coi việc chuyển phạm vi là đã sửa.
- [ ] Ghi review mới trên snapshot/PR tiếp theo nếu PR #3 đã merge không review; **không dựng review hồi tố** cho PR cũ.

**Bằng chứng:** nhận xét người review, SHA, danh sách findings và test sửa; agent review chỉ là hỗ trợ. SEC-01 là ví dụ nợ W4 được báo cáo là High nhưng không chặn demo hiện tại; không thể yêu cầu triển khai W4 để đóng A khi A lại cấm triển khai W4. Reviewer phải ghi rõ phạm vi và điều kiện mở W4-02A, đồng thời xử lý mọi rủi ro M2 thực tế riêng. Khi chưa có kết luận người review, C23-04 vẫn chưa DONE; agent không tự miễn gate hoặc hạ mức độ finding. SEC-06 phải được rà cả tác động webhook `hello` hiện hành và điều kiện bắt buộc trước webhook có side effect W4.

**Hồ sơ chuẩn bị 02/11 (agent A-SEC, review tĩnh + `npm audit` local — CHƯA phải review người, ticket vẫn mở):** [review-cheo-2026-11-02.md](review-cheo-2026-11-02.md) trả lời đủ 8 mục checklist, ghi **14 finding SEC-01…SEC-14** (2 High, 5 Medium, 4 Low, 3 Info) theo đúng mẫu `mức độ → file → tái hiện → owner → fix → OPEN`, kèm mục "Điểm đã kiểm và ĐẠT". Lead đã tự mở file kiểm chứng độc lập các điểm nặng nhất: route `/webhook/*` thật sự **không có plugin nào** (SEC-06, [infra/apisix/apisix.yaml:56-61](../infra/apisix/apisix.yaml#L56-L61) — đối lập `/api/*` `:68-77`); `GET /api/health` chạy `SELECT 1` xuống DB cho mỗi request công khai ([apps/api/src/controllers.ts:25](../apps/api/src/controllers.ts#L25)) và route không `limit-req`; **lệch allow-list MIME** API 6 loại (`image/gif`, `image/webp` — [apps/api/src/dto.ts:21](../apps/api/src/dto.ts#L21)) so với UI 4 loại ([apps/web/src/lib/attachments.ts:4](../apps/web/src/lib/attachments.ts#L4)); **vùng body 16–20 MiB** lọt cổng (`client_max_body_size: 20m`, [infra/apisix/config.yaml:19](../infra/apisix/config.yaml#L19)) rồi chết ở parser 16mb ([apps/api/src/app.ts:55](../apps/api/src/app.ts#L55)) → 500 thay vì 413; và **không có quota đính kèm** (grep `quota|COUNT(*)` trong controllers = 0). `npm audit --omit=dev --audit-level=high` cả hai app: 0 lỗ hổng. **Agent bác bỏ 1 nhận định của chính kế hoạch này** (cột SLA mới bị hở grant — sai, vì grant ở `003:242` là column-level và `005:68` đã thu hồi), đã cập nhật lại ở [B.6.0 mục 5](#b60). ba finding còn lại người ký cần quyết: SEC-09 credential demo plaintext trong realm import, SEC-13 thiếu notices license cho image tn04/ollama (Wiki.js AGPL), SEC-12 signed URL replay được trong TTL 120 s.

<a id="c23-05"></a>

#### C23-05 — Chốt TN/ADR và loại nợ tài liệu giả

**Owner:** Séc TN-01, Quyền TN-02, Nguyên TN-03/04; A-DOC tổng hợp sau review.

**Hướng làm:** lập bảng `khẳng định cũ → snapshot/ngày → bằng chứng thay thế → hiện trạng`. Giữ nguyên lịch sử, thêm mục cập nhật có ngày. Không biến “có script” thành đã chạy.

- [ ] TN-01/QĐ-1: ghi đội chấp nhận React fallback và giới hạn, browser thật qua APISIX; không bắt chạy Appsmith nếu fallback đã được duyệt.
- [ ] TN-02: cập nhật API/REST identity, RLS/máy trạng thái, migration hiện tại và phạm vi fixture/real.
- [ ] TN-03/QĐ-3: ADR 0007/0009 thống nhất JSON base64, quét trước lưu, URL do API ký HMAC; không gọi nhầm là S3 presigned/multipart.
- [ ] TN-04/QĐ-2: cập nhật trạng thái PoC đã có bằng chứng, nói rõ phần SSO Wiki/phạm vi quyền/bot còn tích hợp sau; không đòi trả phí để tick.
- [x] Ghi rõ 9 giá trị trạng thái gồm `cancelled`, 17 cạnh; chỉnh cách gọi “8 trạng thái” ở phần hiện hành mà không đổi đồ thị đã được test. *(02/11: `docs/api/contract.md:87` đổi tiêu đề thành "9 giá trị, 17 cạnh (DOCX gốc diễn đạt 8 trạng thái)", `openapi.yaml` xác nhận 1:1 với `ticket_transitions`. Chưa đếm lại đồ thị trong code. **Còn sót 4 chỗ không thuộc phạm vi A-DOC**: `apps/api/src/state-machine.ts:3`, `db/migrations/003_ticket_workflow.sql:3` (file checksum-lock, chỉ có thể sửa bằng migration/comment mới), tên test "8-state" trong `apps/api/test/workflow.test.mjs:26` và `CHANGELOG.md:15`.)*
- [ ] Đồng bộ mục lục ADR, README/cài đặt/contract/OpenAPI/báo cáo/checklist hiện hành; các dòng “chưa Docker/CI” cũ có ngày và nguồn thay thế.

**Bằng chứng:** diff tài liệu có dẫn run/SHA; reviewer xác nhận không lẫn PoC và sản phẩm. **Đợt 02/11 (A-DOC, chỉ trong phạm vi file được giao):** đã sửa `docs/api/contract.md`, `docs/api/openapi.yaml`, `docs/adr/README.md`, `docs/du-lieu.md`, `docs/cai-dat.md`; bảng đối chiếu đầy đủ ở [doi-chieu-tai-lieu-02-11.md](doi-chieu-tai-lieu-02-11.md); `check-config.mjs` PASS và apps/api 44/44 PASS sau sửa. **Finding đáng chú ý:** `docs/cai-dat.md` từng khẳng định sai "plugin `openid-connect` đã bị gỡ ở gateway" — template `infra/apisix/apisix.yaml:15` và `:72` vẫn bật plugin này cho cả `/rest` và `/api`; API/PostgREST chỉ là lớp phòng thủ hai. **Chưa xong, cần owner:** thân ADR 0007 vẫn dùng "presigned GET" cho đường đọc tại `docs/adr/0007-vi-tri-quet-clamav.md:47` và `:69` (0007 ngoài phạm vi đợt sửa, đã ghi chú 0009 thay thế — cần chủ ADR ký xác nhận supersede); `contract.md:52,64` dẫn số migration 004/006 cho các hàm attachment **chưa được xác minh**; TN-01/QĐ-1, TN-02, TN-04 và các dòng "chưa Docker/CI" trong `docs/bao-cao-kiem-thu-tuan-2.md`/`phat-hanh-tuan-2.md` vẫn chờ Séc/Quyền/Nguyên.

<a id="c23-06"></a>

#### C23-06 — TN-05 vòng 1 trên máy demo 16 GB

**Owner:** Séc; Nguyên chuẩn bị môi trường; Quyền kiểm số. **Đọc:** [ADR 0005](adr/0005-tn05-tai-nguyen.md), [benchmark](../scripts/benchmark.mjs).

**Hướng làm:** xác nhận đúng máy mục tiêu trước. Chạy đủ stack healthy + Ollama; cài model chỉ khi được phép và đủ đĩa/mạng. Công cụ hiện đo mặc định `qwen2.5:1.5b`, `qwen2.5:3b`, `qwen3:4b`; ghi digest/quantization thay vì chỉ tên model.

- [ ] Ghi RAM vật lý, CPU/GPU, OS, Docker/WSL memory cap/overhead, phiên bản, SHA và profile; máy không đúng 16 GB không thay bằng chứng target.
- [ ] Baseline idle, mỗi model một warmup + ba lượt, unload giữa model; đầu ra JSON/CSV có `completed:true` hoặc báo lỗi thật.
- [ ] Ghi snapshot RAM container và tốc độ token/s; **không gọi snapshot là peak**.
- [ ] Kèm lấy mẫu peak riêng có timestamp khi mở browser, upload, scanner và ứng dụng nền; phân biệt tổng host và tổng container để không cộng trùng.
- [ ] So với ngân sách khoảng 14 GB của đề án; nếu vượt ghi fallback profile/mô hình nhỏ/Ollama máy LAN, không chọn model cuối thay QĐ-5 tuần 6.
- [ ] Hai người rà raw output, lỗi/ngoại lệ và kết luận; lưu artifact sạch secret, báo cáo có thể tái lập.

**BLOCKED:** chưa có máy/model/quyền cài thì ghi owner tháo gỡ + ngày hẹn; không thay bằng runner CI hoặc máy RAM lớn.

<a id="c23-07"></a>

#### C23-07 — BTC: hạn nộp, hồ sơ và phạm vi n8n/QĐ-4

**Owner:** Nguyên liên hệ; Quyền ghi quyết định n8n. **Đọc:** [mẫu hỏi BTC](phat-hanh-tuan-2.md#w2-11--nội-dung-hỏi-btc-để-nguyên-gửi), [ADR 0006](adr/0006-n8n-import.md), [notices](../THIRD-PARTY-NOTICES.md).

- [ ] Chuẩn bị câu hỏi: hạn/năm/giờ/kênh/hồ sơ; `17:00 06/12/2026` chỉ là giả định cho đến khi BTC trả lời.
- [ ] Chuẩn bị câu hỏi về n8n/license/phạm vi được phép; không diễn giải n8n thành Apache-2.0.
- [ ] Người có quyền thực sự gửi, lưu ngày/giờ/người nhận và bằng chứng đã gửi/đã trả lời; không đưa thông tin riêng tư thừa vào repo công khai.
- [ ] Có câu trả lời thì cập nhật deadline/checklist và QĐ-4; nếu chưa có thì `BLOCKED`, không tick “đã xác nhận”.
- [ ] QĐ-4 ghi ngưỡng theo đề án: import lỗi **hơn hai lần trong W4** hoặc BTC đổi hướng dẫn thì kích hoạt fallback; chọn Node-RED trước, Kestra là phương án cần đội chốt. Thay engine phải nghiệm thu lại workflow/restart, không thay toàn API.

**Bằng chứng:** link/ảnh đã che dữ liệu riêng + kết luận người chịu trách nhiệm. Kế hoạch không gửi tin thay thành viên.

<a id="c23-08"></a>

#### C23-08 — Board/Issue/milestone và liên kết bằng chứng

**Owner:** Nguyên; A-LEAD chuẩn hóa nội dung từ hai kế hoạch này.

- [ ] Tạo hoặc đối chiếu board với cột trạng thái mục A.3; mỗi ID C23/W4 có owner, reviewer, nhãn tuần/H-P-D-I, phụ thuộc, DoD, bug/evidence.
- [ ] C23-01 ghi rõ tiêu chí bàn giao board: local có mapping đầy đủ, hoặc GitHub Issues/Project/Milestone. Board local là phương án chuẩn bị hợp lệ; chỉ được dùng làm evidence đóng C23-08 khi phạm vi đó đã được người chịu trách nhiệm chọn.
- [ ] Nếu phạm vi đã chọn yêu cầu GitHub, chỉ đồng bộ sau khi được phép; ghi URL thật, không đánh dấu chỉ vì đã có file mẫu. Chưa có quyền thì phần GitHub giữ `BLOCKED`; không tự biến việc xuất bản PR thành ủy quyền tạo toàn bộ Issues/Project.
- [ ] Đối chiếu các PR đã merge và convention mới trên `origin/main`; không tự đổi/xóa nhánh của đồng đội.

<a id="c23-09"></a>

#### C23-09 — Gate phát hành và gói sạch

**Owner:** Nguyên; reviewer Quyền + Séc. **Đọc:** [release checklist](phat-hanh-tuan-2.md), [Makefile](../Makefile), [package-review](../scripts/package-review.mjs).

- [ ] C23-01…08 đã có kết luận/bằng chứng; gate chưa đạt phải giữ mở (không bắt đầu W4, không công bố đóng tuần).
- [ ] Test/CI/review trên đúng SHA chốt, CHANGELOG và release notes khớp phạm vi/version đã được đội chọn.
- [ ] Tạo gói ứng viên bằng `git archive` trên **SHA đã duyệt**, chưa cần tag: dùng prefix/version đã chốt và output trong thư mục review riêng. Rà tarball, SPDX/REUSE/notices, lockfiles, pinned images và license component. `make release VERSION=...` hiện đọc tag `v...`, vì vậy chỉ chạy ở C23-10 sau khi tag được cho phép tạo; không tạo tag sớm để vượt gate.
- [ ] Không có `.env`, token/credential/TOTP secret, URL ký, `.local`, `work`, `node_modules`, build artifact ngoài phạm vi; tính SHA-256 gói.
- [ ] Giải nén vào chỗ sạch, người khác dùng đúng hướng dẫn cài/chạy; lưu kết quả máy sạch và hash.

**Không làm trong ticket này:** gắn tag, push hoặc đăng release nếu chưa được ủy quyền. Không dùng `make reset`/`down -v` trên dữ liệu đang dùng.

<a id="c23-10"></a>

#### C23-10 — Công bố release và báo cáo thật

**Owner:** Nguyên, cả đội chịu trách nhiệm nội dung.

- [ ] Xin phép đúng thao tác xuất bản; kiểm lại remote tag/release để không tạo trùng.
- [ ] Gắn annotated tag version đã chốt trên SHA đã nghiệm thu, ngày thực tế; không sửa/force-move tag có người dùng.
- [ ] Chạy `make release VERSION=<version-đã-chốt>` sau khi có tag; kiểm tag trỏ đúng SHA và gói có cùng cây nội dung với gói ứng viên C23-09. Ghi hash gói phát hành thật (hash gzip có thể khác giữa hai lần đóng gói dù cây source giống nhau).
- [ ] Đăng GitHub Release kèm gói/hash/notes đúng phạm vi, ghi URL.
- [ ] Gửi báo cáo M1–M2 cho thầy bằng kênh được đồng ý; ghi thời gian/người gửi/xác nhận, không tự nhận thầy đã duyệt.
- [ ] Lưu toàn bộ link vào ticket; nếu version đổi so với v0.1.0, ghi quyết định điều chỉnh mục tiêu M1, không tuyên bố kế hoạch gốc được thực hiện nguyên vẹn.

<a id="c23-11"></a>

#### C23-11 — Biên bản đóng và bàn giao

- [ ] Mỗi ticket C23-01…10 và C23-12 DONE có evidence, không còn BLOCKED hoặc checkbox bỏ sót.
- [ ] Reviewer kiểm mẫu đối chiếu SHA của CI/release/docs; người khác chạy được demo.
- [ ] Công bố riêng hai kết luận “kỹ thuật M2” và “đóng đủ tuần 2–3”; nếu đổi phạm vi ghi rõ approved change, không giấu việc bỏ.
- [ ] Chuyển backlog W4, ghi quyết định team/service account/SLA còn phải chốt ở W4-00.

<a id="c23-12"></a>

#### C23-12 — Đồng bộ harness browser với UI đã merge *(phát hiện khi chạy C23-02 ngày 02/11)*

**Owner:** Nguyên / A-QA; reviewer Séc (UI). **Vùng:** `tools/testing/browser-smoke.mjs` — **không sửa UI để làm test xanh**.

**Bằng chứng gốc:** CI run #49 `b243b31`, #50/#51 `72f72d7`, #52 `7e27ec3` đều đỏ ở job `giao diện desktop và mobile (fixture)`, log dừng tại `browser-smoke.mjs:114` chờ `Thông tin bắt buộc theo danh mục`. UI đã đổi tiêu đề thành `Thông tin bổ sung theo danh mục` (`apps/web/src/pages/CreateTicketPage.tsx:422`) và thêm dòng chú thích "các trường có dấu * là bắt buộc"; danh mục VPN thật sự có trường `required: false` (`db/migrations/003_ticket_workflow.sql:53`), nên **copy mới đúng nghiệp vụ hơn**, harness mới là phần lệch.

**Ba lệch nữa lộ ra sau điểm dừng đầu tiên (script dừng ở fail đầu tiên nên CI chưa chạy tới):**
1. Nút gửi không còn `aria-disabled="false"` khi biểu mẫu hợp lệ mà bỏ hẳn thuộc tính (`CreateTicketPage.tsx:708` `aria-disabled={!canSubmit || undefined}`) — hành vi hợp chuẩn a11y, harness cần kiểm `null` + `isEnabled()`.
2. Loại thiết bị đã đổi từ `<select>` sang thẻ radio (`DeviceRequestPage.tsx:341-368`), `selectOption` không còn điều khiển để chọn; input là `sr-only` nên phải click nhãn và assertion trạng thái `isChecked()`.
3. Trang chi tiết render nhãn trạng thái ở hai nơi (thẻ đầu phiếu `TicketDetailPage.tsx:385` và header panel "Thao tác" sticky `:654`), nên đếm toàn trang = 2; test cũ giả định 1.

**Đã làm tại máy ngày 02/11:** sửa đúng 3 điểm trong `tools/testing/browser-smoke.mjs`, giữ nguyên mọi assertion nghiệp vụ (payload chỉ 5 trường whitelist, `fields` chỉ gửi trường đã điền, số ghi = 0 khi nút bị khóa, `scrollWidth <= innerWidth`). Kết quả `node tools/testing/browser-smoke.mjs` → **7/7 PASS**, `.local/reports/browser.json` `passed: true` lúc 02/11/2026 01:50 ICT.

**Checklist:**
- [x] Tái hiện đúng lỗi CI trên cùng SHA (`72f72d7`) trước khi sửa.
- [x] Sửa harness theo hành vi UI hiện hành, không sửa UI để lách test, không bỏ assertion nào.
- [x] `node tools/testing/browser-smoke.mjs` PASS 7/7 tại máy (fixture, Chromium local, win32).
- [x] CI run xanh job `giao diện desktop và mobile (fixture)` trên SHA đã commit — **ĐẠT 02/11**: push `72f72d7..c683d2e` lên `develop-quyennnv` (fast-forward, không force), run **#53** ID `41340713516` kết thúc **success, 12/12 job xanh** gồm cả job fixture và job stack (hoàn tất 01/11 19:19 UTC = 02/11 02:19 ICT). Ba selector mới đã được chứng minh chạy đúng trên Linux/Chromium của CI chứ không chỉ Windows tại máy.
- [ ] `main` **vẫn còn đỏ**: `origin/main` = `7e27ec3` mang harness cũ, job fixture của main chỉ xanh khi bản sửa được merge. Chưa merge trong lượt này vì người dùng chỉ ủy quyền push nhánh của mình.
- [ ] Xác nhận không còn UI copy nào khác lệch với harness (deviation scan) và ghi vào ADR/CONTRIBUTING rằng đổi copy UI phải cập nhật harness trong cùng PR.

**Không được làm:** hạ `browser-smoke` xuống mức smoke tối thiểu để cho xanh; tách riêng UI và harness ở hai PR khác nhau mà không có run kiểm chứng.

### A.5. Thứ tự làm và ngưỡng không được bỏ

```text
C23-01 → C23-02 → C23-03 ─┐
C23-01 → C23-04 → C23-05  │   (C23-05 cần cả C23-02 và C23-04)
C23-01 → C23-06 (máy 16GB)├─→ C23-09 → C23-10 → C23-11 → mở giai đoạn B
C23-01 → C23-08 (board)  │
C23-01 → C23-12 (harness)┘  (sửa lỗi phát hiện khi chạy 02; sửa xong chạy lại 02)
C23-07 (trả lời của BTC / QĐ-4) ─→ C23-09   (không có phụ thuộc kỹ thuật, chỉ cần người trả lời)
```

Quan hệ "cần DONE trước" đọc thẳng từ bảng A.4: `02←01` (và sửa/retest mọi bug đang chặn, gồm 12), `03←01,02`, `04←01`, `05←02,04`, `06←01`, `07←(BTC)`, `08←01`, `12←snapshot của 01`, `09←02…08 và 12`, `10←09`, `11←01…10 và 12`. Việc **phát hiện** 12 nằm trong lượt chạy 02, không phải dependency đòi 02 DONE; như vậy không tạo vòng khóa `02 DONE → 12 DONE → 02 DONE`. Không dùng sơ đồ khối gộp dây vì dễ hiểu nhầm C23-04 phụ thuộc C23-02 (thực tế chỉ cần C23-01).

Không coi việc chuẩn bị nội dung ticket là đã đóng phụ thuộc; ví dụ có thể soạn câu hỏi BTC ngay nhưng C23-07 chỉ DONE khi có trả lời/quyết định đủ evidence.

1. **Ngày 02/11:** C23-01 và C23-08; C23-04 review song song; hỏi lịch máy C23-06 và chuẩn bị câu hỏi C23-07 ngay.
2. **Ngày 02–03/11:** C23-02 rồi C23-03; A-DOC làm C23-05 từ findings. Lỗi code mới phải có ticket sửa riêng + retest, không lẫn “sửa docs là xong”.
3. **Khi có máy/phản hồi:** C23-06/07; không hứa ngày đóng thay chủ máy/BTC. W4 giữ BLOCKED cho đến C23-11 DONE; không giao implementation W4 khi đang chờ BTC hoặc máy.
4. **Sau đủ gate:** C23-09 → xin phép xuất bản C23-10 → C23-11. Nếu chưa đủ, báo “M2 kỹ thuật đạt trên SHA…, còn đóng nợ …”, không ghi 100%.

### A.6. Lệnh kiểm tra và môi trường

Lệnh dưới có sẵn trong repo; đọc script trước khi chạy, không tự cài dependency/môi trường nếu chưa được phép. Windows dùng `npm.cmd`.

```sh
git status --short --branch
git ls-remote --heads origin
git ls-remote --tags origin
npm.cmd run build --prefix apps/api
npm.cmd test --prefix apps/api
npm.cmd run build --prefix apps/web
npm.cmd test --prefix apps/web
node tools/testing/check-config.mjs
node tools/testing/run-integration.mjs
node tools/testing/migration-test.mjs
node tools/testing/browser-smoke.mjs
```

Full stack cần Docker/Linux containers, `.env` local, Chromium cho harness; native integration cần binary/phụ thuộc theo tài liệu:

```sh
node scripts/dxdesk.mjs up
node scripts/stack-test.mjs --restart-n8n
node tools/testing/stack-browser.mjs
make up
node scripts/stack-test.mjs --verify-preserved
node tools/testing/gateway-test.mjs
reuse lint
```

- Không có Docker tại máy đang làm việc thì dùng máy nghiệm thu/CI phù hợp; không tự cài WSL hoặc tự restart Windows.
- `migration-test.mjs` cần `psql` trên PATH. Bundle `@embedded-postgres/windows-x64` **không kèm** `psql.exe`, nhưng repo đã có bản portable: `PATH="$(pwd)/.local/bin/psql-17.10/pgsql/bin:$PATH" node tools/testing/migration-test.mjs` (đã cho 5/5 PASS trên Windows ngày 02/11). Đừng kết luận "BLOCKED" trước khi kiểm tra `.local/bin`.
- `--verify-preserved` yêu cầu report và dữ liệu của lần trước; không xóa volume/report trước rồi tuyên bố dữ liệu được giữ.
- PoC TN-04 theo profile/project riêng trong [hoàn thiện tuần 3](hoan-thien-tuan-3.md); không dùng DB ticket của người dùng cho thí nghiệm.

### A.7. Mẫu cập nhật và công thức tiến độ

```text
Ticket: C23-xx | Status: TODO/READY/DOING/REVIEW/VERIFY/BLOCKED/DONE
Owner thực nhận: ... | Agent/model thực dùng: ... | Reviewer: ...
Base SHA: ... | Branch/worktree: ... | File được phép ghi: ...
Đã làm: ... | Còn thiếu: ... | Blocker + người tháo gỡ + ngày hẹn: ...
Test: lệnh / số pass-fail / fixture hay real / hệ điều hành / thời gian ICT
Evidence: commit + run ID + job + dòng PASS + artifact/link review/demo
PR/merge SHA: ... | Người xác nhận DONE: ... | Ngày: ...
```

**Đóng nợ hiện hành:** `số ticket DONE / 12`. Đây không phải % tính năng toàn dự án hoặc % công sức. Bảng khởi tạo **0/12 ticket gate đã đóng**; không đồng nghĩa tuần 2–3 chưa làm gì. 100% chỉ khi 12/12 gate đạt trên phạm vi đã thống nhất, còn giữ nguyên checklist nhỏ làm bằng chứng chi tiết.

<a id="a-8"></a>

### A.8. Nhật ký chạy bằng chứng 02/11/2026 (nhiều agent, lead tự kiểm chứng)

**Trạng thái lịch sử của lượt đầu 02/11:** 4 agent chạy song song theo vùng file không chồng nhau; lúc đó không commit/push/tag (người dùng chọn "chỉ sửa working tree"). SHA cơ sở `72f72d7`; `origin/main` `7e27ec3`. Quyền và trạng thái Git của lượt tiếp theo được ghi riêng bên dưới, không hồi tố thay chứng cứ lượt này.

| Agent |Ticket | Kết quả thật | Lead kiểm chứng lại |
|---|---|---|---|
| A-QA | C23-02 | Chạy thật tại máy: apps/api build sạch + **44/44**, apps/web build sạch + **81/81 (10 file)**, `check-config` PASS, `run-integration` **19/19** (PostgreSQL 17.10 + PostgREST 16.4 nhúng), `npm audit` 0 lỗ hổng hai app. Báo **BLOCKED**: `migration-test` (cho rằng thiếu `psql`), `gateway-test`/compose/stack thật (không Docker), `reuse lint` (thiếu CLI). Đếm CI: **9 job khai báo → 12 run** sau nở matrix, khớp plan | Lead tự chạy lại api/web và browser-smoke; xác nhận `docker`/`reuse` không tồn tại; tự đếm job từ `ci.yml`; **lead bác 1 kết luận của agent**: `psql` có sẵn trong repo nên `migration-test` chạy được và **5/5 PASS** (xem mục 117 ở trên) |
| A-QA + lead | **C23-12 (mới)** | Phát hiện `main` **đang đỏ CI**: run #49 `b243b31`, #50/#51 `72f72d7`, #52 `7e27ec3` fail cùng một job `giao diện desktop và mobile (fixture)`; log CI dừng đúng `browser-smoke.mjs:114` chờ text cũ. UI redesign đã đổi copy và điều khiển: nhãn khối trường động, cách nút gửi báo `aria-disabled`, `<select>`→thẻ radio, trạng thái xuất hiện 2 chỗ. Lead sửa **chỉ harness** (giữ nguyên mọi assertion nghiệp vụ) → **7/7 PASS**, `.local/reports/browser.json` `passed: true` | Lead tự tải log job #52 và tự reproduce lỗi trên cùng SHA trước khi sửa; tự chạy lại sau sửa |
| A-DOC | C23-05 | Sửa drift tài liệu trong phạm vi được giao (`contract.md`, `openapi.yaml`, `adr/README.md`, `du-lieu.md`, `cai-dat.md`), tạo `doi-chieu-tai-lieu-02-11.md`. Finding đáng chú ý: `cai-dat.md` nói sai "plugin `openid-connect` đã bị gỡ" — template vẫn bật cho `/rest` và `/api`. `README.md` gốc đối chiếu xong, không sửa | Lead mở `infra/apisix/apisix.yaml` xác nhận `:15` và `:72` có plugin; chạy lại `check-config` PASS; grep "8 trạng thái"/"presigned" để kiểm phần còn sót |
| A-SEC | C23-04 | 14 finding SEC-01…14 + mục "ĐẠT" + mục "Cần người ký"; **bác bỏ 1 nhận định của kế hoạch** (cột SLA hở grant) | Lead tự kiểm 5 finding nặng nhất bằng cách mở đúng file:line (webhook không plugin, health chạm DB, MIME 6-vs-4, 16–20 MiB→500, không quota) và xác nhận phần bác bỏ là đúng |
| A-CONTRACT | W4-00 (chỉ chuẩn bị) | `w4-quyet-dinh-00.md`: 14 hồ sơ quyết định QĐ-01…14 theo mẫu, 9 nút thắt mới N1…N9, ma trận test W4-08A 22 ca, 14 câu hỏi cần người, bảng ký **trống**. Không tick checkbox W4-00 nào | Lead xác minh N2 (`SELECT *` ở `controllers.ts:83`), N4 (`apisix.yaml:56-61`), N8 (realm không có confidential client), N9 (`response_minutes` không code nào dùng), và `PGRST_DB_SCHEMAS=public` ở `.env.example:33` |

**Cột mốc rút ra từ lượt chạy này:**
1. **Bằng chứng stack thật cho tuần 2–3 đã tồn tại trên `7e27ec3`** (run #52, 23 dòng PASS job `stack`), không chỉ là "lịch sử run #42". C23-02 vì thế đạt 5/7 checkbox; 2 checkbox còn lại kẹt ở C23-12 và ở việc C23-01 chưa chốt snapshot.
2. **Việc merge UI (`b243b31`) vào `main` không kèm run CI xanh và không cập nhật harness** → `main` đỏ suốt từ 01/11 (run #49→#52). Đã sửa harness, push `c683d2e` và **CI #53 xanh 12/12** nên nhánh đã sạch lỗi đó; `main` chỉ hết đỏ khi merge. Đây là đúng loại nợ mà C23-04/C23-02 định nghĩa là "không được ký thay"; quy trình cần siết: đổi copy/điều khiển UI phải sửa harness trong cùng PR.
3. **Giai đoạn B vẫn BLOCKED đúng gate.** Lượt này chỉ sản xuất hồ sơ quyết định và ràng buộc đã kiểm chứng; không một dòng code W4, không migration 008.

**Việc còn mở sau lượt lịch sử:** commit bản sửa harness + chạy CI lấy run xanh 12/12 trên SHA chốt; các owner/reviewer trong bảng ký QĐ-01…14 xác nhận khi gate cho phép; SEC-01/06 phải có quyết định trước khi W4-02A mở; BTC trả lời C23-07; máy 16 GB cho C23-06; người ngoài tác giả demo C23-03. Commit harness đã có sau đó tại `cbd9c52`; không còn cần xin lại ủy quyền commit/push mà người dùng đã cấp cho lượt tiếp theo.

**Đề xuất 24 giờ được ghi ở lượt lịch sử:** commit/push harness và docs để có CI mới; khóa snapshot/release và nguồn yêu cầu gốc; chủ ADR/TN rà phần còn lại; hỏi lịch máy 16 GB và chuẩn bị câu hỏi BTC. **Trình tự hiện hành:** ưu tiên sửa/kiểm thử C23 trên `develop-secnv`, xuất bản nhánh bàn giao/PR trong phạm vi đã được người dùng yêu cầu, rồi đối chiếu evidence đúng SHA. QĐ-01…14 vẫn là draft: chỉ ký W4-00 sau C23-11, không biến lịch ngồi ký thành ngoại lệ mở W4 trước A.

### A.9. Phân tích và phân công lượt tiếp theo ngày 02/11/2026

Nguồn nhận việc mới là `origin/develop-quyennnv` tại `c683d2ea20bff82ed86910fa5f3ad855040f8df3`; merge vào `develop-secnv` tại `ed1f1b554fe1e5738281456967966199d76f152c`. Đây là **base đầu lượt**, chưa phải SHA cuối được C23-01 nghiệm thu. Bản sửa harness là `cbd9c52`; file kế hoạch và hai hồ sơ review/quyết định đã được track, nên ghi chú "untracked/chờ commit" trong baseline là thông tin lịch sử.

Người dùng đã yêu cầu phân công, thực hiện việc phù hợp, build/test, push `develop-secnv` và tạo nhánh `feature/...`/PR vào `main`, rồi xác nhận **"cứ build sao cho phù hợp với prj, source đã có"** sau khi được nêu các gate bên ngoài. Tiếp tục kỹ thuật C23/W4 theo ngoại lệ mục 0 và mặc định kỹ thuật được lead ghi rõ; không xin lại cùng quyền chỉ vì nhật ký cũ ghi thiếu quyền. Yêu cầu này không tạo ra câu trả lời BTC, số đo máy 16 GB, chữ ký reviewer, quyết định version phát hành, quyền gửi tin/báo cáo, tag/release hoặc quyền tự merge PR.

| Agent thực nhận | Việc và vùng ghi trong lượt này | Dependency / reviewer | Trạng thái evidence |
|---|---|---|---|
| `/root` (lead/integrator) | Đồng bộ trên `develop-secnv`; tích hợp patch; chốt danh sách file shared, build/test/CI và nhánh bàn giao/PR | Người dùng đã giao Git/PR; review độc lập và các gate C23 còn mở | Không tự ký thay người nghiệm thu |
| `/root/backend_platform_audit` | Rà backend/platform, sửa finding C23 và phần kỹ thuật W4 được lead giao; shared API/config/migration phải có một writer | Lead khóa contract thực thi, ghép và kiểm tra test theo dependency | Kết quả cụ thể theo diff/evidence của agent và PR |
| `/root/ui_review` | Rà UI/harness/contract hiện hành, sửa parity C23 và consumer W4 trong đúng danh sách file lead đã giao | Chỉ nối producer/contract đã thống nhất; lead kiểm regression SSO/theme/upload | Fixture không thay stack thật |
| `/root/week4_plan_audit` | `docs/ke-hoach-tuan-4.md`, `docs/phan-tich-ke-hoach-tuan-4-2026-11-02.md` | Lead review lập luận, ownership và gate; chỉ sửa tài liệu kế hoạch | Không đóng ticket hoặc tạo chữ ký con người |

Chi tiết inventory 12 C23/17 W4, mâu thuẫn, phạm vi sửa ngay và các quyết định chưa có evidence ở [báo cáo phân tích](phan-tich-ke-hoach-tuan-4-2026-11-02.md). **W4 được thực thi kỹ thuật theo ngoại lệ mục 0; gate nghiệm thu vẫn mở.** Bảng B.2 là trạng thái khởi tạo trước ngoại lệ, không phải tuyên bố đã có ticket DONE. Không nâng trạng thái DONE từ việc có agent thực hiện hoặc có nhánh/PR.

### A.10. Bàn giao source và đồng bộ cập nhật mới nhất

Đã đồng bộ `origin/develop-quyennnv` đến `e216b0177a878e70df16ca1ee4471b5059f1419b`, gồm ba commit bổ sung bằng chứng CI sau `c683d2e`. CI #53/#55 xanh trong A.2 là bằng chứng lịch sử của nhánh Quyền, không phải CI cho source W4 mới. Giữ các sửa dependency C23-02/12 và quyền triển khai mới từ người dùng; không khôi phục vòng chờ hay yêu cầu xin lại quyền commit/push/PR đã được cấp.

Ba agent đã chia theo backend/DB, web/UI và kế hoạch/data; lead tích hợp worker/n8n/Mattermost, review và kiểm stack. Bàn giao kỹ thuật và các mặc định thực thi, source theo từng W4-00…W4-GATE, runbook và bằng chứng nằm trong [báo cáo tuần 4](hoan-thien-tuan-4.md). Local đạt API 61, web 108, seed 8, PostgreSQL/PostgREST 25 nhóm; stack thật 8 nhóm, browser thật 5 nhóm (có từ chối và mobile/landscape). Migration 011 sửa parity quyền Agent claim mà không sửa checksum 009. Khi xuất bản PR phải chạy CI lại đúng SHA cuối. Các checkbox DoD gốc dưới đây giữ mở tới khi đủ toàn bộ điều kiện nghiệm thu, không tick theo số test đã chạy.



<a id="phase-b"></a>

## B. Triển khai tuần 4 sau khi giai đoạn A đạt 100%

**Tuần theo đề án:** 02–08/11/2026; demo 07/11, báo cáo M3 08/11. Lịch thực thi phải điều chỉnh nếu gate A chưa đóng.

### B.1. Đích nghiệm thu và phạm vi

#### Kịch bản M3 bắt buộc theo mục 5.3

1. Employee tạo ticket VPN. Trong **60 giây**, hệ thống tự đưa tới `assigned`, đúng **Network Team**, có thông báo Mattermost và audit `ticket_events` phân biệt tác nhân hệ thống.
2. Agent nhận/xử lý → `waiting_user` khi cần → tiếp tục → `resolved` có cách khắc phục. **Người tạo phiếu** xác nhận `closed`; thiếu cách khắc phục không được resolve.
3. Chính sách SLA demo rút ngắn có nhắc ở **80%** và báo quá hạn đúng; có `sla_breached`, không nhắc lặp vô hạn.
4. Restart n8n khi có sự kiện chờ: không mất sự kiện, xử lý lại không nhân đôi thay đổi nghiệp vụ.
5. E2E VPN mới xanh trên stack thật, đồng thời không làm hỏng toàn bộ gate tuần 2–3.

`NEW/ASSIGNED/WAITING_USER/RESOLVED/CLOSED` trong DOCX là tên nghiệp vụ; code/DB giữ chữ thường. Hiện có **9 giá trị** kể cả `cancelled`, **17 cạnh**; không tự đổi máy trạng thái chỉ vì tài liệu cũ gọi “8 trạng thái”.

#### Những gì không đưa vào tuần 4 để báo tiến độ sai

- Không redesign lại toàn bộ UI/theme vừa tích hợp. Bổ sung bảng việc/duyệt lên hệ thống hiện tại, giữ SSO, upload/URL ký, responsive và theme settings.
- PoC TN-04 không phải tích hợp Wiki.js SSO/nhóm/quyền hoặc dashboard Metabase phân quyền. Wiki tri thức đầy đủ, dashboard, ứng dụng thiết bị có duyệt/PDF, JSON-LD/DCAT là tuần 5; AI/RAG và bản Internet là tuần 6.
- W4-07 chỉ khởi tạo generator và dữ liệu phục vụ M3; hoàn thiện bộ **6–8 tuần và các con số kịch bản** là W5-05. Dữ liệu tạo phải ghi rõ giả lập, không trình bày như số liệu vận hành.
- Không yêu cầu mô hình AI chạy trong E2E M3. TN-05/khung profile vẫn phải đo thật theo C23-06 và W4-09.

#### Baseline phải đọc

| Phần có sẵn | File nguồn / ý nghĩa cho W4 |
|---|---|
| Ticket CRUD/events/status | [controllers.ts](../apps/api/src/controllers.ts): các endpoint hiện hữu; status update khóa dòng, validation và audit cùng giao dịch |
| JWT người dùng | [auth.ts](../apps/api/src/auth.ts): chỉ nhận Employee/Agent/Manager; **chưa phải guard service account** |
| Quyền dữ liệu | [database.ts](../apps/api/src/database.ts), [policies](../db/policies/): transaction claims/RLS, không dùng superuser làm API |
| Team routing tham chiếu | [schema](../db/migrations/001_schema.sql), [seed](../db/migrations/002_reference_data.sql): routing_rules có tên team; chưa có cơ chế gán thực |
| Máy trạng thái và SLA | [state-machine.ts](../apps/api/src/state-machine.ts), [rules.ts](../apps/api/src/rules.ts), [ticketWorkflow.ts](../apps/web/src/lib/ticketWorkflow.ts), migration 003/005: bảo toàn parity |
| Web | [API client](../apps/web/src/services/api.ts), [list](../apps/web/src/pages/TicketListPage.tsx), [detail](../apps/web/src/pages/TicketDetailPage.tsx): filter hiện chỉ trong trang; không phải queue server-side |
| Automation | [hello.json](../infra/n8n/workflows/hello.json), [ADR 0006](adr/0006-n8n-import.md): mẫu import/restart, chưa là workflow nghiệp vụ W4 |
| Tests/runtime | [stack-test](../scripts/stack-test.mjs), [stack-browser](../tools/testing/stack-browser.mjs), [integration](../tools/testing/run-integration.mjs), [CI](../.github/workflows/ci.yml) |
| Phiên bản | Local `72f72d7`; remote main `7e27ec3` ngày 02/11. Phần hơn là workflow convention/CI/docs; cần đồng bộ được review trước khi mở nhánh thực thi |

**Đọc thêm:** [contract/OpenAPI](api/contract.md), [hoàn thiện tuần 3](hoan-thien-tuan-3.md), [ADR 0005](adr/0005-tn05-tai-nguyen.md), [ADR 0008](adr/0008-sso-keycloak-cho-ung-dung-co-san.md), [CONTRIBUTING](../CONTRIBUTING.md), toàn bộ DOCX mục 5.3 và 6. Nguyên=TV1, Quyền=TV2, Séc=TV3.

### B.2. Cách nhận ticket và tính hoàn thành

- `TODO → READY → DOING → REVIEW → VERIFY → DONE`; `BLOCKED` phải có lý do/người tháo gỡ/ngày hẹn. Bảng trạng thái này là nguồn cập nhật duy nhất; checklist bên trong ghi bước thật đã xong.
- **Một ticket DONE** khi đủ checkbox chi tiết, test âm/dương, docs/contract, CI đúng SHA, review chéo và evidence. Code xong chỉ chuyển REVIEW, không tick tổng.
- **Tiến độ ticket:** `DONE / 17`; **độ phủ mã gốc:** từng W4-01…09 chỉ hoàn thành khi tất cả ticket con của nó DONE; **M3 đạt:** thêm đủ kịch bản mục 1. Không dùng ba số này thay cho % toàn dự án.
- Các thời lượng là **ước lượng công sức, không phải cam kết**. Nhiều agent tăng tốc nghiên cứu/code nhưng không nhân số người review, máy demo hay thời gian CI.
- Mọi endpoint/schema/tệp mới bên dưới là **đề xuất chưa tồn tại** cho đến khi W4-00 được duyệt. Nếu contract thay đổi, owner cập nhật kế hoạch và consumer trước khi triển khai.

#### Bảng ticket khởi tạo

| Xong | ID / nguồn | Nội dung | Chính / hỗ trợ | Agent writer | Phụ thuộc | Trạng thái | Ước lượng ngày-người |
|---|---|---|---|---|---|---|---|
| [ ] | [W4-00](#w4-00) / gate | Khóa contract/quyền/team/SLA | Quyền / Nguyên, Séc | A-CONTRACT | C23-11 | BLOCKED: A | 0,5–1 |
| [ ] | [W4-01A](#w4-01a) | Outbox + audit hệ thống trong DB | Quyền / Nguyên | A-DB | W4-00 | BLOCKED: A | 1–1,5 |
| [ ] | [W4-01B](#w4-01b) | Dispatcher, lease/retry/replay | Quyền / Nguyên | A-API | W4-01A | BLOCKED: A | 1–1,5 |
| [ ] | [W4-02A](#w4-02a) | Service identity và callback có quyền hẹp | Quyền / Nguyên | A-API; A-PLATFORM phối hợp | W4-00, W4-01A | BLOCKED: A | 0,5–1 |
| [ ] | [W4-02B](#w4-02b) | Workflow phân loại/gán team | Quyền / Nguyên | A-AUTO | W4-01B, W4-02A, W4-02C, W4-04 | BLOCKED: A | 1–1,5 |
| [ ] | [W4-02C](#w4-02c) / hỗ trợ 05–06 | Queue/roster/nhận việc nguyên tử | Quyền / Séc | A-API | W4-00, W4-02A | BLOCKED: A | 1–1,5 |
| [ ] | [W4-03A](#w4-03a) | Deadline và cờ SLA idempotent | Quyền / Nguyên | A-DB; A-API phối hợp | W4-00, W4-01A | BLOCKED: A | 1–1,5 |
| [ ] | [W4-03B](#w4-03b) | Workflow nhắc 80%/quá hạn | Quyền / Nguyên | A-AUTO | W4-01B, W4-02A, W4-03A, W4-04 | BLOCKED: A | 1–1,5 |
| [ ] | [W4-04](#w4-04) | Mattermost TE bot/kênh nhóm | Nguyên / Quyền | A-PLATFORM | W4-00; QĐ-2/QĐ-4 | BLOCKED: A | 0,5–1 |
| [ ] | [W4-05](#w4-05) | Bảng việc và luồng Agent | Séc / Quyền | A-WEB | W4-02B, W4-02C, W4-03A | BLOCKED: A | 1–1,5 |
| [ ] | [W4-06](#w4-06) | Queue phê duyệt ticket Manager | Séc / Quyền | A-APPROVAL | W4-00, W4-02C | BLOCKED: A | 0,5–1 |
| [ ] | [W4-07](#w4-07) | Generator giả lập tái lập được | Séc / Quyền | A-DATA | W4-00, W4-01A, W4-02C, W4-03A | BLOCKED: A | 0,5–1 |
| [ ] | [W4-08A](#w4-08a) | Test fault/retry/quyền/race | Nguyên / Quyền | A-QA | W4-01A, W4-01B, W4-02A, W4-02B, W4-02C, W4-03A, W4-03B, W4-04 | BLOCKED: A | 0,5–1 |
| [ ] | [W4-08B](#w4-08b) | Browser E2E VPN/approval + CI | Nguyên / Séc | A-QA | W4-05, W4-06, W4-07, W4-08A, W4-09A | BLOCKED: A | 1–1,5 |
| [ ] | [W4-09A](#w4-09a) | Service matrix full/demo-light | Nguyên / Séc | A-PLATFORM | W4-00, W4-04 | BLOCKED: A | 0,5–1 |
| [ ] | [W4-09B](#w4-09b) | Đo tổng RAM/peak trên máy demo | Nguyên / Séc | A-ENV | W4-09A, W4-08B; máy target | BLOCKED: A + máy | 0,5–1 |
| [ ] | [W4-GATE](#w4-gate) | Tích hợp, demo và báo cáo M3 | Cả đội / lead | A-LEAD | 16 ticket W4 còn lại | BLOCKED: A | 0,5–1 |

`BLOCKED: A` là chặn toàn giai đoạn. Khi C23-11 DONE, lead đổi từng ticket về TODO; chỉ chuyển READY khi các phụ thuộc cụ thể đã DONE và owner/reviewer đã nhận. Trạng thái BOARD không được đổi thẳng sang DOING vì một agent còn rảnh.

**Ánh xạ đề án gốc:** W4-01 → 01A+01B; W4-02 → 02A+02B (02C là hợp đồng hỗ trợ assignment/05/06); W4-03 → 03A+03B; W4-04 → 04; W4-05 → 05; W4-06 → 06; W4-07 → 07; W4-08 → 08A+08B; W4-09 → 09A+09B. W4-00 và W4-GATE là gate điều phối thêm, không phải mã mới trong DOCX.

**Gate cứng:** chỉ mở W4-00 sau C23-11 DONE. Nếu còn bất kỳ nợ C23 nào thì cả giai đoạn B BLOCKED, không có ngoại lệ cho contract/code/test W4. M3 chạy được không thay thế việc đóng nợ.

### B.3. Phân công nhiều agent và ownership

| Agent | Vùng được ghi khi nhận đúng ticket | Khóa / giới hạn |
|---|---|---|
| A-CONTRACT — Quyền lead | `docs/api/contract.md`, `docs/api/openapi.yaml`, quyết định W4-00, mapping test | Contract freeze trước producer/consumer; thay đổi phải báo mọi agent |
| A-DB — Quyền | Migration forward-only, chức năng DB/audit/RLS, test DB được giao | Một writer cấp số migration; **không sửa 001…007 hoặc policies đã áp** |
| A-API — Quyền | DTO/controller/service/worker nghiệp vụ backend, unit/integration tests được giao | Giữ guard người dùng; service account có boundary riêng; không cùng ghi controllers với A-DB |
| A-AUTO — Quyền/Nguyên hỗ trợ | Workflow n8n nghiệp vụ mới, fixtures workflow, tài liệu retry | Không sửa realm/Compose hoặc API/SQL để lách contract |
| A-PLATFORM — Nguyên | Compose, APISIX, Keycloak/service client, import workflow wiring, profile | Không đưa secret thật vào repo; không đổi/xóa realm/volume đang dùng |
| A-WEB — Séc | `TicketListPage.tsx`, `TicketDetailPage.tsx` và test tương ứng | Giữ theme/auth/upload; không viết đồng thời với agent UI khác |
| A-APPROVAL — Séc | Trang queue phê duyệt mới và test riêng sau khi được chốt | Không tự sửa App/Sidebar/shared client |
| A-DATA — Séc | Generator mới, manifest/schema fixture và test riêng | Dataset cô lập; không ghi giả lập vào DB người dùng |
| A-QA — Nguyên | Harness E2E/fault tests, evidence; CI qua integrator | Không intercept nghiệp vụ trong test gắn nhãn real-stack |
| A-ENV — Nguyên/Séc | Script đo/báo cáo profile được giao | Đo thật; không ghi số dự kiến thành số đo |
| A-LEAD / integrator | Shared `App.tsx`, `Sidebar.tsx`, `services/api.ts`, `types/api.ts`, workflow parity và `.github/workflows/ci.yml` | Chỉ một writer, tích hợp theo lượt; test PR trước merge |

**Phân quyền file hạ tầng (bổ sung 02/11 để khỏi đâm nhau):** `Makefile` và `.github/workflows/ci.yml` do **A-LEAD/integrator** giữ; `tools/testing/*` và `scripts/stack-test.mjs` do **A-QA**; `infra/**` (compose, APISIX template, realm) và `scripts/dxdesk.mjs` do **A-PLATFORM**; `scripts/benchmark*` và báo cáo đo do **A-ENV**. Target `make e2e` **chưa tồn tại** trong `Makefile` hiện hành — nó chỉ được coi là có sau khi A-LEAD thêm target và CI chạy thật; W4-08B được phép đề xuất target nhưng không tự sửa `Makefile` song song với agent khác.

**Quy tắc an toàn:** dùng nhánh/worktree riêng nếu cần; không `reset`, xóa nhánh/volume hoặc `stash` trộn công việc người khác; dừng khi có conflict ngoài dự kiến. Với SecNV, theo `origin/main` hiện hành: làm trên `develop-secnv`, chỉ bàn giao chức năng hoàn chỉnh qua `feature/<ten>`; Quyền giữ quy ước nhánh đồng đội. Không push/merge/tag/gửi bên ngoài chỉ vì kế hoạch yêu cầu.

**Dịch vụ agent/model:** ghi model thực dùng trong ticket. Agent không khả dụng hoặc bị chặn permission thì báo BLOCKED; không đổi setting, vượt permission hoặc tuyên bố agent đã sửa. Lead có thể xin người dùng chọn phương án khác.

### B.4. Phụ thuộc và lịch sau khi đóng nợ

```text
C23-11 DONE → W4-00 (chốt 6 ràng buộc B.6.0)
  00 → 01A → 01B
  00 + 01A → 02A → 02C
  00 + 01A → 03A
  00 → 04 → 09A
  01B + 02A + 02C + 04 → 02B
  01B + 02A + 03A + 04 → 03B
  02B + 02C + 03A      → 05
  00 + 02C             → 06
  00 + 01A + 02C + 03A → 07
  01A,01B,02A,02B,02C,03A,03B,04 → 08A
  05 + 06 + 07 + 08A + 09A        → 08B
  09A + 08B + máy 16 GB           → 09B
  toàn bộ 16 ticket               → W4-GATE
```

Đọc theo bảng phụ thuộc ở B.2; sơ đồ chỉ để nhìn chuỗi dài nhất: `00 → 01A → 02A → 02C → 02B → 05 → 08B → 09B → GATE` (8 bậc). Với 3 người, mỗi bậc phải review + CI, chuỗi này **không nén được** bằng cách thêm agent.

**T0** là ngày làm việc đầu tiên **sau khi C23-11 DONE**, được lead ghi vào board. T0 chưa được điền vì chưa có biên bản đóng A. Mốc demo gốc 07/11 và báo cáo 08/11 vẫn dùng để báo trễ, không tự thay bằng ngày mới mà giấu quyết định.

| Mốc tương đối | Kết quả phải có / công việc song song | Gate cuối chặng |
|---|---|---|
| T0 | W4-00; xác nhận scope, reviewer, quyền thao tác và lịch máy | Contract freeze; ticket thực thi đủ dependency mới sang READY |
| T0+1 | 01A; realm/guard 02A theo lượt; chuẩn bị 04/09A, test sớm từ contract | Outbox rollback và quyền service âm/dương đạt |
| T0+2 | 01B, 02C, 04, 03A; UI/seed có thể chuẩn bị với fixture được gắn nhãn | Worker/inbox/claim/team và notification wiring có producer thật |
| T0+3 | 02B, 03B; hoàn thiện 05/06/07/09A theo dependency | VPN assigned đúng team, scheduler/approval/claim có test |
| T0+4 | 08A/08B; 09B sau E2E/profile; sửa bug và review | Candidate SHA, artifact, số đo target và rehearsal |
| T0+5 | Demo cảnh 2, đo ≤60 giây, message thật, restart giữa event | Người khác thực hiện, lưu biên bản; đối chiếu mốc gốc 07/11 |
| T0+6 hoặc khi retest đạt | Sửa blocker, kiểm SHA cuối, báo cáo và W4-GATE | Đóng M3 hoặc công khai thiếu gì; đối chiếu hạn 08/11 |

Đây là khung sắp việc, không cho phép chạy task khi producer chưa DONE; nếu một chặng trễ thì các chặng phụ thuộc dịch theo. Fixture chỉ dùng chuẩn bị, không đóng VERIFY.

**Khả thi — tính thật để báo sớm, không phải để tự an ủi:** tổng ước lượng trong board là **12,5–21 ngày-người**, chưa gồm giai đoạn A và chờ môi trường/BTC. Lịch tháng 11/2026: **02/11 là thứ Hai**, 03–06/11 là 4 ngày làm việc còn lại, **07/11 demo là thứ Bảy**, **08/11 báo cáo M3 là Chủ Nhật**. Ba thành viên có tối đa ~15 ngày-người trước demo gốc, và con số đó **chỉ đúng khi cả 15 ngày dành cho W4** — tức giai đoạn A phải đóng xong trong 02/11, điều phi thực tế vì A có C23-03 (người khác demo), C23-04 (hai reviewer), C23-06 (máy 16 GB) và C23-07 (BTC trả lời). Chuỗi dài nhất của B là 8 bậc `00→01A→02A→02C→02B→05→08B→09B→GATE`.

**Đề xuất ưu tiên khi trễ (chỉ phục vụ demo từng phần; đội phải duyệt thay đổi phạm vi):**

| Nếu T0 rơi vào | Ưu tiên để có demo từng phần | Phần còn thiếu phải công khai | Giới hạn nghiệm thu |
|---|---|---|---|
| 03/11 | Mục tiêu vẫn là toàn bộ B theo board | Rủi ro thiếu thời gian review/CI và máy target | Đây là mục tiêu, không phải cam kết đủ M3 theo lịch gốc |
| 04/11 | Ưu tiên contract, outbox, service boundary, routing, notification và luồng Agent khi đủ dependency | SLA, approval, seed, profile/benchmark hoặc fault matrix chưa đủ phải báo rõ | Không gọi đây là W4-08B DONE: 08B còn cần 06/07/08A/09A; 05 còn cần 03A |
| 05/11 | Chỉ demo các producer và luồng đã kiểm đủ; có thể dừng ở nền outbox/route | Thiếu dispatcher/replay/race/restart là thiếu năng lực và evidence, không chỉ thiếu thời gian chạy test | 02B không READY nếu 01B chưa DONE; không đóng 05/08B hoặc M3 từ demo rút gọn |
| Muộn hơn | Hoãn M3 cảnh 2, hoàn tất A và lập lại lịch B | Ghi rõ ngày thật và tác động mốc gốc | Không cam kết demo khi producer chưa chạy |

Nguyên tắc: dời **chức năng**, không dời **bảo mật, RLS, scan, audit, test âm**; phần thiếu phải ghi vào báo cáo kèm lý do và người quyết định. Thứ tự phụ thuộc B.2/B.4 và DoD B.1/W4-GATE giữ nguyên: demo từng phần không đóng M3 hoặc đổi mẫu số 17. Nếu đội muốn đổi hợp đồng/phạm vi chính thức, ghi quyết định ở C23-11/W4-00 và cập nhật đầy đủ dependency, test và tiêu chí nghiệm thu trước khi thực hiện.

### B.5. Hướng triển khai chi tiết theo ticket

<a id="w4-00"></a>

#### W4-00 — Contract freeze, quyền và các quyết định nghiệp vụ

**Chính:** Quyền; Nguyên/Séc review. **Đầu vào:** baseline, DOCX 5.3, contract hiện hữu. **Chỉ bắt đầu sau C23-11 DONE; không phụ thuộc full W4 code.**

**Trình tự đề xuất:**
1. Ghi phiên bản contract W4 và toàn bộ thay đổi thêm: team/roster/assignment, actor type, outbox/callback, queue server-side, SLA. Lập bảng domain event → audit event → outbox → consumer; audit hiện chỉ `created/status_changed`, nên assignment/notice mới phải có quy tắc event type và migration constraint rõ, không nhét giá trị chưa được DB chấp nhận.
2. Chốt câu nghĩa: `assigned` = được giao **team** hợp lệ; `assigned_to` có thể còn null cho tới khi Agent nhận. Nếu đội muốn tự chọn cá nhân, ghi thuật toán và test riêng; không tự suy ra từ tên Network Team.
3. Chốt bảng team/thành viên được quản lý phía server, UUID lấy từ Keycloak/demo roster. Hiện `routing_rules.team` là tên text; thống nhất mapping/backfill sang team ID, tránh tin UUID tùy ý từ browser.
4. Chốt quyền duyệt: hiện Agent/Manager đều có một số quyền duyệt, chỉ Manager từ chối về `new`. Màn Manager W4-06 **không tự thay** quyền Agent. Nếu đổi Manager-only, phải có quyết định và migration/TS/UI/parity tests đồng bộ, không chỉ ẩn nút.
5. Chốt SLA: đề xuất giữ 24/7 như hiện tại, một policy snapshot mỗi ticket, giữ deadline qua reopen, pause chỉ ở waiting, không xóa breach trước đó. Định nghĩa phản hồi đầu tiên/`response_minutes` riêng; không coi thao tác auto-route là người thật đã phản hồi. Business-hours là scope bổ sung chỉ làm sau quyết định, không ngầm hứa.
6. Chốt contract service identity, đường callback, webhook auth, envelope/idempotency và privacy thông báo. Ví dụ JSON/API ở mục 6 là **đề xuất**, không được frontend gọi trước khi contract được khóa.

- [ ] Owner/reviewer phê duyệt team, assignment, approval, SLA và service boundary.
- [ ] Contract/OpenAPI, ví dụ request/response/error, mapping DB/API/UI và version đồng nhất.
- [ ] Viết test case trước (happy/denied/race/retry); reserve migration mới với A-DB, không sửa SQL cũ.
- [ ] Agent consumer xác nhận đã đọc contract, mọi vấn đề còn mở có quyết định hoặc BLOCKED.

**Bàn giao:** bảng quyết định + mẫu payload + file ownership + contract SHA. **DoD:** không còn câu hỏi làm producer và consumer hiểu khác nhau.

**Hồ sơ chuẩn bị (02/11, chưa có hiệu lực — W4-00 vẫn BLOCKED vì C23-11 chưa DONE):** [w4-quyet-dinh-00.md](w4-quyet-dinh-00.md) gồm 14 phiếu quyết định QĐ-01…QĐ-14 theo mẫu *Vấn đề | bằng chứng file:line | phương án A | phương án B | rủi ro bảo mật/mixed-state | khuyến nghị | file-migration-test phải đổi | người ký*, ma trận test W4-08A 22 ca (T01–T22, ghi rõ ca nào fixture, ca nào cần stack thật), bảng endpoint/envelope/idempotency/ACK đều nhãn **[ĐỀ XUẤT — CHƯA TỒN TẠI]**, 14 câu hỏi H1–H14 cần người trả lời, và **bảng ký còn trống**. Chín ràng buộc mới ngoài 6 mục ở [B.6.0](#b60) mà hồ sơ phát hiện, đáng chú ý nhất: `apps/api/test/workflow.test.mjs:55-72` **parse text của migration 003** và hard-code 17 cạnh nên mọi migration đổi cạnh sẽ làm CI đỏ mà không sửa được 003; `apps/api/src/auth.ts:42` nhúng `validateClaims` trong `JwtGuard.canActivate` nên route service bắt buộc phải là guard + controller riêng; `infra/compose/tn04.yml:32-55` đặt Mattermost ở compose project khác nên n8n gọi `localhost:13002` là **gọi chính nó**; `sla_policies.response_minutes` không có bất kỳ dòng code nào dùng; runner áp `db/policies/*` **sau** `db/migrations/*`.

<a id="w4-01a"></a>

#### W4-01A — DB outbox và audit hệ thống

**Chính:** Quyền/A-DB. **Phụ thuộc:** 00. **File đọc:** schema 001, workflow 003, integrity 005, policies, migration runner. **File mới dự kiến:** migration `008_*` nếu số này vẫn trống; số thật do A-DB cấp sau kiểm tra repo.

**Hướng làm:**
1. Thêm outbox trong schema private, không expose qua PostgREST. Đề xuất cột `id/event_id`, `ticket_id`, `event_type`, `payload`, `schema_version`, `created_at`, `available_at`, `attempts`, `status`, `locked_until`, `delivered_at`, lỗi đã sanitize; index pending/available.
2. Sinh `ticket.created`/`ticket.status_changed` từ audit/trigger có thẩm quyền **trong cùng transaction** với ghi ticket/events. Phủ cả đường API và REST trực tiếp; không chỉ publish ở controller.
3. Thêm actor type `user/system` và service actor identity bằng context tin cậy, không nhận `actor_type=system` từ body người dùng. `actor_id` hiện NOT NULL: chốt UUID của service account hoặc actor registry tương thích trong W4-00, không fallback bot thành requester. Event cũ backfill `user` có giải thích; không xóa event cũ.
4. Thêm unique event key và constraint; thu hồi quyền `authenticated` ghi trực tiếp outbox/audit/system flags. Worker được quyền hẹp, không superuser; SECURITY DEFINER phải pin `search_path`, revoke PUBLIC và không expose RPC private qua REST.

- [ ] Ticket rollback/audit lỗi thì không có event/outbox thừa; commit thành công có đúng envelope.
- [ ] API/REST tạo/chuyển đều enqueue; Employee không sửa actor/delivery state.
- [ ] Migration mới chạy bootstrap + nâng từ DB có ticket/tệp; ledger 001…007 giữ checksum.
- [ ] Test âm, schema/grant/index/docs và contract được review; ghi evidence đúng SHA.

<a id="w4-01b"></a>

#### W4-01B — Dispatcher có lease, retry và replay

**Chính:** Quyền/A-API. **Phụ thuộc:** 01A. **File đề xuất:** worker/outbox module riêng dưới `apps/api/src`, config và tests; wiring `app.ts` do A-API duy nhất.

**Hướng làm:**
1. Claim batch nhỏ bằng row lock/`SKIP LOCKED` + lease có expiry. Commit claim trước HTTP; **không giữ transaction DB khi chờ mạng**.
2. Gửi envelope cùng `event_id`, timeout và auth theo contract; mark delivered chỉ khi ACK đúng event và phía nhận đã lưu/áp dụng durable, không chỉ webhook nhận vào RAM.
3. Retry bounded exponential backoff (đề xuất 1/2/4…60 giây + jitter, số lần cấu hình); log attempt/status/correlation, không token/payload nhạy cảm. Timeout/5xx retry; 4xx cấu hình/schema cần failed/quarantine, không loop vô hạn.
4. Process chết sau claim hoặc sau gửi nhưng trước mark: lease hết thì được gửi lại cùng ID. Sau ngưỡng failed vẫn giữ event để operator replay có kiểm soát, không xóa mất.
5. Shutdown dừng claim mới, không hủy chứng cứ in-flight; restart tự phục hồi.

- [ ] Hai dispatcher không cùng claim hữu hiệu; stale worker không ghi đè kết quả lease mới.
- [ ] n8n down/restart/timeout, mạng lỗi, ACK thất lạc và worker restart không làm mất event đã commit.
- [ ] Có health/metrics pending-age/attempts/failed và thao tác replay giới hạn quyền.
- [ ] Test timing dùng đồng hồ kiểm soát; test stack chứng minh bằng ID thật, không chỉ sleep/retry cho xanh.

**Không hứa exactly-once HTTP:** at-least-once delivery + consumer idempotent; W4-02A/08A chứng minh một hiệu ứng nghiệp vụ.

<a id="w4-02a"></a>

#### W4-02A — Service account, callback và consumer idempotent

**Chính:** Quyền API, Nguyên realm/gateway phối hợp theo file. **Phụ thuộc để DONE:** W4-00, W4-01A; có thể chuẩn bị realm/guard sau W4-00, nhưng không đóng VERIFY trước khi inbox đã tích hợp.

**Hướng làm:**
1. Tạo client Keycloak confidential/service account dành cho automation, audience cụ thể, role/scope hẹp (ví dụ `ticket-automation`). Không cấp Employee/Manager giả cho bot để vượt `JwtGuard`.
2. Thêm guard service riêng xác minh RS256/issuer/audience/expiry/role/client được phép; **không nới `validateClaims` người dùng** cho token lạ. API/gateway bảo vệ route service rõ ràng.
3. Callback đi qua APISIX và API có validation; service không có quyền đọc file/user/profile không liên quan, không được gọi action tùy ý/SQL tùy ý hoặc impersonate Employee.
4. Bảng inbox/idempotency key `(consumer,event_id,operation)` và mutation/audit chạy trong một transaction. Trùng event trả kết quả đã lưu, không đổi row/event lần hai; một event gọi thao tác khác vẫn phải kiểm contract/quyền.
5. Webhook ticket riêng có xác thực header nội bộ hoặc cơ chế service đã duyệt tại 00; **không mặc định `/webhook/*` công khai là an toàn**. Secret qua env/credential store, ví dụ mẫu chỉ ở `.env.example`; không ghi secret thật vào workflow export/ảnh/log.

- [ ] Human token/Employee không gọi được route service; bot không gọi được route/quyền ngoài scope.
- [ ] Sai chữ ký/iss/aud/role/client/expiry/schema bị từ chối; callback không tin actor/header tùy ý.
- [ ] Retry cùng key trả một kết quả/audit; payload khác cùng key bị chặn xung đột.
- [ ] Token refresh, lỗi auth n8n và replay có test; docs hướng dẫn import credential không chứa secret.

<a id="w4-02b"></a>

#### W4-02B — Workflow tự phân loại và giao team

**Chính:** Quyền/A-AUTO; Nguyên hỗ trợ engine. **Phụ thuộc để DONE:** W4-01B, W4-02A, W4-02C và W4-04 cho notification thật.

**Hướng làm:** workflow mới khác `hello.json`: nhận sự kiện đã xác thực → kiểm version/type/id → gọi API route service để áp `routing_rules` phía server → trả ACK sau kết quả durable. API chọn active rule/team, kiểm ticket còn hợp lệ, chuyển theo cạnh hợp lệ `new→triaged→assigned` và audit từng bước. Callback lặp không tạo thêm transitions; event status do chính auto-route sinh ra không kích hoạt loop route lần nữa.

Ticket `access/pending_approval` không được auto-bypass duyệt. Không có rule/team hoạt động thì giữ queue cần can thiệp và báo lỗi có thể xử lý, không gán team giả để đạt SLA demo.

- [ ] VPN được giao đúng Network Team trong 60 giây đo từ timestamp tạo tới commit `assigned`; có ID ticket/event/run.
- [ ] Audit có system actor xác thực; không mất created/history của người dùng.
- [ ] Rule tắt/thiếu/team không hợp lệ, callback trễ khi ticket đã đổi trạng thái được kiểm.
- [ ] Import workflow, restart và retry không nhân đôi assignment; không dựa n8n static memory làm nguồn dedup.
- [ ] Lưu workflow export pinned/naming và hướng dẫn replay/giám sát; tương thích QĐ-4 hoặc ghi BLOCKED.

<a id="w4-02c"></a>

#### W4-02C — Team/roster, queue server-side và nhận việc

**Chính:** Quyền/A-API, A-DB theo migration; Séc consumer. **Phụ thuộc:** 00/02A.

**Hướng làm:**
1. Thêm team/roster + `assigned_team_id` và cơ chế `assigned_to` thực theo quyết định 00, mapping từ seed routing text; roster dựa UUID Keycloak thật, không hardcode subject tùy phiên.
2. Đề xuất mở rộng `GET /api/tickets` với queue/team/status/assignee có allow-list và query tham số, giữ `limit/offset` cũ. Không âm thầm biến filter chỉ-trang ở UI thành tìm toàn hệ thống.
3. Đề xuất `POST /api/tickets/:id/claim`: Agent hợp lệ trong team nhận atomically; server lấy assignee từ token, không tin UUID browser; người thứ hai/stale request →409. Manager reassignment nếu được duyệt ở00 phải có endpoint/audit riêng.
4. Mọi đường cập nhật có row lock/RLS/guard DB; Employee không gán team/assignee qua REST. Chốt read-scope rõ: staff hiện được đọc rộng; queue filter **không thay RLS**. Nếu muốn giới hạn staff theo team phải migration policy và negative tests được duyệt, không tự đổi ở frontend.

- [ ] Queue đúng data/phân trang; input filter lạ/injection bị chặn.
- [ ] Hai Agent tranh nhận chỉ một thắng; cùng người retry có kết quả nhất quán.
- [ ] Assignee/team không hoạt động, không thuộc roster, đổi rule lúc callback đang chạy có test.
- [ ] Employee isolation giữ nguyên; không đứt compatibility API cũ; UI có nhãn người/team từ nguồn thật.
- [ ] Contract + OpenAPI + types/client handoff qua integrator, không nhiều writer shared.

<a id="w4-03a"></a>

#### W4-03A — SLA evaluator và cờ vi phạm

**Chính:** Quyền/A-DB+A-API theo file. **Phụ thuộc:** 00/01A. **Đọc:** `rules.ts`, migration 003/005, test SLA hiện có; không tính deadline bằng công thức khác ở n8n.

**Hướng làm:**
1. Dùng một nguồn tính elapsed/deadline authoritative server: due gốc + pause đã chốt + waiting đang mở; chờ sau khi đã breach không xóa breach, reopen giữ deadline gốc theo W3.
2. Thêm `sla_breached`/timestamp và notice ledger unique theo ticket/policy-version/kind theo contract. Cập nhật cờ/audit/outbox notice cùng transaction; bot không gửi giá trị breach tùy ý từ client.
3. 80% theo **thời gian xử lý có hiệu lực đã trừ pause**, không `0,8 * epoch timestamp`. Evaluator bỏ ticket đóng/hủy/đã giải quyết theo trạng thái chốt; test reopen, pause, threshold đúng bằng 80/100 và cạnh biên.
4. Chốt phản hồi `response_minutes` riêng nếu triển khai; không hiển thị giờ phản hồi hứa hẹn cứng trên UI. Giờ hành chính chỉ thêm khi00 chốt nguồn lịch/múi giờ/ngày nghỉ và test, không scope ngầm.

- [ ] Test clock-controlled nhiều pause/cancel/reopen, bigint→number trong miền an toàn, timezone và điều kiện `>=`/`>` theo contract.
- [ ] Hai evaluator/retry không tạo hai notice/cờ; sửa policy không reset breach ngoài quyết định.
- [ ] Pause trước threshold không báo sớm; breach trước pause vẫn giữ; kết thúc ticket không gửi nhắc mới.
- [ ] API trả status/deadline cần cho UI; migration/test parity/contract được review.

<a id="w4-03b"></a>

#### W4-03B — Scheduler nhắc 80% và báo trưởng nhóm

**Chính:** Quyền/A-AUTO. **Phụ thuộc để DONE:** W4-01B, W4-02A, W4-03A, W4-04.

**Hướng làm:** dùng scheduler/poll định kỳ ngắn có cursor/batch phù hợp, gọi API evaluator, không tạo một Wait node lâu vô hạn cho mỗi ticket nếu không có kế hoạch phục hồi. Ngưỡng từ server; ledger giữ ai cần nhận và trạng thái gửi. 80% tới kỹ thuật viên/team nhận, quá hạn tới trưởng nhóm; không có người/team phải báo cấu hình thiếu và giữ sự kiện có thể replay.

- [ ] Policy demo rút ngắn lưu trong môi trường demo riêng, không sửa production/history; đo rõ tại sao notice tới ở thời điểm đó.
- [ ] n8n restart giữa thời hạn vẫn phát hiện overdue; có bounded catch-up, không bỏ do scheduler bỏ lỡ một tick.
- [ ] Notice không spam mỗi vòng poll, không thông báo sau closed/cancelled ngoài chính sách.
- [ ] Thử timeout/lỗi gửi, audit/send state và replay; message có ticket/correlation nhưng không token, file URL ký hoặc thông tin nhạy cảm.

<a id="w4-04"></a>

#### W4-04 — Mattermost Team Edition, bot và kênh

**Chính:** Nguyên/A-PLATFORM; Quyền tích hợp API/workflow. **Phụ thuộc:**00/QĐ-2/QĐ-4.

**Hướng làm:** chuyển từ PoC tách biệt sang tích hợp M3 tối thiểu: edition miễn phí pinned, storage persistent/readiness, team/kênh Network/Identity/IT Support theo roster, bot/webhook scoped. Thông báo created/assigned/80%/overdue có link app, ID và mức ưu tiên; tối thiểu thông tin ticket, không đưa body/mật khẩu/file vào kênh.

Không ép SAML/OIDC bản trả phí để tick SSO. Nếu TE không đáp ứng SSO, dùng fallback bot-only/tài khoản nội bộ theo ADR0008 và ghi rõ giới hạn; cảnh1demo nhấn DX-Desk/Wiki theo kế hoạch gốc. Không tuyên bố PoC green là notification nghiệp vụ đã chạy.

- [ ] Event ticket thật tới đúng kênh, phân biệt team và escalation recipient.
- [ ] Bot bị giới hạn, lỗi credential/kênh/429/5xx được retry/quarantine có log sạch secret.
- [ ] Restart không mất cấu hình/dữ liệu cần demo; không mở admin/service port ra Internet tùy tiện.
- [ ] Chỉ kết luận một thông báo ngoài hệ thống khi quan sát thực tế. Webhook không hỗ trợ idempotency thì ghi rõ cửa sổ duplicate khi ACK thất lạc; không hứa exactly-once message. Correlation ID và quy trình đối soát bắt buộc.

<a id="w4-05"></a>

#### W4-05 — Bảng việc kỹ thuật viên và nhận/xử lý

**Chính:** Séc/A-WEB; Quyền hỗ trợ contract. **Phụ thuộc để DONE:** W4-02B, W4-02C, W4-03A. **Files:** `TicketListPage.tsx`, `TicketDetailPage.tsx` và test tương ứng; shared API/types/router qua integrator.

**Hướng làm:**
1. Sau khi giai đoạn A và W4-00 đóng, chuẩn bị UI với fixture hợp đồng đã khóa; không gọi endpoint chưa có rồi ghi là đã tích hợp.
2. Thêm view queue “nhóm của tôi/chưa nhận/đang phụ trách”. Dùng filter server-side theo contract; giữ view mặc định hiện tại cho Employee và ghi rõ phạm vi tìm kiếm.
3. Action nhận gọi claim thật, không chỉ đổi chữ trên UI. Khi 409, reload và thông báo người khác đã nhận; không tự ghi đè assignee.
4. Chuyển trạng thái dùng helper hiện có; hiển thị team/assignee/deadline và audit từ API. Không dựng deadline hoặc thời gian phản hồi cố định ở frontend.
5. Giữ theme settings, SSO, attachment upload/retry/download và layout hiện hành. Thay đổi shared components phải có scope được lead giao riêng.

- [ ] Agent nhận → bắt đầu → waiting kèm thông tin cần bổ sung → resume → resolve có note 5–2000 ký tự; người tạo xác nhận closed.
- [ ] Quyền/state machine/DB đồng nhất; ẩn nút không thay kiểm tra server.
- [ ] Loading/empty/error/retry/stale request, duplicate click và timeout không tạo mutation lặp.
- [ ] Desktop, mobile 375 px và landscape; keyboard/focus, không overflow, giữ chức năng theme/upload/download/SSO.
- [ ] Test payload/queue/accessibility và browser thật đạt; không dùng screenshot fixture để chứng minh tích hợp.

<a id="w4-06"></a>

#### W4-06 — Queue Manager duyệt/từ chối ticket

**Chính:** Séc/A-APPROVAL; Quyền backend, integrator shared. **Phụ thuộc:** W4-00, W4-02C. **File mới đề xuất:** `apps/web/src/pages/ManagerApprovalsPage.tsx` và test; route/sidebar do integrator đăng ký sau contract.

**Hướng làm:**
1. Queue server-side `pending_approval`; hiển thị nội dung, trường động, lịch sử và người yêu cầu từ dữ liệu thật.
2. Duyệt → `assigned`, từ chối → `new` theo quy tắc hiện hành hoặc quyết định W4-00. Gửi qua API status hiện có nếu contract không yêu cầu thay; bổ sung kiểm tra stale/row lock khi cần.
3. Phân biệt ticket `pending_approval` với `device_requests.pending`; **không thêm workflow thiết bị/PDF tuần 5 ở đây**.
4. Ticket được duyệt có thể đã ở `assigned` nhưng chưa có team. Routing sau duyệt phải có thao tác gán team hợp lệ mà không tạo lại transition `assigned`; không auto-route ticket còn đang chờ phê duyệt.
5. Thao tác phê duyệt/từ chối cần xác nhận, có lý do và phản hồi lỗi rõ; không dùng webhook notification làm quyền duyệt.

- [ ] Manager nhìn đúng queue, xem lý do, xác nhận action; kết quả và audit phản ánh người thao tác.
- [ ] Hai reviewer quyết định đồng thời chỉ một commit; stale →409/reload; retry không lặp audit.
- [ ] Agent không bị tước quyền hiện hành âm thầm. Nếu W4-00 chốt Manager-only, kiểm API/REST/DB/UI parity tương ứng.
- [ ] Employee và service trái scope không duyệt; không lộ ticket ngoài quyền.
- [ ] Mobile/keyboard/error/empty/loading và regression theme/SSO đạt.

<a id="w4-07"></a>

#### W4-07 — Dữ liệu giả lập có seed và manifest

**Chính:** Séc/A-DATA; Quyền kiểm DB invariants. **Phụ thuộc để DONE:** W4-00, W4-01A, W4-02C, W4-03A. **File mới đề xuất:** `scripts/seed-synthetic.mjs`, test và manifest được kiểm soát phiên bản.

**Hướng làm:**
1. Định nghĩa seed/version/reference-time/timezone cố định; namespace UUID và thứ tự sinh để tái lập.
2. Tạo người dùng demo/nhóm/phòng ban/roster và ticket nhiều tuần: VPN client 4.2, pending approval, waiting/resolved/closed. Subject phải lấy từ realm demo hoặc mapping đã xác minh, không dùng UUID tùy ý làm Keycloak subject.
3. Chuẩn bị số lượng đủ M3; lịch sử 6–8 tuần và KPI 37%/72% thuộc W5-05, không tuyên bố đạt các con số đó khi chưa có generator + test kiểm chứng.
4. Nếu cần fixture dữ liệu lịch sử, dùng đường nạp đặc quyền riêng chỉ trong DB demo cô lập. Không mở API backdate cho người dùng và không sửa lịch sử production.
5. Mỗi lần chạy xuất manifest seed/version/time/namespace/count/hash; cleanup theo namespace do script tạo, không xóa toàn bộ database.

- [ ] Guard chỉ cho DB/project demo cô lập; không tự reset volume người dùng.
- [ ] Cùng seed/version/reference-time và mapping identity cho cùng dataset/manifest; rerun không nhân đôi.
- [ ] Event order, created/status/assignment/SLA nhất quán; không có audit của người dùng giả mạo.
- [ ] Nhãn `[SYNTHETIC]`, manifest nguồn/đếm/checksum và tài khoản demo; không dùng PII thật.
- [ ] Không seed `scan_status=clean` để chứng minh antivirus: tệp E2E vẫn đi qua engine thật.
- [ ] Unit generator/invariant tests và hướng dẫn chạy/dọn/handoff E2E đầy đủ.

<a id="w4-08a"></a>

#### W4-08A — Ma trận lỗi, quyền, retry và đồng thời

**Chính:** Nguyên/A-QA; Quyền review. **Phụ thuộc để DONE:** W4-01A/B, W4-02A/B/C, W4-03A/B, W4-04. Sau khi A và W4-00 DONE, có thể viết thiết kế test trước producer.

**Hướng làm:** mỗi ca fault có điểm tiêm lỗi, event/correlation ID, DB trước/sau, tác dụng phụ mong đợi, lệnh replay và assertion không đổi dữ liệu ngoài phạm vi. Test giả dùng để kiểm lỗi xác định; test stack thật dùng để chứng minh tích hợp và phục hồi.

- [ ] Rollback mutation/audit không để outbox thừa; API và raw REST không bỏ sót outbox hoặc cho giả system/assignee.
- [ ] Hai dispatcher/evaluator; lease expiry; timeout trước/sau ACK; duplicate/reordered events và schema lỗi.
- [ ] n8n down → enqueue → restart → replay: giữ event ID, đúng một hiệu ứng assignment/audit/notice ledger.
- [ ] Hai Agent tranh claim; hai Manager/stale decision; ticket closed/cancelled hoặc access đang chờ không bị callback muộn kéo về assigned.
- [ ] Service token sai role/aud/iss/client, human token gọi callback, roster/routing tắt, Mattermost unavailable/429/5xx và quyền tệp.
- [ ] Clock-controlled 80%/100%, waiting, reopen, closed và policy lỗi; không dùng thời gian fixture để báo thời gian thực.
- [ ] Ghi riêng khả năng duplicate external webhook trong cửa sổ ACK mơ hồ; không hứa Mattermost exactly-once.

**Bàn giao:** bảng fault injection + command + SHA + DB before/after + log đã sanitize; fixture và real-stack tách báo cáo.

<a id="w4-08b"></a>

#### W4-08B — E2E thật, CI và lệnh chạy thống nhất

**Chính:** Nguyên/A-QA; Séc hỗ trợ selector/UX. **Phụ thuộc:** W4-05, W4-06, W4-07, W4-08A, W4-09A.

**Hướng làm:** mở rộng `tools/testing/stack-browser.mjs` và harness thật hiện có. Kịch bản từ browser qua Keycloak/APISIX/API/DB/n8n/Mattermost; không intercept business API hoặc thay auth bằng mock để gắn nhãn real-stack. Tạo `make e2e` hoặc lệnh Node tương đương có docs/CI wiring; chỉ coi lệnh mới tồn tại sau khi được thêm/test.

- [ ] Employee tạo VPN+ảnh → Network Team/assigned ≤60 giây và message thật; kiểm event system/recipient/correlation.
- [ ] Agent nhận/wait/resume/resolve; note thiếu bị chặn; đúng Employee owner mới đóng; Employee khác không đọc.
- [ ] Manager approve/reject; service auth; EICAR/signed download regression; SLA demo 80%/overdue.
- [ ] n8n restart giữa event chờ; `up` lần hai giữ dữ liệu/tệp/queue; không dùng retry che lỗi 5xx kéo dài.
- [ ] Desktop + 375 px/landscape, empty/error/loading, theme modes, keyboard/reduced-motion; lưu screenshot và lỗi console/network.
- [ ] CI đúng SHA, giữ gate cũ hoặc điều chỉnh có review. Artifact có SHA/profile/dataset/test ID, không token/password/TOTP secret/link ký.

<a id="w4-09a"></a>

#### W4-09A — Khung profile full và demo-light

**Chính:** Nguyên/A-PLATFORM; Séc kiểm app. **Phụ thuộc:** W4-00, W4-04.

**Hướng làm:**
1. Lập ma trận `profile → services → ports → readiness → capability → memory cap`. Main Compose hiện chỉ có profile benchmark; `full/demo-light` là phần phải xây, không coi đã có.
2. Runner Node/Make nhận profile thống nhất, sync key và import/publish workflow đúng profile; pin image/version; kiểm `compose config` cho từng profile.
3. Demo-light được tắt tính năng ngoài kịch bản đã chốt, không được bỏ bảo mật hoặc core service để báo RAM đẹp. AI/PoC không dùng có thể không chạy; nếu profile có Ollama, ghi model/capability rõ.
4. Dùng project/volume riêng cho thí nghiệm; tài liệu stop/start giữ dữ liệu, backup/recovery và khi nào phải restart gateway.

- [ ] Cả hai profile đủ M3: DB/RLS/auth/gateway/automation/scan/store và API/web; không bỏ ClamAV rồi vẫn cho upload không scan.
- [ ] Capability không sẵn có thông báo rõ, không có route/badge báo tính năng đang hoạt động giả.
- [ ] Startup/readiness/dependency, key sync, PostgREST/APISIX restart và config checks đều đạt.
- [ ] `up` lần hai không xóa dữ liệu; runbook toggle/recovery có thể làm lại.
- [ ] Memory cap chỉ là cấu hình, không thay số đo W4-09B.

<a id="w4-09b"></a>

#### W4-09B — Đo toàn compose và peak máy demo

**Chính:** Nguyên/Séc/A-ENV; Quyền rà số. **Phụ thuộc:** W4-09A/W4-08B và máy 16 GB thật. Tái sử dụng phương pháp/metadata C23-06, nhưng **đo lượt W4 mới sau tích hợp**; không dùng cùng một lượt đo để vượt thứ tự A trước B.

**Hướng làm:** benchmark hiện snapshot bảy dịch vụ Tầng 1, chưa tính API/web hoặc peak của tích hợp mới. Mở rộng có review hoặc làm script W4 riêng. Lấy mẫu timestamp cho mọi service thực chạy, host/OS/WSL/browser và model nếu profile bật. Đo cold start, warm idle, upload/scanning, queue/SLA và browser hoạt động; lưu rõ interval/window và giới hạn đo.

- [ ] Bảng RAM từng service, tổng host, Docker limit và peak thực; không cộng trùng host/container/Ollama.
- [ ] Full/demo-light cùng SHA/dataset/kịch bản; có JSON/CSV và nhận xét timeout/OOM/degradation thực tế.
- [ ] Vượt khoảng 14 GB thì ghi fallback đã thử theo đề án: profile/model nhỏ hoặc LAN; kiểm M3 vẫn đạt sau thay đổi.
- [ ] Máy RAM khác không thay target 16 GB; vùng peak chưa đo phải được ghi rõ.
- [ ] Reviewer ký báo cáo; thiếu máy/model giữ BLOCKED, không điền số ước lượng.

<a id="w4-gate"></a>

#### W4-GATE — Đóng M3 và báo cáo

- [ ] 16 ticket W4 còn lại DONE, W4-01…09 đều có evidence; không lỗi High/blocker chặn demo.
- [ ] Candidate SHA đã review; CI, E2E, fault injection và số đo/demo đúng phiên bản hoặc có giải thích phần thay đổi chỉ-docs sau kiểm tra.
- [ ] Demo cảnh 2 đủ mục B.1, đo ≤60 giây, notification và audit system; người độc lập thực hiện. Ghi ngày thật, đối chiếu demo gốc 07/11, không ghi lùi ngày.
- [ ] Báo cáo M3 nêu achieved/missing/risk/profile và ảnh hưởng hạn 08/11; chỉ gửi/thao tác remote khi được ủy quyền.
- [ ] Nếu chưa đạt, giữ mở và công khai ảnh hưởng W5; dời ứng dụng 2/LOD theo đề án, không bỏ test/bảo mật hoặc tự tick.

### B.6. Contract kỹ thuật đề xuất cho agent thực thi

<a id="b60"></a>

#### B.6.0. Sáu ràng buộc đã kiểm chứng trong DB/auth — W4-00 BẮT BUỘC chốt trước khi viết code

Những điểm này đọc trực tiếp từ snapshot `72f72d7` ngày 02/11/2026. **Tất cả endpoint/cột ở giai đoạn B đều chưa tồn tại**; nếu agent bắt tay code mà không chốt 6 câu này sẽ phải làm lại từ đầu hoặc vô tình nới bảo mật. Hồ sơ phương án chi tiết: [w4-quyet-dinh-00.md](w4-quyet-dinh-00.md).

1. **Automation không có role hợp lệ để tự route — có tới 4 lớp khóa.** Cạnh `new→triaged`, `triaged→assigned` chỉ nhận `Agent`/`Manager` [db/migrations/003_ticket_workflow.sql:98-101](../db/migrations/003_ticket_workflow.sql#L98-L101); trigger kiểm `realm_access.roles` từ claims; RLS `tickets_update` USING chặn sớm hơn [db/migrations/003_ticket_workflow.sql:231-232](../db/migrations/003_ticket_workflow.sql#L231-L232); pre-request của PostgREST cũng bắt `roles ?| ARRAY['Employee','Agent','Manager']` [db/policies/002_postgrest_claims.sql:37](../db/policies/002_postgrest_claims.sql#L37); API whitelist 3 role [apps/api/src/auth.ts:21](../apps/api/src/auth.ts#L21). Trong khi W4-02A cấm cấp role người dùng giả cho bot và B.9 cấm gán Manager cho bot. → Chọn một: cho service account `Agent` thật (kèm `actor_type=system` để audit vẫn phân biệt), hoặc RPC `SECURITY DEFINER` + guard service riêng và migration thêm role `Automation` vào `allowed_roles` + cập nhật test parity [apps/api/test/workflow.test.mjs:70-72](../apps/api/test/workflow.test.mjs#L70-L72).
2. **`assigned_to` không có grant nào.** `db/migrations/003_ticket_workflow.sql:242` cấp UPDATE dạng **column-level** cho 5 cột, rồi `005_ticket_integrity.sql:68` thu hồi 3 cột → quyền ghi hiệu lực của `authenticated` hôm nay chỉ còn `(status, resolution_note)`. `assigned_to` không có grant INSERT lẫn UPDATE ở bất kỳ file nào → `POST /tickets/:id/claim` (W4-02C) **bắt buộc** đi qua RPC `SECURITY DEFINER` (khuôn mẫu `004:21-55`) hoặc grant mới có điều kiện.
3. **Audit đang gán hành động hệ thống cho người tạo.** `private.audit_ticket_status_change()` dùng `coalesce(private.user_id(), NEW.requester_id)` [db/migrations/005_ticket_integrity.sql:128](../db/migrations/005_ticket_integrity.sql#L128) → system actor vô hình, phá trực tiếp yêu cầu M3 "audit phân biệt tác nhân hệ thống". 005 đã checksum-lock → sửa bằng `CREATE OR REPLACE` trong migration mới, không sửa file 005.
4. **`event_type` bị CHECK khóa 2 giá trị.** [db/migrations/001_schema.sql:66](../db/migrations/001_schema.sql#L66) chỉ nhận `('created','status_changed')` → mọi event assignment/notice phải nới constraint bằng migration forward-only, không nhét giá trị mới vào INSERT cũ.
5. **Hai rủi ro thật của migration mới (đây là mục ĐÃ SỬA sau review chéo 02/11).** Bản cũ của kế hoạch nói "thêm cột SLA mà quên REVOKE thì client ghi được" là **SAI**: grant UPDATE ở `003:242` là column-level, không có grant mức bảng, nên cột mới **mặc định không ghi được** từ `authenticated`. Rủi ro thật đã kiểm chứng là:
   - `SELECT *` trong API [apps/api/src/controllers.ts:83](../apps/api/src/controllers.ts#L83) và `:102-104` → mọi cột mới (`assigned_team_id`, `sla_breached`, `ticket_version`, `actor_type`) **tự động lọt vào payload công khai** của `GET /api/tickets` và `/events` mà không ai sửa DTO/OpenAPI. Hợp đồng sẽ drift bởi migration, không bởi code.
   - `PGRST_DB_SCHEMAS=public` [.env.example:33](../.env.example#L33) → **bảng mới tạo trong `public` tự được PostgREST expose qua `/rest/*`**; nếu migration không đặt bảng ở `private` hoặc không khai RLS + revoke ngay trong cùng migration thì dữ liệu mới lộ. Runner áp `db/policies/*` **sau** toàn bộ `db/migrations/*` [infra/postgres/init/02-migrations.sh:22-48](../infra/postgres/init/02-migrations.sh#L22-L48), nên không được giả định policies chạy trước.
6. **Không có bảng `public.users`** (không tìm thấy trong mọi migration), `assigned_to`/`requester_id` không có FK → team/roster là bảng mới, nguồn hiển thị tên người hôm nay chỉ đến từ claims; UI đang in UUID thô ở `TicketListPage.tsx:434-444` và `TicketDetailPage.tsx:402`. ADR 0002 chỉ cấm bảng user **chứa mật khẩu**, không cấm roster — cần nói rõ để đội không hiểu nhầm.

Kèm theo: `GET /api/tickets` hiện chỉ nhận `limit`/`offset` [apps/api/src/controllers.ts:84-86](../apps/api/src/controllers.ts#L84-L86) (chưa có filter server-side); `infra/apisix/apisix.yaml` là **template** còn `infra/apisix/runtime.yaml` là file sinh ra và bị gitignore [.gitignore:8](../.gitignore#L8) — đổi route service phải sửa template rồi để runner render và restart cổng.

**Chỉ là điểm xuất phát cho W4-00; các API/cột mới dưới đây chưa tồn tại trong repo.** Chốt contract trước khi triển khai, sau khi giai đoạn A đã đóng.

#### B.6.1. Envelope, idempotency và callback

```json
{
  "schema_version": 1,
  "event_id": "<outbox-event-uuid>",
  "event_type": "ticket.created",
  "occurred_at": "<UTC ISO-8601>",
  "ticket_id": "<ticket-uuid>",
  "ticket_version": 1,
  "actor": { "type": "user", "id": "<keycloak-sub>" },
  "payload": { "category_code": "vpn", "status": "new" }
}
```

- `ticket_version` là thứ tự/version theo ticket được chốt trong W4-00, không dựa timestamp đủ chính xác để thay optimistic concurrency. Callback luôn đọc current state và không áp lại event cũ lên trạng thái mới.
- Payload tối thiểu; không JWT, password, file bytes, URL ký hoặc trường nhạy cảm. System actor lấy từ identity/context tin cậy; bot không giả requester.
- Callback đề xuất `POST /api/system/tickets/:id/route`, body `{event_id,schema_version}`. Actor/service client lấy từ token đã xác minh, không từ body.
- ACK `{event_id,result}` chỉ sau durable store/commit; timeout không đồng nghĩa rollback đã xảy ra. Retry cùng ID, đọc kết quả đã lưu.
- Unique delivery `(event_id,destination)` và consumer `(consumer,event_id,operation)`; payload khác cùng key bị từ chối. Không tạo ID mới mỗi lần retry.
- Consumer không đánh dấu done trước side effect: mutation+inbox result+audit cùng transaction. Đích ngoài DB như Mattermost có trạng thái gửi/đối soát riêng.
- Callback không nhận SQL, URL tùy ý, team/assignee chưa xác minh hoặc tập field cập nhật tự do.

#### B.6.2. Queue và assignment

| Thao tác đề xuất | Quyền | Kết quả / lỗi cần test |
|---|---|---|
| `GET /api/tickets?queue=team&status=assigned&limit=25&offset=0` | Agent/Manager theo contract | Dữ liệu server-side; limit/offset cũ vẫn hợp lệ; filter invalid→400 |
| `POST /api/tickets/:id/claim` | Agent thuộc team | Lấy assignee từ sub; retry idempotent; race/stale→409; không thấy→404 |
| Queue `pending_approval` + `PATCH /api/tickets/:id/status` | Giữ quyền hiện có hoặc quyết định W4-00 | Không đổi API status cũ tùy ý; lý do/actor có audit; stale→409 |
| Endpoint evaluation SLA có scope hẹp | Automation service | Server tính thời điểm/notice; client không set breach/actor |

SQL phải tham số hóa; không concatenate filter. Frontend không giả roster hoặc Keycloak subject. Thêm role/group claims thì cập nhật realm mapper/guard/DB/UI/tests cùng contract; không tầng nào tin raw header.

#### B.6.3. Migration, quyền và tương thích

- 001…007 và policies 001/002 đã áp: **chỉ forward-only**. Số migration kế tiếp do A-DB reserve sau kiểm tra repo, không để các agent tự tạo trùng `008`.
- Thứ tự đề xuất: outbox/audit/inbox nền → team/assignment → SLA/notice; chia file theo thay đổi nguyên tử, không buộc đúng ba file nếu review chọn cách khác.
- Giữ data W3 đã có, kiểm bootstrap + upgrade + rerun/checksum + rollback giao dịch. Rollback ứng dụng không xóa migration ledger; sự cố schema cần backup/recovery được duyệt và bản sửa forward.
- Private functions pin `search_path`, revoke PUBLIC và không expose qua PostgREST. Worker/service login quyền hẹp, không superuser/bypass RLS.
- Nếu đổi đồ thị/quyền sau W4-00, test parity đang đọc migration 003 phải kiểm mô hình hiệu lực sau migration mới; đồng bộ API/UI. Không sửa 003 để test qua.

#### B.6.4. SLA và workflow import phải được chốt cụ thể

- W3 đang breach khi `now > effective_deadline`. W4-00 chốt và test cạnh biên đúng 80%, đúng 100% và ngay sau 100%; không tự đổi `>` thành `>=` ở một consumer.
- Chốt unique notice theo vòng đời hay policy-version; default đề xuất không reset notice/breach chỉ vì reopen. Nếu policy được đổi, snapshot/epoch phải có quy tắc rõ và không làm mất breach cũ.
- Khi server/n8n chạy lại mà đã qua cả 80% và 100%: default đề xuất gửi escalation quá hạn, không phát thêm lời nhắc 80% đã lỗi thời; lưu trạng thái skipped/superseded có lý do. Phải được duyệt ở W4-00 trước implementation.
- Nguồn truth của timer nằm phía API/DB; n8n chỉ scheduler/orchestrator. `NOTIFY` nếu thêm chỉ để đánh thức bằng ID; poll backlog lúc startup/reconnect vẫn bắt buộc.
- Publish/import hiện hard-code workflow hello trong Compose/Make/Node. A-PLATFORM phải mở rộng danh sách ID/version workflow W4, import credential trước activation, giữ encryption key ổn định và Make/Node parity. Chỉ thêm JSON vào thư mục chưa chứng minh workflow đã được publish.

#### B.6.5. Sơ đồ file và lệnh test giao agent

Các tên **mới đề xuất** dưới đây chưa tồn tại; W4-00 chốt lại theo convention repo trước khi tạo. Không chép tên vào import hoặc CI rồi coi là đã chạy. `app.ts`, `dto.ts`, `controllers.ts` do A-API giữ một lượt ghi; shared frontend/CI qua integrator.

| Ticket | Đọc và nối vào file hiện có | File mới đề xuất / file agent sở hữu | Kiểm tra tập trung sau khi tạo |
|---|---|---|---|
| 01A | `db/migrations/003_ticket_workflow.sql`, `005_ticket_integrity.sql`, `db/policies/*`, runner migration | Migration số do A-DB cấp; thay đổi integration/migration tests qua lượt QA | Nâng DB có dữ liệu, ledger/rerun/rollback, API/REST audit-outbox |
| 01B | `apps/api/src/app.ts`, `database.ts`, `config.ts` | `apps/api/src/outbox-dispatcher.ts`, `apps/api/test/outbox.test.mjs` | Lease/fencing, timeout, retry, shutdown/restart, hai worker |
| 02A | `auth.ts`, `infra/keycloak/realm-dxdesk.json`, `infra/apisix/apisix.yaml`, credential import | `apps/api/src/automation-auth.ts`, `automation-controller.ts`, `apps/api/test/automation-auth.test.mjs`; schema inbox do A-DB | Human/service JWT sai scope, replay/key reuse, atomic inbox+mutation |
| 02B | `infra/n8n/workflows/hello.json`, `scripts/dxdesk.mjs`, `Makefile`, Compose import service | `infra/n8n/workflows/ticket-routing.json`, test workflow/stack do A-QA | Import/publish đúng ID; route VPN thật, retry không thêm audit |
| 02C | `controllers.ts`, `dto.ts`, `state-machine.ts`, `rules.ts` | `apps/api/src/ticket-assignment.ts`, `apps/api/test/assignment.test.mjs`; migration roster do A-DB | Hai Agent claim cùng ticket, roster/quyền, queue/filter/paging |
| 03A | `rules.ts`, trigger SLA hiện hữu | `apps/api/src/sla-evaluator.ts`, `apps/api/test/sla.test.mjs`; migration marker do A-DB | Đồng hồ kiểm soát, pause/reopen/breach, hai evaluator |
| 03B | Endpoint evaluator contract, workflow import/publish | `infra/n8n/workflows/ticket-sla.json` | Restart qua ngưỡng; recipient/dedup, 80% đã lỗi thời |
| 04/09A | `infra/compose/docker-compose.yml`, `tn04.yml`, `.env.example`, `scripts/dxdesk.mjs`, `Makefile` | Overlay/profile nếu cần sau quyết định; template credential không có secret | Compose config từng profile, healthy/persistence, publish mọi workflow |
| 05 | `TicketListPage.tsx`, `TicketDetailPage.tsx`, test hai trang | Chính hai trang này; shared client/types do integrator | Unit hai trang, test queue/claim, browser thật theo vai trò |
| 06 | `lib/ticketWorkflow.ts` chỉ đọc trừ approved change; API status hiện có | `ManagerApprovalsPage.tsx`, `ManagerApprovalsPage.test.tsx` | Queue, hai quyết định tranh nhau, quyền/reason, 409/reload |
| 07 | Schema/realm/roster đã chốt | `scripts/seed-synthetic.mjs`, `tests/seed-synthetic.test.mjs` | Cùng seed/time/mapping cho cùng manifest, guard DB, không nhân đôi |
| 08A/08B | `apps/api/test/integration.mjs`, `tools/testing/migration-test.mjs`, `stack-browser.mjs`, `scripts/stack-test.mjs`, CI | `tools/testing/workflow-recovery.mjs` nếu cần | Fault matrix/DB assertions; browser real-stack và restart |
| 09B | `scripts/benchmark.mjs`, ADR 0005 | `scripts/benchmark-stack.mjs` nếu cần, báo cáo raw dưới `.local/reports/` | Sampler toàn service/host, peak/window, target 16 GB |

Lệnh tập trung **chỉ sau khi file mới đã được tạo**: từ root repo chạy `node --test apps/api/test/outbox.test.mjs` (sau build API) hoặc `node --test tests/seed-synthetic.test.mjs`; từ thư mục `apps/web` chạy `npm.cmd exec -- vitest run src/test/ManagerApprovalsPage.test.tsx`. Đây là tên file/lệnh dự kiến; writer phải xác minh với implementation thật và lưu output, không báo PASS chỉ từ tên script. Lệnh đã có để kiểm cả package từ root vẫn là `npm.cmd test --prefix apps/api` và `npm.cmd test --prefix apps/web`.

**Bàn giao shared-file patch:** ghi ticket, path, hunk/đề nghị, contract version, consumer ảnh hưởng và test tương ứng. Integrator nhận lượt ghi, áp thay đổi rồi chạy test của cả producer/consumer; agent trang không tự sửa `services/api.ts` hoặc `types/api.ts` đồng thời.

### B.7. Test, nghiệm thu và bằng chứng

#### Những lệnh đã có — baseline bắt buộc

```sh
npm.cmd run build --prefix apps/api
npm.cmd test --prefix apps/api
npm.cmd run build --prefix apps/web
npm.cmd test --prefix apps/web
node tools/testing/check-config.mjs
node tools/testing/run-integration.mjs
node tools/testing/migration-test.mjs
node tools/testing/browser-smoke.mjs
node tools/testing/gateway-test.mjs
```

Full stack theo README/cài đặt: `node scripts/dxdesk.mjs up`, `node scripts/stack-test.mjs --restart-n8n`, `node tools/testing/stack-browser.mjs`, rồi `make up` và `node scripts/stack-test.mjs --verify-preserved`. CI thêm ca W4 qua W4-08B; không ghi `make e2e` đã có nếu target chưa được thêm.

**Môi trường:** Windows dùng `npm.cmd`; native integration có PostgreSQL/PostgREST thật nhưng token RSA fixture và clamd/store giả vẫn phải khai báo. E2E M3 cần Keycloak/APISIX/DB/n8n/Mattermost/scan/store thật. Thiếu Docker tại workspace thì VERIFY trên máy/CI được phép, không tự cài hoặc bỏ gate.

#### Hồ sơ evidence cho mỗi ticket

```text
Ticket / trạng thái / checklist đã tick:
Owner thực nhận / agent-model thực dùng / reviewer:
Contract version / base SHA / branch-worktree / files được ghi:
Migration IDs / phiên bản service / profile / dataset seed-version-reference-time:
Commit / CI run ID / job / dòng PASS hoặc lỗi / artifact:
Lệnh chạy / pass-fail / fixture hay thật / OS và thời điểm ICT:
Kết quả âm / quyền / race / timeout-restart và cách phục hồi:
Blocker / người tháo gỡ / ngày kiểm lại / bước tiếp theo:
PR-review/merge SHA / người xác nhận nghiệm thu / ngày:
```

Ảnh không thay kiểm thử hành vi. Log phải che password/token/TOTP/URL ký/nội dung nhạy cảm; không upload data người dùng lên dịch vụ ngoài để render/chart.

### B.8. Prompt giao việc mẫu — sau khi gate cho phép

```text
Bạn nhận duy nhất ticket <C23-ID hoặc W4-ID> trong docs/ke-hoach-tuan-4.md.
Đọc ticket và mục 0, A.3, B.3, B.6, B.7, contract/OpenAPI, file baseline liên quan.
Với W4: C23-11 phải DONE, W4-00 và các dependency phải có evidence.
Base SHA=<...>; contract version=<...>; worktree/branch=<...>.
Bạn chỉ được ghi <danh sách file cụ thể>. Shared files do <integrator> quản lý.
Nếu dependency chưa đạt: báo BLOCKED, không giả API hay tự bỏ qua gate.
Làm đúng hướng dẫn và đủ ca âm/dương/retry/race, giữ mã W3 và dữ liệu.
Không sửa SQL đã áp, không nới auth/RLS, không hardcode KPI/SLA hoặc secret.
Chạy <lệnh thật liên quan>; báo rõ fixture/real, số pass-fail, lỗi còn lại.
Không commit/push/merge/tag, cài môi trường, đổi permission hay xóa dữ liệu ngoài scope được duyệt.
Nếu task cần CI/realm/config, quyền và phạm vi chính xác phải có trong prompt nhận việc.
Nếu cần đổi contract/shared file: gửi đề nghị cho lead, không tự sửa.
Bàn giao: file+diff, lý do, test/evidence, blocker; không tự đóng DONE.
```

**Wave song song sau gate A:** W4-00 khóa contract → A-DB làm 01A; A-PLATFORM làm 04/chuẩn bị realm; A-API theo lượt 02A →02C/01B; A-QA thiết kế ca test. A-WEB/A-APPROVAL chỉ chuẩn bị theo contract fixture rõ nhãn, không nghiệm thu trước producer. Sau đủ phụ thuộc, A-AUTO làm 02B/03B, A-DATA và UI hoàn thiện, A-QA chạy 08A/08B. Lead tích hợp migration/shared/CI theo lượt. Không chạy bất cứ W4 nào song song nợ C23.

### B.9. Rủi ro và đường lui

| Rủi ro | Cách phát hiện | Xử lý / điều không được làm |
|---|---|---|
| n8n import/restart không ổn | Ghi từng lần lỗi, log và SHA | Hơn hai lần trong W4 hoặc BTC đổi hướng dẫn→QĐ-4; Node-RED ưu tiên, Kestra cần đội chốt; giữ contract/outbox, retest workflow |
| Gateway giữ IP API cũ sau recreate | 502 + upstream No route to host | Dùng runner đã restart PostgREST/APISIX; không dùng retry che lỗi kéo dài |
| Callback trùng/đảo thứ tự | Inbox/delivery key, audit counts | Lock, fencing, idempotency, current-state check; không bỏ audit/constraint |
| Lỗ hổng service account | Test human/service/quyền âm | Guard/scope/DB hẹp, không gán Manager cho bot |
| Thiếu RAM/máy demo | OOM/latency/peak thật | Giữ scan/auth/RLS; fallback đúng đề án; BLOCKED nếu chưa đo |
| Thiếu thời gian | T0 thực muộn, checkpoint chưa đủ | Báo trễ và dời W5 theo quyết định đội; không bỏ gate hoặc tự ghi 100% |
| Hai agent ghi cùng file | Conflict và diff ngoài scope | Dừng, lead ghép có review; không reset ours/theirs làm mất feature |
| Đợi BTC/review | Không có reply/người nghiệm thu | Cả B BLOCKED, tiếp tục ticket C23 độc lập; không ký thay/hồi tố |

**Cập nhật cuối tuần:** `C23 DONE x/12; W4 DONE y/17; nguồn W4 đạt z/9; M3 đạt/chưa đạt; SHA/run/profile/máy/demo/reviewer; T0 thực và ảnh hưởng mốc gốc`. Chỉ công bố 100% khi đủ gate đúng phạm vi, không tính viết kế hoạch là triển khai xong.
