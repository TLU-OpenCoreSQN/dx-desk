# Kế hoạch xử lý vấn đề, issue và nghiệm thu DX-Desk

**Ngày lập:** 17/11/2026, giờ Việt Nam (ICT). **Phiên bản:** đề xuất v1, chưa phải cam kết/phân công đã được cả đội duyệt.

**Cập nhật triển khai 18/11:** đã pull nền main vào `feature/w6-plan-20261118` và triển khai/kiểm thử local các phần F01, #52/#53, test #58 và công cụ #54/#61/#62. Xem [báo cáo thực hiện](bao-cao-thuc-hien-plan-w6-2026-11-18.md) để phân biệt phần đã có mã/bằng chứng với gate còn chờ; chưa commit/push, chưa đóng issue hoặc xác nhận M5. Nội dung v1 bên dưới giữ làm baseline lịch sử, không coi các dòng “chưa có” là hiện trạng sau triển khai.

**Baseline:** `origin/main` = `27d36a6bc0f3d88288be2018a53e982b003c6e78`; [CI #170](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/44094389209) đã thành công. PR #66, #67 và #68 đã merge; #51 đã đóng. Hiện còn **11 issue mở: 10 việc M5 và 1 nợ SLA của M3**; không có PR mở tại lần đối chiếu.

**Phạm vi của tài liệu:** lập kế hoạch, không triển khai code, không đổi quyền GitHub, không tạo/đóng issue, không mua VPS, không gửi thông báo ra ngoài. Bản sửa chưa commit của người dùng tại `docs/ke-hoach-tuan-4.md` được giữ nguyên. Nội dung và đường dẫn mã dưới đây được đối chiếu trên main, không lấy checkout cũ `develop-quyennnv` làm trạng thái sản phẩm.

## 1. Kết luận và mục tiêu

1. Không viết lại phần AI/Wiki/module đã merge. Bổ sung những phần thực sự thiếu và bằng chứng nghiệm thu.
2. Sửa trước lỗi loader cấu hình làm toàn bộ web chờ vô hạn khi request treo, dù CI hiện xanh.
3. Đường găng chức năng là **cấu hình doanh nghiệp #52 → workflow #53 → nghiệm thu TN-07**; đường găng AI là **công cụ #58 + đo tài nguyên #54 → đánh giá #61/#62 → chốt QĐ-5**.
4. Khởi động hạ tầng Internet #56 và việc xin xác nhận n8n/BTC ngay, không chờ xong code vì có thời gian chờ bên ngoài.
5. **Không mặc định làm email #65.** Đội phải quyết định qua #64 trước hết 19/11, đúng điều kiện của issue.
6. M5 mục tiêu 22/11; không tự coi toàn bộ việc sẽ kịp nếu thiếu máy, reviewer, quyền hạ tầng hoặc văn bản bên ngoài.

### Kết quả mong muốn ở M5

- Web không bị kẹt vô thời hạn vì tải cấu hình; các luồng hiện có không hồi quy.
- TN-07 chứng minh tùy biến danh mục/trường, định tuyến và SLA bằng cấu hình, không sửa mã/build lại.
- Công cụ AI giữ quyền người hỏi; ghi dữ liệu phải có xác nhận; có chấm điểm mô hình và đo RAM thực tế.
- Có phương án Internet được kiểm thực tế, sao lưu và khôi phục đã thử; phạm vi AI cục bộ/Internet được ghi rõ.
- Nợ SLA, máy sạch, giấy phép và review có kết quả hoặc blocker có người phụ trách, không được che bằng checkbox.

## 2. Nguyên tắc đóng việc và bằng chứng

**Trạng thái:** `TODO → IN_PROGRESS → REVIEW → ACCEPTANCE → DONE`; thiếu máy/dịch vụ/quyết định thì ghi `BLOCKED`, không ghi DONE.

Một việc DONE khi đủ tiêu chí riêng và các điều kiện dùng chung **có liên quan**. PR/CI/test/máy sạch áp dụng cho việc kỹ thuật; quyết định #64, hồ sơ BTC và thông báo bàn giao dùng biên bản/xác nhận phù hợp, có thể ghi N/A kèm lý do cho mục không áp dụng. Máy sạch vẫn là gate kỹ thuật đóng mốc, không vì N/A của việc hành chính mà bỏ qua.

- [ ] Phạm vi và thay đổi contract đã thống nhất với bên dùng.
- [ ] Có test dương/âm và kiểm thử hồi quy liên quan.
- [ ] PR có ít nhất một reviewer độc lập; CI xanh trên đúng SHA bàn giao và SHA main sau merge.
- [ ] Có nghiệm thu chức năng thật phù hợp, không chỉ build/unit test.
- [ ] Tài liệu/OpenAPI/notices/REUSE được cập nhật khi cần.
- [ ] Có biên bản chạy máy sạch theo yêu cầu đóng mốc; một lượt chung được dùng cho nhiều issue nếu ghi rõ phạm vi và cùng SHA.

**Mẫu bằng chứng:** mã việc, SHA đầy đủ, profile, máy/OS/Docker/Node, model tag+digest nếu có, lệnh, thời gian ICT, kết quả từng assertion, ID ticket/event đã sanitize, log/ảnh/video, người chạy và người xác nhận. Báo lỗi là báo lỗi, không thay bằng số ước lượng. Không commit `.env`, mật khẩu tạm, token hay PII.

**Giới hạn dữ liệu:** chỉ dùng người dùng/ticket giả trong realm, DB và Compose project thử riêng; không dùng dữ liệu vận hành thật. Test có ghi dữ liệu phải chỉ rõ môi trường và được đồng ý trước khi chạy.

## 3. Danh mục đầy đủ và trách nhiệm

Người phụ trách các issue dưới đây lấy từ GitHub; người hỗ trợ và reviewer là đề xuất, cần đội xác nhận lịch. Quyền = `itsthquyen`; Nguyên = `Enrique-Nguyen`; Séc = `vansec0812`.

| Mã | Trạng thái thực tế | Chủ trì / hỗ trợ đề xuất | Phụ thuộc chính | Đầu ra để đóng |
|---|---|---|---|---|
| F01 — lỗi loader | Đã tái hiện, đã có trên main qua #68; chưa có issue riêng | Séc / Quyền review | Không | Hotfix + test request/body treo + browser |
| [#52](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/52) W6-12 | Chưa có config apply; đã có runtime modules.json từ #68 | Quyền / Séc | Chốt một nguồn cấu hình | Schema, apply idempotent, TN-07 |
| [#53](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/53) W6-13 | Workflow vẫn ở infra/n8n | Nguyên / Quyền | Hợp đồng thư mục từ #52 | Nạp cấu hình workflow, reload/restart |
| [#58](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/58) W6-02 | Đã có mã công cụ; còn checklist/đối chiếu nghiệm thu | Quyền / Séc | Main AI hiện có | Contract, RLS âm/dương, xác nhận ghi |
| [#62](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/62) W6-08 | Đã có lưu/duyệt đề xuất; thiếu TN-06 | Quyền / Séc | #58 và môi trường AI | 20 mẫu, ≥16/20 phân loại đúng, audit |
| [#54](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/54) W6-14 | Đã đo stack chưa nạp model; thiếu full AI | Nguyên / Séc | Máy demo, model và stack full | RAM/TTFT thực, đầu vào QĐ-5 |
| [#61](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/61) W6-05 | Chưa có đủ bộ đánh giá/chốt model | Quyền / Séc | #54, công cụ #58 | 10–15 câu, 2–3 model, ADR 0005 |
| [#56](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/56) W6-06 | Chưa có bằng chứng hoàn tất Internet | Nguyên / Quyền | VPS/DNS/HTTPS; #52 cho cấu hình cuối | Truy cập ngoài đội + backup/restore |
| [#55](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/55) W6-15 | Chưa có script nhập CSV | Nguyên / Quyền | Mapping role/team, quyền admin | Dry-run, 50 người, rerun an toàn |
| [#17](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/17) W4-03 | Nhắc SLA đã chạy; chưa gửi đích danh trưởng nhóm | Quyền / Nguyên | Quyết định trưởng nhóm | Mention/recipient đúng hoặc đổi yêu cầu có xác nhận |
| [#64](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/64) QĐ-6 | Chưa quyết định email, hạn 19/11 | Quyền / cả đội | #52 đã merge, W6-08 đã chạy, không lỗi chặn demo | Quyết định có/không được ghi |
| [#65](https://github.com/TLU-OpenCoreSQN/dx-desk/issues/65) W6-07 | Tùy chọn, chưa được bật phạm vi | Quyền / Nguyên | #64 = Có, #53, service contract | Email → đúng requester, thiếu trường WAITING_USER |
| F02 — bảo vệ/review | Main protected=false; #66/#67/#68 không có approval GitHub | Nguyên/quản trị repo / cả đội | Quyền quản trị và đồng ý của chủ kho | Quy tắc được duyệt, review có bằng chứng |
| F03 — máy sạch/release | v0.5.0 đã phát hành; thiếu máy sạch độc lập | Người không viết Compose chạy / Nguyên hỗ trợ | Máy sạch, SHA chốt | Biên bản độc lập, cập nhật release checklist |
| F04 — n8n/BTC | Chưa có văn bản xác nhận được lưu trong repo | Nguyên / Quyền | Phản hồi BTC/thầy | Văn bản phù hợp hoặc blocker/đường dự phòng |
| F05 — tài liệu/Git | README lệch AI, nhánh cũ và tracking refs cũ | Quyền / Séc review | Baseline hiện tại, bảo toàn sửa local | Tài liệu đúng + phân loại nhánh, không mất công việc |
| F06 — nghiệm thu M5 | Chưa có lượt nghiệm thu tích hợp cuối | Cả đội / reviewer chéo | Các gói bắt buộc | Hồ sơ M5 theo đúng SHA |

## 4. Thứ tự và song song

```text
F01 hotfix ----------------------> smoke giao diện --------------------> F06
#52 hợp đồng + apply ---> #53 ----> TN-07 ------------------------------> F06
#58 công cụ -----------> #62 TN-06 --------------------+
#54 máy/model ---------> #61 đánh giá + QĐ-5 -----------+---------------> F06
#56 VPS/DNS/HTTPS --- song song --- cấu hình cuối #52 + backup/restore --> F06
#55 CSV -------------- dùng chung mapping role/team của #52 ----------> F06
#17 quyết định lead --> thông báo đúng/test ---------------------------> F06
F02 review, F03 máy sạch, F04 BTC, F05 docs chạy xuyên suốt
#64 quyết định 19/11 ---- Có: #65; Không: ghi dời phạm vi, không triển khai
```

Có thể viết schema, chuẩn bị bộ câu hỏi và cấp VPS song song với hotfix. Không cần chờ #52 để xin VPS/tải model; chỉ nghiệm thu cuối Internet/config mới phụ thuộc phiên bản #52. Không cần chờ benchmark xong mới soạn câu hỏi; chỉ chốt model cần số đo #54.

## 5. Chi tiết các gói thực thi

### 5.1. F01 — Khắc phục treo tải cấu hình module

**Căn cứ:** [config.ts:38–50](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/apps/web/src/modules/config.ts#L38), [ModuleContext.tsx:26–42](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/apps/web/src/modules/ModuleContext.tsx#L26), [App.tsx:83–90](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/apps/web/src/App.tsx#L83). Đã tái hiện Promise pending với header/body bị treo bằng loader từ blob; chưa tái hiện toàn SPA trong browser.

**Các bước:**
1. Khi được giao triển khai, tạo issue bug riêng liên kết #68; không mở lại #51 chỉ để làm mất dấu chức năng đã hoàn thành.
2. Chốt deadline tải cấu hình, đề xuất ban đầu 5 giây; deadline phải bao trùm cả fetch và đọc JSON body, không chỉ nhận header.
3. Hủy request khi timeout; dùng fallback bật module hiện đã công bố; kết thúc trạng thái loading. Không thay chính sách phân quyền hay dựng thêm cơ chế cấu hình ngoài phạm vi.
4. Test: request không trả header, header 200 nhưng body không kết thúc, 404/500, mạng reject, JSON lỗi, JSON đúng, tải thành công trước deadline; đảm bảo timer được dọn.
5. Browser: trang chủ công khai, /du-lieu, đăng nhập và deep link; sau lỗi cấu hình UI vẫn dùng được; config hợp lệ vẫn tắt menu/route devices.
6. Chạy web tests/build, smoke desktop/mobile và CI; review/merge như hotfix nhỏ.

**Đóng khi:** không có spinner vô hạn trong hai ca treo; không phá fallback cũ; có test và ảnh/log browser. Nhánh đề xuất `fix/module-config-timeout`, không tự tạo trong lượt lập kế hoạch.

### 5.2. #52 — Cấu hình doanh nghiệp và TN-07

**Hiện trạng:** lệnh `config` chỉ chạy Compose validation; chưa có schema/cau-hinh.json. Module runtime đã có `config/doanh-nghiep/modules.json`. Issue mô tả “chưa có config/” đã lỗi thời sau #68.

**Các bước:**
1. Chốt format có version, mã danh mục ổn định, trường động, mã nhóm, routing, SLA theo priority và module bật. Mã nhóm/người dùng trong file cấu hình dùng mã nghiệp vụ, resolve sang ID thực khi áp dụng.
2. Dùng `config/doanh-nghiep/cau-hinh.json` làm **nguồn chuẩn**; `modules.json` là projection tạo ra để frontend đọc, không để hai nơi cùng được sửa độc lập. Module core luôn bật; mã module lạ phải bị từ chối ở apply.
3. Thêm `config/schema.json`, ví dụ cấu hình phản ánh hiện trạng; giữ nguyên `node scripts/dxdesk.mjs config`; bổ sung `config apply` đúng yêu cầu issue. CLI chạy bằng quyền quản trị được cấp, không đưa bí mật hoặc quyền admin vào frontend.
4. Preflight toàn bộ: JSON/schema, khóa trùng, field type/required, nhóm tồn tại và hoạt động, priority hợp lệ, thời lượng SLA, module IDs. Có lỗi thì chưa ghi.
5. Upsert DB trong **một transaction** theo khóa nghiệp vụ; không sửa migration cũ, không xóa danh mục/ticket vì bị bỏ khỏi JSON. Vô hiệu hóa phải tường minh. Giữ cả team_id và tên team nhất quán với schema hiện có.
6. SLA hiện theo priority, không tự mở rộng thành SLA theo danh mục. Ticket đã tạo giữ clock nghiệp vụ hiện hành; nghiệm thu SLA mới trên ticket mới.
7. Tạo projection module và publish có kiểm soát sau DB commit. DB và filesystem **không có transaction chung**: nếu publish lỗi phải trả lỗi rõ, giữ file cũ hợp lệ, hướng dẫn chạy lại idempotent; không báo thành công toàn bộ. Không thêm bảng version/hash nếu chưa thật sự cần.
8. Nếu dùng ghi file tạm rồi rename, kiểm tra mount thư mục thay vì bind-mount một file để web đọc được inode mới. Tải lại trang để nạp cấu hình; không hứa cập nhật tức thời trong tab đã mở.
9. Nối form hiện có ở `apps/web/src/modules/desk/pages/CreateTicketPage.tsx`; không tạo form/API trùng. Cập nhật docs và kiểm schema trong CI bằng thay đổi pipeline được chủ kho duyệt ở bước triển khai.

**Ma trận nghiệm thu:**
- TN07-01: thêm “Cấp thiết bị ngoại vi”, field `asset_code` bắt buộc; form hiển thị sau apply/reload, không sửa mã/build lại; thiếu field bị UI và API từ chối.
- TN07-02: ticket mới vào đúng team; policy priority mới cho deadline đúng; không ngầm đổi SLA ticket cũ.
- TN07-03: apply hai lần không tạo trùng/không đổi trạng thái DB ngoài dự kiến.
- TN07-04: cấu hình sai và lỗi SQL giữa transaction không ghi một phần DB.
- TN07-05: lỗi publish projection được báo và retry phục hồi; không tuyên bố DB+file atomic.
- TN07-06: tắt devices → menu, shortcut, route biến mất sau reload; bật lại không build.

**Đóng khi:** đủ TN07-01…06, quyền/RLS cũ giữ nguyên, review và CI theo SHA. Phạm vi dự kiến: config/schema, cau-hinh/modules, scripts/dxdesk, Compose mount, test, docs; migration mới chỉ khi thiếu quyền/thao tác quản trị thật sự cần và được review.

### 5.3. #53 — Workflow từ thư mục cấu hình doanh nghiệp

**Các bước:**
1. Dùng đúng đường dẫn issue `config/doanh-nghiep/workflows/`; không tự đổi sang cấu trúc khác hoặc tạo hai bản workflow khác nhau.
2. Chốt di chuyển nguồn chuẩn sang thư mục này; container vẫn dùng `/import/workflows`, cả import và publish mount cùng nguồn.
3. Preflight JSON, ID ổn định/trùng, thư mục thiếu/rỗng và quyền đọc **trước khi dừng n8n**; giữ quy tắc workflow được bật khi automation on/off.
4. Giữ tương thích `make up`, `node scripts/dxdesk.mjs n8n-reload` và import credentials; không tự xóa workflow đang có vì vắng trong file.
5. Test reload hai lần không nhân bản; JSON lỗi không gây dừng dịch vụ; restart n8n không mất effect đã commit; thử đường dẫn Windows có khoảng trắng.
6. Cập nhật REUSE, docs, Compose; chỉ xuất workflow từ UI về file nếu còn thời gian, không phải gate bắt buộc.

**Đóng khi:** thư mục chuẩn dùng thực tế, `node scripts/stack-test.mjs --restart-n8n` đạt cùng các workflow M3/thiết bị đang dùng. Nếu đội duyệt thu hẹp #52 và giữ workflow ở infra/n8n thì ghi đây là **dời/giảm phạm vi**, không báo đã hoàn thành nguyên yêu cầu #53.

### 5.4. #58 — Công cụ AI theo quyền người hỏi

**Hiện trạng:** `apps/api/src/assistant-tools.ts`, `apps/assistant/chat.mjs`, migration 025 đã có. Không dựng lại một lớp tool/framework mới.

**Các bước:**
1. Lập bảng tool thực tế → schema tham số → role → read/write → endpoint → test. Đối chiếu tìm Wiki trong pipeline RAG với tool tìm Wiki của yêu cầu; nếu không tương đương phải bổ sung tối thiểu hoặc ghi quyết định thay phạm vi, không tự tick.
2. Giữ SQL tham số, allowlist tool, token người hỏi, `Database.asUser`; không cho mô hình tự sinh SQL hay dùng một token Manager chung.
3. Test Employee A/B qua APISIX: tìm ticket và số liệu không lộ dữ liệu ngoài quyền; Agent/Manager theo đúng scope được contract cho phép, không tự đặt lại RLS.
4. Test ghi: chưa xác nhận thì DB không thay đổi; hủy không ghi; xác nhận đúng owner+args; đổi args hoặc dùng proof/token khác bị từ chối; retry không nhân đôi ticket/task.
5. Kiểm tra `create_task` chỉ Manager; actor AI và người xác nhận được lưu đúng; API trả lỗi có kiểm soát khi model/tool unavailable.
6. Đồng bộ contract/OpenAPI và bằng chứng vào issue. Tách test dependency giả với runtime qua APISIX thật.

**Đóng khi:** đủ tool hoặc có phạm vi được đội chấp nhận, test cô lập dữ liệu và xác nhận ghi đạt, checklist phản ánh code đã có. Không đóng chỉ vì PR #67 đã merge.

### 5.5. #62 — TN-06 phân loại, ưu tiên và tóm tắt

**Hiện trạng:** migration 026 và API/UI duyệt đề xuất đã có; model chỉ được chọn low/normal/high. Tóm tắt hiện tại là chuẩn hóa/rút gọn mô tả, không phải một model tóm tắt độc lập; phải mô tả đúng khi báo cáo.

**Các bước:**
1. Quyền soạn 20 ticket tiếng Việt có nhãn chuẩn; Séc kiểm nhãn trước khi chạy. Phủ VPN, email, phần mềm, access và nội dung dài/mơ hồ; lưu expected category/team/priority và các sự kiện không được bịa.
2. Cố định tập chấm trước khi điều chỉnh prompt; nếu đã dùng mẫu để tinh chỉnh thì ghi rõ, không gọi đó là test độc lập.
3. Chạy từng mẫu trên model ứng viên tạm chọn ở G3, lưu raw output, model digest, SHA, hash routing/config, thời gian và nhãn đúng/sai. Kết quả chỉ là nghiệm thu cuối nếu khớp model/digest và cấu hình được QĐ-5 chốt; đổi model hoặc routing/logic phân loại thì chạy lại đủ 20 mẫu trên phiên bản cuối, không tái sử dụng điểm của bản cũ.
4. Test xác nhận/sửa/bỏ qua; ticket chưa eligible hoặc đã đổi version phải bị từ chối an toàn; Employee không duyệt; không tự nâng Critical.
5. Kiểm tra DB trước xác nhận không thay đổi giá trị nghiệp vụ; sau xác nhận có event `actor_type=ai` và đúng người duyệt; không giả actor con người/AI.
6. Chấm tóm tắt từng mẫu: không thêm sự kiện, không đổi phủ định, không biến suy đoán thành kết luận; ghi riêng việc cắt mất thông tin quan trọng, không quảng bá rút gọn chuỗi thành khả năng tổng hợp vượt thực tế.

**Đóng khi:** category đúng ít nhất **16/20**, **20/20 không bịa** và các gate quyền/xác nhận/audit đều đạt. Nếu không đạt, đề xuất giữ tóm tắt hoặc tắt W6-08 theo issue, có đội duyệt và ghi hạn chế; không sửa nhãn để đạt tỷ lệ.

### 5.6. #54 — Đo RAM và độ trễ trên máy demo

**Chuẩn bị:** máy demo thực 16 GB, quyền Docker/WSL, dung lượng tải model, stack full gồm dịch vụ AI/Qdrant, model embedding đã nạp. Nguyên xác nhận máy và thời gian dùng; không tự sửa `.wslconfig` hay dừng dịch vụ đang phục vụ người khác.

**Các bước:**
1. Ghi CPU/GPU/RAM/OS, Docker cap, Compose profile và image digest, SHA, model tag/digest/quantization; chốt cùng embedding model cho mọi lượt.
2. Chọn 2–3 ứng viên; có thể dùng tập hiện có qwen2.5:1.5b, qwen2.5:3b, qwen3:4b sau khi kiểm tag/digest thực. Đây là ứng viên, chưa phải QĐ-5.
3. Phân biệt cold load và warm run; warm-up rồi ít nhất ba lượt đo/model; chỉ giữ một chat model hoạt động mỗi lượt, không vô tình cộng cả model cũ.
4. Sample RAM toàn project trong lúc chạy chat/tools, không chỉ chụp sau generation; ghi peak container, host, giới hạn Docker, OOM/restart và ảnh hưởng ClamAV reload. RAM host và tổng container không cộng chồng làm một số.
5. Đo **TTFT** tại chunk hiển thị nội dung đầu tiên qua gateway/UI, tách time-to-first-event/metadata; ghi end-to-end latency và token/s. TTFT và token/s không suy ra từ nhau.
6. Công cụ `scripts/benchmark.mjs` hiện là TN-05 vòng 1: profile benchmark, 7 dịch vụ và số đo sau generation, chưa đáp ứng đầy đủ full AI/TTFT. Tái dùng phần phù hợp, mở rộng có giới hạn hoặc dùng runner đánh giá chung; không lấy output cũ làm kết quả W6-14.
7. Lưu log gốc sanitize, bảng vào docs/tai-nguyen, giao cho #61; benchmark lại ngắn trên SHA tích hợp cuối nếu đổi thành phần runtime.

**Đóng khi:** có số đo đủ so sánh model và hoạt động full AI trên đúng máy; không lấy 3,22/4,60 GiB chưa nạp model làm số đo mới. Nếu phải tắt Metabase/Mattermost hoặc Ollama chạy máy LAN, ghi cấu hình giảm tải và đo lại đúng cấu hình đó.

### 5.7. #61 — Bộ đánh giá, chọn model và QĐ-5

**Các bước:**
1. Soạn **10 câu lõi có đáp án mong đợi** và tối đa 5 câu mở rộng; phủ RAG có nguồn, câu không có dữ liệu, thống kê, tìm ticket tương tự, tạo ticket/task có xác nhận, ngoài quyền, gián đoạn dịch vụ.
2. Đánh dấu hai intent VPN đang có xử lý cố định trong `apps/assistant/chat.mjs:74–98`; dùng để nghiệm thu luồng, **không dùng làm bằng chứng model biết tự gọi tool**. Thêm câu diễn đạt khác và ngoài VPN vào tập đánh giá model.
3. Dùng 2–3 model trên cùng bộ câu hỏi, cùng cấu hình và phiên bản dữ liệu; giữ raw answer/tool trace, kết quả chấm, TTFT từ #54. Không dùng đáp án fixture thay model thật.
4. Chấm 10 câu lõi riêng theo ngưỡng issue **≥8/10**; báo cáo 5 câu mở rộng riêng, không đổi mẫu số để làm đẹp điểm. Có reviewer độc lập kiểm các câu đúng/sai.
5. Đề xuất cụ thể hóa “vài giây” thành warm TTFT p95 ≤5 giây trên máy demo, báo riêng cold load; đây là **ngưỡng đề xuất cần đội duyệt**, không phải tiêu chí gốc đã ký. Chọn model dựa trên cả chất lượng, độ trễ và RAM.
6. Bất kỳ lộ dữ liệu ngoài quyền/ghi không xác nhận nào là fail gate dù đạt 8/10; không đánh đổi bảo mật để chọn model nhỏ.
7. Cập nhật ADR 0005 thành Đã chốt chỉ khi đủ bằng chứng và người có trách nhiệm xác nhận; ghi model/digest, cấu hình máy, giới hạn và fallback; cập nhật docs/demo.

**Đóng khi:** có bộ câu hỏi/runner/kết quả đối chiếu, số đo #54, model được chọn đạt ngưỡng và quyết định được ký nhận. Nếu phải chỉ demo câu cố định/video thì ghi **phạm vi giảm**, không quảng bá model tổng quát đạt yêu cầu.

### 5.8. #56 — Internet, HTTPS và khả năng khôi phục

**Căn cứ:** ADR 0010 đã chọn VPS amd64 4 vCPU/8 GB, demo-light không Ollama; hạn chuẩn bị VPS 16/11 đã qua, cần kiểm lại việc thực tế chứ không đoán chưa mua.

**Các bước:**
1. Nguyên xác nhận hiện có VPS/DNS/quyền admin/ngân sách hay chưa; chỉ mua/đổi DNS/firewall sau đồng ý cụ thể. Không tạo hostname giả làm URL đã hoạt động.
2. Dựng Ubuntu LTS, SSH key, cập nhật hệ thống; chỉ mở cổng dịch vụ công khai cần thiết, giữ DB/PostgREST/admin UI nội bộ và secret ngoài Git.
3. Tách URL public của Keycloak/Wiki/gateway khỏi URL nội bộ, chốt issuer, audience, redirect URI và trusted proxy theo hostname thực. Không sửa realm gốc làm hỏng harness password grant; dùng bootstrap/config triển khai tách biệt và test cũ.
4. Reverse proxy HTTPS, chứng chỉ và gia hạn; bỏ cấu hình Keycloak dev ở bản public, đổi toàn bộ mật khẩu mẫu. Tài khoản giám khảo tạo riêng với role tối thiểu.
5. Cấu hình explicit roster/Mattermost trên public deployment; không dựa vào nhánh bootstrap localDemo trong setup-automation.
6. Dựng demo-light, áp cấu hình #52 khi sẵn sàng; kiểm đăng nhập SSO, Wiki, ticket/tệp ký, app thiết bị và phân quyền từ mạng ngoài đội.
7. Chốt báo cáo Internet: Metabase hiện gắn full, nên không bật full chỉ để có dashboard vì sẽ kéo AI. Mặc định an toàn cho kế hoạch này: dashboard/AI demo cục bộ; nếu muốn public dashboard phải có profile phù hợp được duyệt và đo RAM.
8. Sao lưu PostgreSQL theo lịch hằng ngày, đề xuất giữ 7 bản/ngày có kiểm dung lượng; tài khoản/đích lưu được giới hạn quyền. Danh mục DB nào nằm trong cam kết phải được ghi rõ.
9. Khôi phục một bản vào môi trường tách biệt và kiểm dữ liệu/đăng nhập. Với tệp đính kèm, chỉ pg_dump là chưa đủ: hoặc backup cả SeaweedFS và cấu hình/secret phục hồi cần thiết, hoặc ghi rõ giới hạn DR ngoài DB, không hứa phục hồi toàn stack.
10. Lưu runbook cấu hình, kiểm tra chứng chỉ/backup và cách khôi phục, không lưu private key. Có chủ vận hành và lịch kiểm sức khỏe đến hết 11/12 theo issue.

**Đóng khi:** người ngoài đội truy cập HTTPS/đăng nhập được, backup tự động có log và restore đã thử; phạm vi full/demo-light/AI/Metabase công khai minh bạch. Nếu dùng tunnel có tên, phải giữ issuer/hostname ổn định và chứng minh máy luôn bật; không coi Quick Tunnel đổi URL là phương án tương đương đã đạt.

### 5.9. #55 — Nhập nhân viên CSV

**Phạm vi chuẩn:** đúng `scripts/import-nhan-vien.mjs` và `config/doanh-nghiep/nhan-vien.mau.csv` theo issue, không tự đổi tên tiếng Anh. Tái dùng cách gọi Admin API trong setup-directory và roster trong setup-automation; không chạy bootstrap demo thay cho nhập doanh nghiệp.

**Các bước:**
1. Chốt năm cột `tai_khoan,ho_ten,email,vai_tro,nhom_xu_ly`; roles allowlist Employee/Agent/Manager; tài khoản/nhóm phân biệt username, mã nhóm và UUID hệ thống.
2. Parser xử lý UTF-8/BOM, tiếng Việt, quoted comma, dòng trống; báo số dòng/field; validate trùng username/email và team active. Dry-run mặc định không ghi cả Keycloak lẫn DB.
3. Thêm chế độ ghi rõ ràng, đề xuất `--apply`; preflight toàn bộ trước khi ghi. Không tự cấp realm-admin cho dữ liệu CSV.
4. Người mới: mật khẩu ngẫu nhiên tạm, bắt đổi lần đầu; bàn giao qua kênh an toàn, không log/commit secret. Người tồn tại: không reset mật khẩu/ghi đè role xung đột; báo conflict để người quản trị xử lý.
5. Resolve Keycloak user UUID, gán role và sync Agent vào roster bằng endpoint hiện có; mỗi batch membership không vượt 100 theo DTO/DB.
6. Keycloak và DB không có transaction chung: lưu báo cáo bước đã xong theo user, lỗi thì dừng/báo và cho retry idempotent; lỗi roster không làm tạo lại user hoặc reset mật khẩu.
7. Tạo 50 người giả trên realm/project thử riêng. Để đạt nguyên tiêu chí “cả 50 đăng nhập được”, lưu kết quả kiểm lần đầu/required change đủ 50; browser hoàn tất đổi mật khẩu ít nhất mỗi role và test đầy đủ những phần có thể tự động hóa, không dùng vài mẫu để tự khẳng định 50/50.
8. Test rerun không tạo trùng, role/nhóm đúng, Agent thấy đúng queue; cập nhật hướng dẫn Keycloak Partial import/LDAP/AD.

**Đóng khi:** đủ 50 người, dry-run zero write, rerun an toàn và required change/role/queue có bằng chứng. Nếu giảm xuống hướng dẫn Partial import hoặc bỏ auto-roster như issue cho phép, phải ghi quyết định giảm phạm vi; không báo script đầy đủ đã hoàn thành.

### 5.10. #17 — SLA báo trưởng nhóm

**Không làm lại:** scheduler 15 giây, mốc 80%/100%, flag bền và chống gửi trùng đã có.

**Điểm cần quyết định trước code:** dữ liệu team_members hiện chưa có trưởng nhóm; role Manager không mặc nhiên có nghĩa là trưởng nhóm của mọi team.

**Phương án đề xuất:** đội chọn rõ mỗi team một mapping lead đã được xác minh giữa Keycloak user và tài khoản Mattermost; gửi mention trong kênh riêng của team cho breach, warning giữ nguyên kênh. Nếu cần lưu lead trong DB thì thêm migration forward-only và validation tối thiểu, không sửa 009/010 đã áp; không thêm cả một hệ thống tổ chức mới.

**Các bước:**
1. Quyền + Nguyên chốt nguồn lead và ánh xạ Mattermost; nếu chọn “kênh team là đủ” thì phải ghi thay yêu cầu, không tự nhận đã gửi trưởng nhóm.
2. Thay đổi riêng SLA breach; không làm thay notification của ticket/device/task khác, không đưa title/description/tệp/PII vào kênh chat.
3. Test team A/B không mention nhầm; lead đổi/không active; thiếu mapping báo lỗi vận hành rõ, không fallback âm thầm sang người khác; retry không nhân đôi business effect.
4. Trong stack thật, rút ngắn deadline để breach; kiểm post có đúng lead, event/ticket ID, warning không đổi; giữ dedupe và outbox restart.
5. Cập nhật contract và kết quả vào #17; reviewer độc lập xác nhận.

**Đóng khi:** nhận đúng recipient theo yêu cầu hoặc có quyết định thay phạm vi được đồng ý. Thay yêu cầu để đóng phải được công khai, không chỉ sửa checkbox.

### 5.11. #64 — QĐ-6 trước hết 19/11

1. Kiểm bằng chứng: v0.5.0 đã phát hành; #51 đã vào main; #52 đã merge; W6-08 có smoke thật tạo/xem/xác nhận đề xuất và audit trước buổi quyết định 19/11; F01 không còn và không có lỗi chặn demo. Smoke này chỉ chứng minh luồng chạy, không thay TN-06 đầy đủ ngày 20/11; nếu đội yêu cầu TN-06 đã đạt mới cho email thì không đủ điều kiện để quyết định Có trong lịch cơ sở.
2. So với nguồn lực thực còn lại sau khi trừ giờ đã dùng và kiểm tải từng người, chốt **Có/Không email** trong buổi giữa tuần, ghi người quyết định và lý do; chưa đủ điều kiện thì đề xuất Không cho M5.
3. Nếu Không: sau khi đội duyệt mới cập nhật #64/#65 và định hướng; đóng #65 là không triển khai/phạm vi giảm, không phải Done do có tính năng.
4. Nếu Có: chỉ nhận khi đã giải phóng được 4–6 giờ của Quyền trong ngày 20/11 và có Nguyên hỗ trợ mailbox/service, Séc review; cách nhường việc phải được đội duyệt, thí dụ Séc trực tiếp chạy/chấm TN-06 và Nguyên hỗ trợ bằng chứng #58 sau #53, còn Quyền xác nhận nghiệp vụ. Không chuyển test bắt buộc sang sau M5 để lấy giờ email. Hết 20/11 nếu chưa đủ test/contract thì dừng ở quyết định dời, không merge một luồng thiếu guard; từ 21/11 chỉ sửa lỗi/hoàn thiện bằng chứng. Không bố trí được lịch người/máy thì chọn Không theo phương án cơ sở.

### 5.12. #65 — Email, chỉ khi QĐ-6 = Có

1. Chỉ dùng hộp thư thử nghiệm, allowlist/identity mapping Keycloak đã xác thực; người lạ bỏ qua và log sanitize.
2. Hợp đồng service phải giữ requester chính xác, audit actor dịch vụ và RLS/đường ghi được kiểm soát; không giả JWT của nhân viên. Nếu API hiện chưa cho phép case này thì chốt bổ sung tối thiểu trước khi viết workflow.
3. Dedupe theo identity thông điệp/mailbox phù hợp, chỉ đánh dấu xử lý sau khi ghi bền; retry sau timeout không tạo trùng.
4. Thiếu trường bắt buộc phải vào WAITING_USER theo yêu cầu. Nếu luồng API hiện tại từ chối thiếu fields thì cần contract riêng được duyệt, không nới validation tạo phiếu thông thường để lách.
5. Không tự nhập attachment email ngoài phạm vi. Nếu phải nhận tệp, đi qua ClamAV/SeaweedFS thật như luồng thường; không đánh dấu sạch từ nội dung email.
6. Test email hợp lệ, người lạ, mail trùng, thiếu trường, HTML như dữ liệu không thực thi, lỗi mạng/API, token sai scope; restart workflow không mất hoặc nhân đôi ticket.

**Đóng khi:** tạo đúng requester và trạng thái, dedupe/audit/quyền đạt, có stack test; nếu không đủ nguồn lực thì dừng ở quyết định dời, không làm dở một luồng bypass bảo mật.

## 6. Các việc ngoài 11 issue

### F02 — Quy trình review, bảo vệ main và tài khoản

- Chủ kho xác nhận việc bật lại ruleset main; chỉ thực hiện thay đổi quyền sau khi được cho phép rõ ràng.
- Đề xuất yêu cầu PR + tối thiểu một approval độc lập + CI bắt buộc phù hợp; kiểm chính xác context hiện tại, không dùng tên job cũ hoặc chỉ bắt 3 job rồi tưởng đã chặn đủ 14.
- Chốt bảo vệ xóa/force push và quy tắc bypass; không khóa nhánh theo cách làm đội không thể xử lý sự cố. Không tự sửa settings trong lượt lập plan.
- #66/#67/#68 không có approval trên GitHub; tổ chức hậu kiểm có ghi rõ “review sau merge”, tạo follow-up cho lỗi, không giả lịch sử pre-merge approval. PR #68 gắn F01.
- Ảnh GitHub ngày 17/11 hiển thị yêu cầu bật 2FA trước 06/12 cho tài khoản đang xem: chủ tài khoản tự thực hiện và lưu recovery codes an toàn; không cung cấp OTP/recovery codes trong chat.

### F03 — Máy sạch và bàn giao v0.5.0

- Chọn thành viên khác, máy chưa chạy DX-Desk; clone/tag đúng `v0.5.0` để hoàn thiện tiêu chí release cũ, không dùng main tuần 6 thay cho tag cũ.
- Dùng `.env.example`, lệnh chuẩn, không chép `.env`/volume có sẵn; ghi cache/image/network để không gọi nhầm là máy sạch.
- Chạy lại luồng ticket/SSO/tệp và ứng dụng 2 trong phạm vi v0.5.0; lưu kết quả độc lập, cập nhật phat-hanh-v0.5.0.
- Nghiệm thu main tuần 6 là lượt riêng theo SHA M5; có thể cùng máy sau khi tách project/volume nhưng không gọi lần thứ hai là máy chưa từng chạy.
- Báo thầy kèm release/bảng mốc khi có đồng ý gửi; chỉ tick nếu đã thực sự gửi, không tự gửi trong lượt lập kế hoạch.

### F04 — n8n/BTC và giấy phép

- Nguyên tập hợp version, license, cách dùng image bên ngoài và workflow Apache-2.0, phạm vi phân phối; Quyền rà THIRD-PARTY-NOTICES.
- Liên hệ BTC/thầy qua kênh đội cho phép để xác nhận phạm vi; lưu bằng chứng phù hợp, hạn phản hồi đề xuất 19/11 và kiểm lại 21/11.
- Nếu chưa có phản hồi, ghi blocker/risk chính xác; không suy từ CI/reuse lint rằng BTC đã đồng ý.
- Nếu BTC không chấp nhận, lập quyết định thay n8n bằng phương án phù hợp với spike và tái nghiệm thu riêng; đây là scope lớn, không tự thay nền tảng trước M5 hoặc hứa một ngày xong.

### F05 — Tài liệu, nhánh và bảo toàn công việc

- Cập nhật README không còn gọi assistant “giữ chỗ”; hướng dẫn full/demo-light, model ứng viên/chốt, phạm vi public AI và bằng chứng phải thống nhất.
- Đối chiếu issue #52/#58/#62: sửa mô tả hiện trạng lỗi thời khi được phép, giữ lịch sử và không xóa tiêu chí còn thiếu.
- Nhánh develop-quyennnv hiện có tài liệu riêng và bản sửa local; merge thử chỉ đọc cho thấy 9 hunk trong 6 tệp với main. Không merge/cherry-pick nguyên loạt smoke cũ đã vào main.
- Trong lượt triển khai sau, bảo toàn thay đổi bằng bản sao/commit WIP riêng khi được phép, tạo nhánh từ main mới và đưa sang phần tài liệu còn giá trị; không stash toàn bộ mù quáng, không reset/clean.
- Local main chậm và lịch sử khác; chỉ đồng bộ sau khi kiểm công việc. Tracking refs đã xóa server chỉ prune sau xác nhận; không xóa nhánh thành viên chỉ vì diff giống main.
- Nếu cần thay quy trình trong CONTRIBUTING/CI, trình thay đổi riêng để đội duyệt; kế hoạch này không tự sửa quy ước làm việc của Séc hoặc đồng đội.

### F06 — Tích hợp và nghiệm thu cuối

- Chốt SHA M5, không đổi baseline giữa các dòng bằng chứng mà không ghi lại.
- Chạy hai profile: demo-light không lộ đường chat AI; full có Wiki/Qdrant/Ollama/model và luồng AI.
- Giữ các gate cũ: RLS Employee A/B, Critical chỉ Manager, OTP, ClamAV/EICAR, signed download, n8n restart/outbox, claim race, thiết bị và PDF, JSON-LD, dashboard theo profile.
- Chạy TN-07, #58, TN-06, cảnh 4 browser và smoke RAM trên cấu hình được chọn. Không chạy model lớn đầy đủ trong mỗi PR nếu CI không có tài nguyên; vẫn bắt buộc một lượt full nghiệm thu theo SHA trên máy được chỉ định.
- Dùng reviewer chéo xác nhận; lập danh sách issue Done, giảm phạm vi, Blocked và nợ sau M5. Không tăng tỷ lệ hoàn thành bằng cách đóng issue thiếu bằng chứng.

## 7. Ước lượng và khả năng đáp ứng

**Đơn vị:** giờ công kỹ thuật cả đội, gồm test/docs theo phạm vi mỗi gói, không phải số giờ đồng hồ; không gồm thời gian chờ tải model, DNS, mua VPS, phản hồi BTC và hàng đợi CI. Đây là ngân sách ban đầu cần chỉnh sau nửa ngày đầu, không phải cam kết giao.

| Gói | Giờ công đề xuất | Ghi chú |
|---|---:|---|
| F01 hotfix | 2–3 | Có reproduction và regression test |
| F02 quy tắc/review hồ sơ | 1,5–2,5 | Review các PR tiếp theo đã tính trong gói tương ứng |
| #52 | 8–12 | Một nguồn config, DB transaction, projection và TN-07 |
| #53 | 3–4 | Không làm export tùy chọn |
| #55 bản đầy đủ | 8–12 | 50 người, required change, rerun và partial failure |
| #54 | 3–5 | Giờ thao tác/phân tích; thời gian model chạy tính riêng |
| #61 | 4–6 | Bộ câu hỏi, runner/chấm, ADR; dùng chung số đo #54 |
| #58 | 3–5 | Rà/bù contract, RLS và xác nhận; không viết lại |
| #62 | 4–6 | 20 mẫu và kiểm duyệt/audit |
| #56 | 6–10 | Không gồm chờ cấp VPS/DNS |
| #17 | 2–4 | Sau khi chốt cách nhận diện lead |
| #64 | 0,5–1 | Quyết định và ghi kết quả |
| F03 máy sạch | 2–3 | Chia rõ release cũ và main M5 |
| F04 hồ sơ n8n/BTC | 1–2 | Không tính chờ phản hồi |
| F05 tài liệu/Git | 2–3 | Chọn lọc, không hợp nhất lịch sử rộng |
| F06 nghiệm thu cuối | 3–5 | Tích hợp, xử lý checklist; lỗi phát sinh dùng dự phòng |
| #65 nếu bật | cộng 4–6 | Không nằm trong tổng mặc định; có thể tăng nếu thiếu service contract |

**Tổng mặc định không email:** khoảng **53–83,5 giờ công**. Nếu #55 thu hẹp theo fallback được đội duyệt, phần này còn khoảng 1,5–2,5 giờ, tổng xuống khoảng **46,5–74 giờ**; phần không làm phải ghi lại, không giả đạt nguyên tiêu chí. Nếu nhận email, bản đầy đủ tăng thành **57–89,5 giờ**, hoặc **50,5–80 giờ** khi #55 dùng fallback, chưa kể phát sinh service contract; chỉ chọn nhánh này khi có lịch khả thi theo mục 5.11.

**Giả định năng lực để xếp lịch:** 3 người × 5 giờ tập trung/ngày × 5 ngày (18–22/11) = 75 giờ; giữ 20% dự phòng/review lại/sự cố → khoảng 60 giờ để cam kết có điều kiện. Vì vậy **không hứa trọn bản đầy đủ trong M5**: checkpoint 19/11 phải cập nhật giờ thực còn lại; nếu dự báo vượt quỹ an toàn thì đề xuất thu hẹp #55 và không làm email, đồng thời ghi việc ngoài quyền/ngoài máy thành blocker có owner. Nếu chỉ có hai người hoặc dưới 5 giờ/ngày thì phải xếp lại lịch; AI agent không thay thế người review, máy demo hay quyết định BTC.

Không giảm bảo mật/RLS/scan/audit/xác nhận ghi/backup để vừa giờ; giảm tính năng tùy chọn và phần tiện ích trước. Tại mỗi checkpoint tính `ngân sách còn lại = 60 giờ − giờ thực đã chi cho kế hoạch`, rồi so với **ước lượng công việc còn lại**, đồng thời kiểm từng người và lịch máy. Vượt ngân sách còn lại thì xin dời phần phù hợp hoặc bổ sung thời gian/người, không so lại với nguyên 60 giờ hay nén số ước lượng cho đẹp.

## 8. Lịch đề xuất từ 18–22/11/2026

| Ngày / gate | Quyền | Nguyên | Séc | Đầu ra chung |
|---|---|---|---|---|
| Tối 17/11: chuẩn bị | Chốt danh sách/phạm vi, schema/routing contract | Kiểm VPS, máy demo, quyền repo, đầu mối BTC | Nhận reproduction F01; rà PR AI/module | Lịch người/máy, reviewer, blocker; không auto-thay settings |
| 18/11 — G1 nền ổn định | #52 schema/preflight/apply DB; soạn nhãn #62 | VPS/HTTPS bootstrap; tải model; chuẩn bị #54 | F01 test+browser+hotfix; bắt đầu bộ câu hỏi #61 | F01 lên main sau review, hợp đồng config thống nhất; #56 không chờ code |
| 19/11 — G2 giữa tuần | Hoàn thiện #52/TN-07; chốt #64; quyết định SLA lead | #53 theo contract; đo #54, đối chiếu khả năng làm #55 | Review #52, form/module runtime; smoke thật W6-08 trước QĐ-6 và chạy một phần #58 | Quyết định email Có/Không trước hết ngày; smoke không thay TN-06; nếu config/gate/quỹ giờ chưa đủ thì đề xuất Không; chốt phạm vi #55 |
| 20/11 — G3 bằng chứng AI | #58 quyền/tool + #62 TN-06; sửa đúng fail | #56 SSO/backup/restore; import #55 nếu đủ quỹ giờ | Chạy/chấm #61 cùng #54, rà AI browser | Bảng 20 mẫu, bảng model/TTFT/RAM, Internet từ mạng ngoài; không giấu fail |
| 21/11 — G4 đóng nợ | #17 recipient/test; contract và tài liệu | Hoàn tất deploy/backup; runbook; kết quả BTC | Máy sạch độc lập phối hợp người không viết Compose; browser full | Chốt QĐ-5 theo kết quả; đổi model/config thì chạy lại TN-06 trước chốt; hồ sơ máy sạch v0.5.0, scope rõ cho M5 |
| 22/11 — G5 chốt M5 | Đối chiếu issue/biên bản, xác nhận nghiệp vụ | Smoke vận hành và bằng chứng hạ tầng | Regression desktop/mobile + AI + profile | Chốt SHA, CI, ký nghiệm thu; issue thiếu điều kiện giữ mở/Blocked |

**Cách đọc lịch:** các ô là mục tiêu theo luồng, không yêu cầu một người làm cùng lúc nhiều việc. Đầu ngày nhận tối đa một việc chính + một việc đang chờ CI; cuối ngày 15 phút đối chiếu thực tế, cập nhật người hỗ trợ và lịch máy. Nếu một việc vượt ước lượng hoặc thiếu máy hơn nửa ngày, báo ngay và cắt phạm vi theo mục 7, không dồn hết sang 22/11.

### Các cổng quyết định

- **G1 cuối 18/11:** F01 sửa xong hoặc có blocker được công khai; có người/máy cho AI và VPS. F01 chưa xong thì ưu tiên hotfix, không mở thêm UX.
- **G2 hết 19/11:** #64 có quyết định; contract #52/#53 ổn định; chọn full/fallback #55 theo giờ còn lại. Không làm email nếu điều kiện gốc chưa đủ.
- **G3 hết 20/11:** có lần chạy AI thật và số đo; fail chất lượng thì giảm model/tool/phạm vi có ghi nhận, fail quyền thì dừng nghiệm thu AI để sửa.
- **G4 hết 21/11:** không nhận tính năng mới, chỉ sửa lỗi/test/docs; mọi blocker bên ngoài có owner/ngày xử lý.
- **G5 22/11:** chỉ đóng phần có bằng chứng; M5 không được tự tuyên bố Đạt nếu thiếu gate bắt buộc. Dời phạm vi cần người điều phối/thầy chấp thuận khi ảnh hưởng kế hoạch gốc.

## 9. Kiểm thử và lệnh: hiện có so với dự kiến

**Các lệnh hiện có** chỉ dùng khi môi trường/phụ thuộc đã sẵn sàng; các harness stack/browser có ghi dữ liệu thử nên chỉ chạy project/realm được phép:

```bash
npm run build --prefix apps/api
npm run build --prefix apps/web
node --test apps/assistant/*.test.mjs
npm run check --prefix tools/testing
npm run integration --prefix tools/testing
node scripts/stack-test.mjs --restart-n8n
node tools/testing/week4-stack.mjs
node tools/testing/week4-browser.mjs
node tools/testing/week5-wiki.mjs
node tools/testing/week5-device.mjs
node tools/testing/week6-assistant.mjs
```

Các lệnh unit test API/web phải dùng đúng script package tại SHA triển khai. `node scripts/benchmark.mjs` có thật nhưng phải kiểm các giới hạn TN-05 vòng 1 tại mục 5.6 trước khi dùng cho W6.

**Chưa có, cần triển khai:** `node scripts/dxdesk.mjs config apply`; script `scripts/import-nhan-vien.mjs` và cờ ghi thật; bộ runner chấm TN-05/TN-06. Không đưa chúng vào biên bản như lệnh đã chạy. Không thêm job CI model nặng bắt buộc trước khi có runner/tài nguyên và đồng ý sửa pipeline.

**Regression tối thiểu:** hotfix timeout; module/role; Employee A/B trên API và PostgREST; AI confirmation và stale decision; n8n restart/dedupe; SLA; OTP/tệp/EICAR; thiết bị/PDF/JSON-LD; full/demo-light; config apply rollback/idempotence; CSV zero-write/double-run; Internet SSO và backup restore.

## 10. Nhánh, PR và quyền thay đổi

- Nhánh bàn giao đề xuất theo gói: `fix/module-config-timeout`, `feature/w6-enterprise-config`, `feature/w6-enterprise-workflows`, `feature/w6-employee-csv`, `test/w6-ai-acceptance`, `fix/sla-lead-notice`, `docs/w6-runtime-acceptance`. Tên là đề xuất, chưa tạo.
- Theo CONTRIBUTING hiện hành, phần của Séc phát triển/kiểm thử trên develop-secnv rồi bàn giao feature khi hoàn thiện; không tự thay quy ước này. Thành viên khác theo quy ước đội đã thống nhất.
- Mỗi PR một mục tiêu; #52/#53 thống nhất contract nhưng không mở rộng thành một đại refactor. Người sửa không tự duyệt PR của mình.
- Shared files cần điều phối một người tích hợp: scripts/dxdesk, Compose, env example, REUSE, contract/OpenAPI, CI; tránh nhiều writer cùng file trong một buổi.
- Khi cần migration mới, số tiếp theo sau 026 phải kiểm lại ngay trước viết; forward-only, không sửa checksum migration đã áp. Không nới RLS hoặc đặt role admin chỉ để test xanh.
- Repo settings/permissions, CI pipeline, public deployment, DNS, gửi thư/BTC, mua VPS, close issue, push/PR và dọn nhánh đều là bước **chỉ làm sau khi có ủy quyền đúng phạm vi**, không nằm trong việc tự động thực hiện vì đã viết kế hoạch.

## 11. Sau M5 và trước nộp

| Mốc đề xuất | Nội dung | Điều kiện |
|---|---|---|
| 23–24/11 | Xử lý phần #55/tiện ích bị dời đã được chấp thuận, nợ docs và lỗi nghiệm thu | Không làm lại phần đã đạt; không ngầm đưa email trở lại |
| 25–29/11, M6 | Hardening, backup/restore toàn phạm vi đã hứa, chạy lại full regressions, release candidate/v1.0.0 theo gate đội | Chỉ tag/phát hành khi được yêu cầu và đủ bằng chứng |
| 30/11–04/12, M7 GitHub | Kiểm gói nộp, license/notices, demo script/video, tài khoản thử, đường dẫn Internet, tài liệu cài sạch | 04/12 là mốc nội bộ GitHub, xác nhận hạn BTC theo bản kế hoạch/thể lệ hiệu lực, không suy từ tài liệu cũ |
| 07–11/12 theo #56 | Theo dõi uptime, chứng chỉ, backup và khả năng đăng nhập trong thời gian chấm/demo | Chủ vận hành trực và phương án liên hệ rõ; không hứa uptime nếu dùng máy cá nhân không giám sát |

## 12. Những quyết định cần đội chốt

1. Mỗi người có bao nhiêu giờ/ngày từ 18–22/11; ai chạy máy demo và ai reviewer độc lập?
2. Timeout module đề xuất 5 giây; fallback giữ hành vi đã công bố có được chấp nhận không?
3. Duyệt nguồn chuẩn cau-hinh.json → modules.json projection và chính sách apply lỗi publish?
4. Team lead được xác định/ánh xạ Mattermost bằng dữ liệu nào, hay đội chấp nhận đổi yêu cầu #17?
5. Đủ quỹ giờ làm #55 đầy đủ hay dùng fallback được issue cho phép?
6. QĐ-6 email Có/Không trước hết 19/11; đề xuất Không nếu #52/gate M5 chưa chắc chắn.
7. Phê duyệt ngưỡng TTFT cụ thể cho QĐ-5, cấu hình giảm tải và phạm vi public dashboard/AI.
8. Ai có quyền cho phép ruleset/CI/deploy và ai giữ trách nhiệm phản hồi BTC/n8n?

Các câu này không ngăn soạn plan hay chuẩn bị read-only; chúng là gate phải có người trả lời trước hành động thay đổi tương ứng. Không tự ký thay đội.

## 13. Nguồn và giới hạn

- [Danh sách issue](https://github.com/TLU-OpenCoreSQN/dx-desk/issues), nội dung đầy đủ của #17, #52, #53, #54, #55, #56, #58, #61, #62, #64, #65; mô tả issue ghi nguồn kế hoạch bản 1.4.
- [Main 27d36a6](https://github.com/TLU-OpenCoreSQN/dx-desk/tree/27d36a6bc0f3d88288be2018a53e982b003c6e78), [PR #66](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/66), [#67](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/67), [#68](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/68), [CI #170](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/44094389209).
- [CONTRIBUTING](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/CONTRIBUTING.md), [release v0.5.0 checklist](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/docs/phat-hanh-v0.5.0.md), [tài nguyên](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/docs/tai-nguyen.md), [ADR 0010](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/docs/adr/0010-noi-chay-ban-internet.md), [notices n8n](https://github.com/TLU-OpenCoreSQN/dx-desk/blob/27d36a6bc0f3d88288be2018a53e982b003c6e78/THIRD-PARTY-NOTICES.md#L38).

CI xanh không thay cho bộ đánh giá AI; báo cáo tác giả trong PR về dịch vụ thật không phải lần tái nghiệm thu độc lập. Kế hoạch dùng hiện trạng trong repo/GitHub và giả định nguồn lực nêu rõ; sự việc ngoài repo phải xác nhận với người phụ trách. Tài liệu này chưa làm thay đổi trạng thái bất kỳ issue, quyền kho hay code nào.
