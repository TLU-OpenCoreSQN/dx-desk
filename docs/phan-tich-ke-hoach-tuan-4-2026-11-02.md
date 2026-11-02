# Phân tích kế hoạch tuần 4 và phạm vi thực thi ngày 02/11/2026

**Người lập:** agent `/root/week4_plan_audit`; lead/integrator `/root`. Đây là phân tích kỹ thuật và hồ sơ giao việc, **không phải chữ ký nghiệm thu của Nguyên/Quyền/Séc**.

**Kết luận:** source đã có nền M2 và bản sửa harness; cần sửa các nợ C23 thực tế, giữ regression, rồi xây W4 theo dependency kỹ thuật. Sau khi được nêu các gate bên ngoài, người dùng trả lời **"cứ build sao cho phù hợp với prj, source đã có"**. Chỉ đạo mới cho phép tiếp tục triển khai kỹ thuật dù biên bản đóng A chưa đủ; không thay bằng chứng BTC, người review, máy sạch, máy demo 16 GB hoặc phát hành. Không ghi C23/M3 đạt 100% từ việc build/test hoặc tạo PR.

## Snapshot, nguồn và giới hạn

| Mốc | Giá trị đã đọc từ Git | Cách dùng |
|---|---|---|
| Nhánh Quyền được nhận | `origin/develop-quyennnv`, `c683d2ea20bff82ed86910fa5f3ad855040f8df3` | Nguồn kế hoạch, review và hồ sơ QĐ; không suy đoán nhánh từ tên người |
| Remote main lúc đối chiếu | `7e27ec3b27dbb16a08de775940d285df667e2ef9` | Base tích hợp lúc bắt đầu; không đồng nhất với bản bàn giao cuối |
| Base đầu lượt trên nhánh SecNV | `develop-secnv`, `ed1f1b554fe1e5738281456967966199d76f152c` | Merge nguồn đã nhận; còn thay đổi/test sau mốc này |
| Bản sửa browser-smoke | `cbd9c52` | Đã commit upstream, không còn là bản sửa chưa commit |
| Tài liệu đối chiếu/kế hoạch | `c493b34`, `c683d2e` | Đã track; ghi chú untracked trong baseline là lịch sử |

Đã đọc [kế hoạch tuần 4](ke-hoach-tuan-4.md), [hồ sơ W4-00](w4-quyet-dinh-00.md), [review chéo](review-cheo-2026-11-02.md), `CONTRIBUTING.md` và các đoạn source/SQL/harness làm căn cứ cho các nút thắt. Các số dòng tài liệu trong bảng phát hiện dưới đây tham chiếu **bản nguồn `c683d2e` trước lượt hiệu chỉnh này**; sau sửa phải đối chiếu thêm theo heading/ID, không dựa duy nhất vào dòng.

Agent này không chạy lại bộ test ứng dụng hoặc stack; các số pass lịch sử nằm trong hồ sơ gốc và không được gán cho `ed1f1b5` hay commit con. Kiểm tra công cụ ở lượt này tìm được `docker.exe` trên PATH, nhưng điều đó **không chứng minh daemon, Linux containers hoặc full stack hoạt động**. Không thấy `psql`/`reuse` trên PATH mặc định trong lượt kiểm tra này; lead có thể dùng công cụ đã có ở vị trí khác và phải ghi lệnh thực tế.

Không tìm thấy DOCX đề án được track trong cây nguồn nhận. Nội dung business-hours, phạm vi yêu cầu gốc và các quyết định nghiệp vụ chưa thể tự xác nhận bằng một bản kế hoạch dẫn lại DOCX. Giữ blocker nguồn yêu cầu; tiếp tục kỹ thuật bằng semantics hiện hành và công khai giới hạn.

## Inventory giai đoạn A: 12 ticket, không phải 11

Các trạng thái sau là **công việc còn phải chứng minh**, không phải kết quả mới được nghiệm thu.

| ID | Ưu tiên / dependency | Có thể thực hiện kỹ thuật ngay | Điều kiện chưa thể tự ký |
|---|---|---|---|
| C23-01 | P0, đầu chuỗi | Ghi full SHA/base/diff; rà migration/conflict; lập phạm vi ứng viên | Đội chọn snapshot/version/release scope, reviewer/máy; DOCX hoặc nguồn trích có chủ sở hữu |
| C23-02 | P0, sau snapshot 01 | API/web build/unit; integration/migration; config/audit/REUSE; fixture; gateway/stack nếu môi trường sẵn có | CI/artifact đúng SHA cuối, rà secret; kết quả máy khác không tự gán cho máy demo |
| C23-03 | P0, 01+02 | Chuẩn bị hướng dẫn, checklist, clone/project nghiệm thu riêng | Người ngoài tác giả cài/demo full stack và ghi biên bản máy sạch |
| C23-04 | P0, 01 | Tái hiện finding, sửa nợ M2, unit/integration/negative tests, chuẩn bị review | Hai reviewer con người xác nhận SHA, findings và phân loại M2/W4 |
| C23-05 | P1, 02+04 | Sửa drift docs/ADR/contract theo source, ghi lịch sử và evidence đúng mốc | Chủ TN/ADR xác nhận React fallback, TN-02, scan/download và PoC TN-04 |
| C23-06 | P0, 01+môi trường | Chuẩn bị phương pháp benchmark, metadata, sampler; không điền số giả | Máy target 16 GB, model/digest/quantization, warmup+3 lượt, peak host và review raw |
| C23-07 | P0, BTC | Chuẩn bị câu hỏi hạn/kênh/hồ sơ và n8n/fallback | Người được quyền gửi, phản hồi BTC và kết luận QĐ-4; không suy từ deadline giả định |
| C23-08 | P1, 01+phạm vi board | Board local có đủ 29 ID, owner, dependency, evidence; đối chiếu PR/convention | Chốt local hay GitHub là yêu cầu đóng ticket; nếu yêu cầu GitHub phải có quyền/URL thật |
| C23-09 | P0, 02…08+12 | Chuẩn bị checklist/gói ứng viên theo SHA, kiểm nội dung và hash | Tất cả gate trước có kết luận; gói đúng scope/version, người khác cài gói sạch |
| C23-10 | P0, 09+quyền xuất bản | Chuẩn bị release notes/báo cáo để review | Tag/release version được duyệt và gửi báo cáo bằng kênh đã được giao; yêu cầu PR không tự cấp quyền này |
| C23-11 | P0, 01…10+12 | Lập bảng evidence/missing, phân biệt kỹ thuật M2 và đóng đủ tuần | Không có C23 còn BLOCKED; người chịu trách nhiệm ký kết luận |
| C23-12 | P0, snapshot 01; phát hiện trong lượt 02 | Kiểm patch `cbd9c52`, browser fixture, deviation scan, CI đúng SHA | Review và run xanh trên bản bàn giao; không đòi 02 DONE rồi mới sửa lỗi đang chặn 02 |

Chuỗi đóng đủ A là `01 → 02/04/06/08`, `02+04 → 05`, `02 → 03`, `02…08+12 → 09 → 10 → 11`; `07` chờ phản hồi bên ngoài. C23-12 là vòng sửa/retest của lượt kiểm 02, **không phải cạnh DONE-first từ 02 sang 12**.

## Inventory W4: 17 ticket, ánh xạ 9 mã đề án

Theo chỉ đạo mới, có thể làm kỹ thuật theo bảng dưới trong khi các gate hành chính/nghiệm thu vẫn mở. Producer, schema và contract phải tồn tại thật trước khi consumer được coi là tích hợp. Một ticket chỉ DONE theo DoD gốc; hoàn thành code chuyển REVIEW kỹ thuật.

| ID | Phần bàn giao | Dependency kỹ thuật | Writer theo vai trò |
|---|---|---|---|
| W4-00 | Hồ sơ contract, actor/team/approval/SLA và ownership | Source hiện có, quyết định thực thi được lead ghi rõ; nghiệm thu cuối vẫn chờ điều kiện A | Lead contract; API/DB/UI/platform review |
| W4-01A | Outbox/inbox, system actor/audit, version nền | Contract thực thi | Một writer DB |
| W4-01B | Dispatcher, lease/fencing, bounded retry/replay | 01A | Backend worker |
| W4-02A | Service guard/controller, callback hẹp, atomic inbox | Contract+01A | Backend; platform giữ realm/gateway |
| W4-02B | Route VPN theo rule/team, notification thật | 01B+02A+02C+04 | Automation; không tự sửa shared API/SQL |
| W4-02C | Teams/roster, queues, claim nguyên tử | Contract+02A; migration DB phối hợp | Backend/DB; UI là consumer |
| W4-03A | SLA evaluator, persistent breach, notice ledger | Contract+01A | DB/backend theo file |
| W4-03B | Scheduler nhắc 80%/overdue, catch-up/retry | 01B+02A+03A+04 | Automation |
| W4-04 | Mattermost TE, bot/kênh/network/persistence | Contract, QĐ-2/QĐ-4; hạn chế license/SSO công khai | Platform |
| W4-05 | Queue Agent, claim, trạng thái và deadline/audit | 02B+02C+03A | UI ticket list/detail |
| W4-06 | Manager pending-approval queue | Contract+02C | UI approval; router/client qua integrator |
| W4-07 | Seed/version/reference-time/identity map/manifest | Contract+01A+02C+03A | Data generator; DB invariants review |
| W4-08A | Fault/retry/auth/race/clock matrix | 01A/B+02A/B/C+03A/B+04 | QA; test trước producer được gắn nhãn fixture |
| W4-08B | Browser VPN/approval, real stack, CI | 05+06+07+08A+09A | QA; CI/Makefile qua integrator |
| W4-09A | Full/demo-light matrix, config/startup/recovery | Contract+04 | Platform |
| W4-09B | RAM toàn service/host và peak target | 09A+08B+máy 16 GB thật | Environment/benchmark |
| W4-GATE | M3 demo/report và evidence đủ phiên bản | 16 ticket trên, review và các bằng chứng bắt buộc | Lead + người nghiệm thu |

Ánh xạ giữ nguyên: 01→01A/B; 02→02A/B và 02C hỗ trợ; 03→03A/B; 04/05/06/07 giữ mã; 08→08A/B; 09→09A/B. 00/GATE là gate điều phối thêm. Tổng ước lượng board **12,5–21 ngày-người** là đúng phép cộng, chưa gồm A/chờ phản hồi; không lấy số agent để suy ra thời gian review, máy hoặc CI giảm tương ứng.

## Các mâu thuẫn và cách xử lý

| ID / mức ảnh hưởng | Căn cứ bản nguồn | Nhận định / hành động |
|---|---|---|
| P01 — vòng dependency | Plan:92,128–130,294 | 02 cần harness xanh; 12 lại đòi 02 DONE. Đã sửa plan thành 12 xuất phát từ snapshot và lỗi phát hiện khi đang chạy 02; sửa/retest trước khi đóng 02. |
| P02 — nhầm phạm vi High | Plan:157; review:28,38 | SEC-01 là năng lực W4 chưa có nhưng High chưa xử lý lại chặn A, trong khi A cấm W4. Đã yêu cầu reviewer phân loại M2/W4, giữ finding OPEN và gate W4; không tự hạ mức độ/miễn lỗi hiện hành. Chỉ đạo mới cho phép code kỹ thuật, vẫn không tạo review con người. |
| P03 — lịch rút gọn sai dependency | Plan:518–522 so với :439,443 | Row 04/11 bỏ 03A nhưng giữ05; bỏ07/08A/09A nhưng giữ08B. Row05/11 bỏ01B nhưng giữ02B, còn giảm fault/replay. Đã đổi thành demo từng phần, không đóng ticket thiếu dependency/M3. |
| P04 — stale Git/quyền | Plan:50–51,278,356,373 | Harness đã commit `cbd9c52`, docs đã track `c683d2e`, đã merge `ed1f1b5`. Bảo toàn baseline cũ và bổ sung mốc mới; quyền commit/push/PR đã được yêu cầu, không hỏi lại theo log cũ. |
| P05 — đếm sai | Plan:162 và dòng cuối | 14 finding thực tế là 2 High+5 Medium+4 Low+3 Info; 2+6+5+3 là16. Mẫu tổng cuối phải C23 `/12`, đồng nhất bảng/formula. Đã sửa hai số trong plan. |
| P06 — local board/GitHub | Plan:88,218–220 | Một chỗ cho local, chỗ khác luôn đòi GitHub. Đã yêu cầu ghi rõ scope chọn tại01; không tự đóng GitHub từ file mẫu/PR. |
| P07 — version đặt quá muộn | QĐ-11:437–442; QĐ-12:479–480 | `ticket_version` đặt ở010 trong khi008/outbox và callback cần ngay. Freeze kỹ thuật nên đặt version trong migration nền trước envelope; không phát event với field chưa tồn tại. |
| P08 — replay200/409 | W4-00 endpoint table:579 so với :613 | Trùng ID+payload phải trả200 kết quả lưu, không mutation lại; chỉ key reuse khác payload mới409. Đồng bộ DTO/OpenAPI/worker để retry không bị quarantine sai. |
| P09 — grant đã được bác bỏ nhưng còn lặp | QĐ-05:224–237; migration003:242,005:68 | Cột mới không tự có quyền ghi vì grant hiện hành theo cột. REVOKE tường minh có thể làm phòng thủ; rủi ro thật là cấp quyền mới quá rộng, projection `SELECT *`, hoặc bảng public được grant mà không RLS. Không ghi test/giải thích dựa trên tiền đề sai. |
| P10 — assigned/team và approval | Plan:534 so với :712; QĐ-07:308–310 | `assigned` bắt buộc team xung đột với approval ra assigned chưa team. Chọn kỹ thuật nhất quán: approval chọn team và đổi status cùng transaction; không âm thầm nới invariant hoặc route ticket vẫn pending. Cần ghi semantics rõ trong contract. |
| P11 — definer không thay guard trigger | QĐ-01:94–112; migration005:96–105 | SECURITY DEFINER vượt quyền bảng/RLS theo owner nhưng trigger role-check vẫn chạy. Phải tích hợp context service tin cậy vào guard/mô hình cạnh hiệu lực; không tự gán Agent/Manager, không chỉ viết RPC tự kiểm rồi cho rằng trigger đã được bỏ qua. T19 phải chứng minh. |
| P12 — phân biệt exposure/quyền đọc | Plan B.6.0 mục5; QĐ-05 | Bảng public có thể được PostgREST nhìn thấy theo schema nhưng lộ dữ liệu còn tùy privileges/RLS. Bảng private vẫn cần revoke/execute scope hẹp; không dùng schema name thay kiểm quyền. |
| P13 — nội dung cần kiểm chứng | Review:20,30,32; QĐ-11:452 | Review mục6 dẫn nhầm SEC-06 thay vì05; SEC-02 đề nghị direct grant khác khuyến nghị claim RPC; ví dụ SEC-03 không claims dưới authenticated nhiều khả năng bị RLS/guard chặn, phải tái hiện trước khi gọi exploit. `008_x_v2.sql` sắp trước009 theo từ điển, không phải sau; vẫn cấm file vá tùy tiện và dùng migration kế tiếp được reserve. |

P07…P13 là đề nghị cho lead/owner hồ sơ và writer triển khai, không phải kết quả đã sửa source. Agent này chỉ được ghi plan và báo cáo này; không sửa `w4-quyet-dinh-00.md`, `review-cheo-2026-11-02.md`, API hoặc SQL.

## Mặc định kỹ thuật đề xuất để lead khóa một lần

Các lựa chọn này phục vụ chỉ đạo tiếp tục build theo source. Chúng **không điền chữ ký QĐ của con người**; chủ nghiệp vụ vẫn có thể yêu cầu thay đổi có evidence. Ưu tiên giữ semantics/quyền đã có, tránh thêm quyền hoặc giả danh.

| QĐ | Mặc định thực thi đề xuất | Điều bắt buộc đi cùng |
|---|---|---|
| 01 | B: service guard/controller và private RPC một thao tác route | Xác minh iss/aud/RS256/exp/role/client; Automation chỉ cạnh route; bảo vệ webhook/không Agent hoặc Manager giả |
| 02 | B: claim RPC, lấy assignee từ verified sub | Lock ticket; roster active; same-agent retry200, agent khác409; expected_version nếu dùng phải có một contract duy nhất |
| 03 | B: actor_type user/system và định danh service rõ | Context system chỉ từ đường tin cậy; human thiếu identity phải lỗi, không suy system từ claims rỗng |
| 04 | A: enum audit đóng và payload theo loại | Mapping domain→audit→outbox→consumer; forward constraint migration; timeline hỗ trợ từng loại |
| 05 | B: explicit projections/grants và ledgers private | Kiểm âm cả API/REST; không thêm quyền ghi system flag; tables public phải RLS/grant rõ |
| 06 | A cho W4: teams/members keyed bằng sub thật | Không tạo bảng mật khẩu; kiểm membership phía server, seed dùng mapping verified |
| 07 | A: assigned là team hợp lệ, assignee có thể null | Approval/team atomic; UI nói chưa nhận thay vì chưa gán team khi đã assigned |
| 08 | B: routing_rules.team_id + backfill fail-closed | Không khớp team thì rule inactive/cần can thiệp; không tự gán team giả |
| 09 | A: giữ quyền duyệt Agent/Manager hiện có | Manager queue không tự thu hồi quyền Agent; Manager-only là thay đổi nghiệp vụ riêng |
| 10 | A: 24/7, waiting pause, reopen giữ deadline/breach | 80% `>=`; breach `>` deadline; overdue catch-up thay nhắc80 đã lỗi thời; không gọi auto-route là phản hồi người thật |
| 11 | B: một writer DB, migrations theo nền→team→SLA | Reserve sau kiểm repo; version phải có từ nền; không sửa001…007/policies đã áp |
| 12 | B: trigger version + durable ACK/inbox | Giữ event_id qua retry; lease fencing; same-key different payload409; không hứa exactly-once HTTP/chat |
| 13 | A: giữ staff-all RLS, queues là filter server | Allow-list/SQL parameters; Employee isolation; UI không nói filter trong trang là toàn hệ thống |
| 14 | B: parity từ DB sau mọi migration | Unit thuần TS; integration so1:1 effective graph; không sửa003/nới `>=17` để test qua |

Contract tối thiểu cần thống nhất trước consumer:

| Thao tác | Request/quyền | Semantics cần khóa |
|---|---|---|
| `POST /api/system/tickets/:id/route` | Service token, `{event_id,schema_version}`; không nhận team/to_status/actor tự do | Server chọn rule active; route/audit/inbox cùng transaction; exact replay200 stored; payload conflict409; closed/cancelled/pending không bị auto-bypass |
| `POST /api/tickets/:id/claim` | Agent trong team; assignee từ sub | Ticket assigned+team; race409; cùng người retry không thêm audit; body/precondition đồng nhất DTO/OpenAPI/UI |
| `GET /api/tickets` mở rộng | `queue=my_open|team_unassigned|team_assigned|pending_approval`, `status/team_id/assignee_id`, limit/offset cũ | Server filters tham số hóa; giữ tương thích response; queue không đổi RLS |
| Endpoint evaluation SLA scope hẹp | Service; server tự đọc clock/policy | Cờ+notice+outbox atomic, clock controlled; không nhận breach/actor/time tùy ý từ browser |

Không có bảng users nội bộ là điều kiện thiết kế roster, không phải lỗi bảo mật phải sửa bằng đồng bộ toàn bộ Keycloak ngay trong W4. Không triển khai business-hours, AI/RAG, Wiki SSO đầy đủ, thiết bị approval/PDF, Metabase dashboard hay KPI W5 chỉ để làm đẹp checklist W4.

## Phân công thực nhận và thứ tự thực hiện

| Agent thật / vai trò | Phạm vi trong lượt | Handoff / kiểm tra |
|---|---|---|
| `/root` — lead/integrator | Git trên develop-secnv; contract thực thi; shared App/Sidebar/client/types/CI/Makefile và hồ sơ theo phân công; ghép patch, build/test, push/PR | Một writer mỗi shared file; ghi SHA cuối, trạng thái CI và thiếu evidence; không tự merge hoặc ký người review |
| `/root/backend_platform_audit` — backend/platform | Finding C23 và producer W4 được lead giao theo danh sách path cụ thể | API/DB/realm/gateway phải có boundary; không tự đánh số migration hoặc ghi shared file ngoài scope |
| `/root/ui_review` — UI/parity | UI/harness parity và consumer W4 lead giao theo path cụ thể | Nối contract thật; regression theme/SSO/upload/download; fixture ghi đúng nhãn |
| `/root/week4_plan_audit` — audit kế hoạch | Chỉ `docs/ke-hoach-tuan-4.md` và báo cáo này | Lead rà các sửa gate/dependency và mặc định đề xuất; không commit/push |

Danh sách file chính xác cho backend/UI do prompt lead cấp và PR diff kiểm lại; không gán một người con người đã nhận việc chỉ từ tên vai trò. Model không được override ở lượt phân công; tên model cụ thể không được công cụ liệt kê xác nhận nên không tự ghi một nhãn model giả.

Thứ tự ưu tiên thực thi:

1. Tích hợp source trên develop-secnv, tái kiểm browser fix; sửa lỗi hiện hành như MIME parity, body-size413, health/webhook throttling và thiếu metadata vận hành theo kết quả audit/source. Giữ hoặc thêm test có khả năng bắt regression tương ứng.
2. Khóa contract thực thi và một writer DB/API/platform. Làm outbox/actor/version/inbox nền, rồi service identity, routing/roster/claim và SLA. Frontend/data chỉ chuẩn bị fixture gắn nhãn khi producer chưa có.
3. Nối dispatcher/workflows/notification/network/import, UI/seed; chạy fault/auth/race và browser thật theo đủ dependency. Không chấp nhận workflow JSON chưa publish hoặc PoC Mattermost như bằng chứng notification sản phẩm.
4. Build/test và CI trên SHA cuối; nhánh feature chỉ chứa phạm vi có thể review được, ghi rõ phần kỹ thuật/ngoại lệ và gate chưa đạt. Push develop-secnv và PR main theo yêu cầu người dùng; không gọi PR mở là đã merge/nghiệm thu.
5. Tiếp tục thu evidence con người/BTC/máy/demo/release. Nếu thiếu thì báo missing cụ thể, không kéo dài một định nghĩa 100% không có dữ liệu.

## Evidence còn phải thu và điều không suy ra từ ủy quyền

| Evidence / quyết định | Người hoặc nguồn cần có | Không thể thay bằng |
|---|---|---|
| DOCX hoặc trích yêu cầu có nguồn, release scope/version | Người giữ đề án và người chịu trách nhiệm phát hành | Bản kế hoạch dẫn lại đề án; version do agent tự chọn |
| C23-03 người khác cài/demo | Người ngoài tác giả, máy/project/volume riêng | Browser fixture/native portable hoặc agent tự xem ảnh |
| C23-04 hai review và disposition finding | Reviewer con người ký đúng SHA/PR | Agent audit hoặc bảng phân công trống |
| TN-05 target16GB và peak | Chủ máy, raw JSON/CSV, reviewer | Docker CLI có trên PATH, RAM limit, snapshot hoặc CI runner |
| BTC hạn/kênh/hồ sơ và n8n/QĐ-4 | Phản hồi có ngày/người nhận và kết luận owner | Giả định17:00 06/12/2026 hoặc license interpretation của agent |
| Tag/release/báo cáo gửi | Quyền thao tác, version/SHA được duyệt, URL/hash/thời gian thật | Quyền push feature/PR; bản release notes chưa công bố |
| M3 ≤60giây, Mattermost thật, recovery | Stack đủ service, timestamp/correlation, độc lập demo | Unit test, seed set assigned hoặc webhook hello200 |

Số liệu trạng thái hợp lệ sau lượt triển khai là: **C23 DONE x/12; W4 DONE y/17; nguồn W4 đạt z/9; build/test/CI đúng SHA; gate bên ngoài đạt/thiếu**. Chỉ đạo tiếp tục kỹ thuật không đổi các mẫu số hoặc tự điền x/y.
