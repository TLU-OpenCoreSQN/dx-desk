# Kịch bản demo tuần 5 — cảnh 1–3 có ứng dụng 2 (M4, v0.5.0)

Dùng cho demo nghiệm thu v0.5.0 và làm khung cho demo giám khảo. Cảnh 4 (trợ lý AI, Ollama) chờ
W6-05; luồng phiếu VPN chi tiết (phân công tự động, Agent nhận phiếu, Manager phê duyệt) vẫn theo
[kịch bản tuần 4](demo-tuan-4.md) và có thể chèn vào giữa cảnh 1 và cảnh 2 nếu đủ thời gian.

Kiểm thử tự động tương ứng (CI job "nghiệm thu stack và browser OTP tuần 3", job "Metabase và KPI
demo tuần 5"): `tools/testing/week5-wiki.mjs` (cảnh 1), `tools/testing/week5-device.mjs` (cảnh 2),
`tools/testing/week5-metabase.mjs` và `tools/testing/gateway-test.mjs` (cảnh 3).

## Chuẩn bị

- [ ] Sao chép `.env.example` thành `.env`, đặt `COMPOSE_PROFILES=full` (cảnh 3 cần Metabase),
      `AUTOMATION_ENABLED=true`. Không có Metabase thì bỏ bước 3.1 (hồ sơ `demo-light`).
- [ ] Chạy `node scripts/dxdesk.mjs up` (hoặc `make up`); mọi dịch vụ healthy, có container `device-request`.
- [ ] Muốn thẻ "VPN client 4.2 · kịch bản giả lập" có số liệu (+37%, 2,4 → 4,1 giờ, 72%): nạp kịch bản
      vào DB demo theo [thẻ dữ liệu](data/README.md) trước buổi demo. Không nạp thì thẻ đó trống, phần
      còn lại của cảnh 3 vẫn chạy.
- [ ] Dùng stack mới dựng (hoặc chưa chạy kiểm thử nghiệm thu): `week5-device` và kiểm thử browser để lại các
      đề nghị `[SYNTHETIC W5 …]` trong danh sách, dễ gây rối khi trình diễn.
- [ ] Mở sẵn ba cửa sổ trình duyệt riêng (hoặc ba profile/ẩn danh) cho `employee.a`, `manager.1`,
      `agent.1`, và một cửa sổ ẩn danh không đăng nhập cho bước 3.2. Mật khẩu demo ở README.
- [ ] Tab Mattermost `http://localhost:18065` (tài khoản nội bộ cùng tên, mật khẩu
      `MATTERMOST_DEMO_PASSWORD` trong `.env`). Nếu đăng nhập báo sai mật khẩu trên volume cũ, xem ghi chú
      ở [tai-nguyen.md](tai-nguyen.md#đo-lại-trước-v050--có-ứng-dụng-2-w5-09-17112026).
- [ ] Ghi commit, máy, RAM và hệ điều hành vào biên bản. Số đo RAM tham khảo: [tai-nguyen.md](tai-nguyen.md).

Đơn vị demo (thuộc tính Keycloak `department`, gán bởi `scripts/setup-directory.mjs`):

| Tài khoản | Vai trò | Đơn vị |
|---|---|---|
| `employee.a` | Employee | `phong-hanh-chinh` |
| `manager.1` | Manager | `phong-hanh-chinh` (quản lý trực tiếp của `employee.a`) |
| `employee.b` | Employee | `phong-ke-toan` |
| `agent.1`, `agent.2` | Agent (IT) | `phong-cntt` |

## Cảnh 1 — Đăng nhập một cửa cho DX-Desk, Wiki.js và ứng dụng 2

1. Mở `http://localhost:9080`, đăng nhập `employee.a` qua Keycloak (realm `dxdesk`).
2. Wiki.js (W5-08): ở **Tạo phiếu**, chọn danh mục *Kết nối VPN* — khung "Thử tự xử lý trước khi gửi
   phiếu" hiện bài *Kết nối VPN từ xa vào mạng nội bộ*. Bấm tiêu đề bài: Wiki.js mở ở tab mới, bấm
   **Đăng nhập** một lần, Keycloak không hỏi lại mật khẩu và quay về đúng bài. Quay lại DX-Desk, bấm
   **Đã tự xử lý được**: hệ thống ghi một lượt tự phục vụ, không tạo phiếu.
3. Ứng dụng 2 (W5-01): ở thanh bên DX-Desk bấm **Xin cấp thiết bị (ứng dụng 2)**. Trang
   `http://localhost:9080/thiet-bi/` mở ngay, **không hỏi mật khẩu**: đầu trang hiện *Nhân viên A*,
   vai trò *Nhân viên* và *đơn vị phong-hanh-chinh* lấy từ token.
   Lưu ý: bấm đúng mục **Xin cấp thiết bị (ứng dụng 2)**, không phải mục *Yêu cầu cấp thiết bị*
   (`/device-requests`) — đó là trang gửi đề nghị cũ bên trong DX-Desk, ghi cùng bảng `device_requests`.
4. Chỉ ra cho người xem: ứng dụng 2 là SPA riêng (container `device-request`, client Keycloak
   `dxdesk-device`, PKCE) nhưng chạy cùng cổng 9080 sau APISIX, dùng chung phiên Keycloak và chung
   dữ liệu PostgreSQL/RLS với DX-Desk — đây là "ứng dụng thứ hai trên cùng nền tảng".
5. **Không** đăng nhập Mattermost bằng Keycloak: Mattermost Team Edition không có SSO trong bản nguồn mở
   (QĐ-2, [ADR 0008](adr/0008-sso-keycloak-cho-ung-dung-co-san.md)); Mattermost chỉ là kênh bot thông báo.

Câu nói gợi ý: "Một lần đăng nhập dùng được cho DX-Desk, Wiki.js và ứng dụng Xin cấp thiết bị.
Ứng dụng 2 không có hệ thống tài khoản hay cơ sở dữ liệu riêng; quyền vẫn do PostgreSQL quyết định."

## Cảnh 2 — Xin cấp thiết bị: đề nghị → duyệt → IT chuẩn bị → bàn giao có biên bản

1. **Nhân viên gửi đề nghị.** Ở cửa sổ `employee.a`, khung **Đề nghị mới**: Loại thiết bị *Màn hình*,
   Số lượng 1, Lý do "Màn hình hiện tại bị sọc, cần thay để làm báo cáo." → **Gửi đề nghị**.
   Thẻ mới ở mục **Đề nghị của tôi**, trạng thái *Chờ quản lý duyệt*, thanh tiến trình ở bước
   *Gửi đề nghị*. Đọc to 8 ký tự mã đề nghị để đối chiếu ở các bước sau.
2. **Thông báo chỉ tới đúng người.** Tab Mattermost đăng nhập `manager.1`: kênh riêng
   *Đề nghị thiết bị · phong-hanh-chinh* có tin của bot `dxdesk-notifier` "chờ quản lý trực tiếp duyệt"
   kèm mã đề nghị. Tin **chỉ có loại sự kiện và mã**, không có lý do hay tên người đề nghị.
3. **RLS theo đơn vị (tùy chọn, 1 phút).** Đăng nhập `employee.b` (phòng kế toán) hoặc `agent.1` vào
   `/thiet-bi/`: không thấy đề nghị vừa gửi. IT chưa thấy vì quản lý chưa duyệt.
4. **Quản lý trực tiếp duyệt.** Cửa sổ `manager.1` → bấm **Xin cấp thiết bị (ứng dụng 2)** (không đăng
   nhập lại) → mục **Chờ bạn duyệt · đơn vị phong-hanh-chinh** → **Duyệt**. Trạng thái thành
   *Đã duyệt, chờ IT*. (Nhánh phụ nếu có thời gian: với một đề nghị khác bấm **Từ chối** — bắt buộc ghi
   lý do ít nhất 5 ký tự, rồi **Xác nhận từ chối**.)
5. **IT nhận việc.** Mattermost kênh *Đề nghị thiết bị · IT* nhận tin "IT chuẩn bị". Cửa sổ `agent.1`
   → `/thiet-bi/` → mục **Chờ bạn xử lý** → **Bắt đầu chuẩn bị** (*IT đang chuẩn bị*) →
   **Xác nhận đã bàn giao** (*Đã bàn giao*). Thứ tự bước do hàm chuyển trạng thái trong PostgreSQL
   kiểm soát: giao diện chỉ hiện nút hợp lệ, gọi sai bước bị DB từ chối.
6. **Biên bản PDF.** Quay lại `employee.a` → **Tải lại danh sách**: thẻ ở *Đã bàn giao*, Mattermost kênh
   *Đề nghị thiết bị · employee.a* có tin "Thiết bị đã bàn giao". Bấm **Tải biên bản (PDF)**: biên bản tiếng
   Việt (phông Noto Sans nhúng) sinh khi bàn giao, lưu SeaweedFS, tải qua URL ký có hạn 120 giây
   (W5-03). Bấm **Lịch sử**: bốn bước *Gửi đề nghị → Đã duyệt, chờ IT → IT đang chuẩn bị → Đã bàn giao*
   kèm người thực hiện và giờ.

Câu nói gợi ý: "Quản lý chỉ duyệt được đề nghị của đơn vị mình, IT chỉ thấy đề nghị đã duyệt, thông báo
chat chỉ mang mã. Toàn bộ luật nằm ở PostgreSQL nên ứng dụng 2 gọi thẳng PostgREST mà không cần API riêng."

## Cảnh 3 — Dữ liệu mở và báo cáo vận hành

1. **Báo cáo cho Manager (hồ sơ `full`).** Cửa sổ `manager.1` → DX-Desk → **Báo cáo vận hành**
   (`/bao-cao`): dashboard Metabase nhúng bằng URL ký 5 phút.
   - Bảng **Đề nghị thiết bị**: có dòng *monitor / handed_over* của đề nghị vừa làm ở cảnh 2.
   - **Bước xử lý theo tác nhân theo tuần (H-P-D-I)** và **Tỷ lệ thao tác thủ công theo tuần (%)**:
     phần việc người / hệ thống / AI (W5-10).
   - **VPN client 4.2 · kịch bản giả lập** (nếu đã nạp): phiếu VPN 100 → 137 (+37%), thời gian xử lý
     2,4 → 4,1 giờ, 72% phiếu tuần sau từ client 4.2. Nói rõ đây là **dữ liệu giả lập** (CC0-1.0).
2. **Danh mục dữ liệu công khai.** Cửa sổ ẩn danh (không đăng nhập) mở `http://localhost:9080/du-lieu`:
   - Tải một bộ dữ liệu mẫu trong danh mục DCAT.
   - Chọn **Dịch vụ → Kết nối VPN** để xem JSON-LD, sao chép URI hoặc **Kiểm tra trên JSON-LD Playground**.
   - Chọn **Loại thiết bị → Màn hình**: chính danh mục loại thiết bị mà ứng dụng 2 dùng ở cảnh 2, phát
     công khai tại `/ld/device-types/monitor` (`application/ld+json`, chỉ `GET`/`HEAD`, có giới hạn tần suất).
3. Chỉ ra: danh mục công khai chỉ mô tả dịch vụ, loại yêu cầu, loại thiết bị và dữ liệu giả lập —
   không có phiếu hay đề nghị của người dùng.

Câu nói gợi ý: "Cùng một nguồn dữ liệu phục vụ ba lớp: người dùng làm việc trên hai ứng dụng, quản lý
xem báo cáo, và bên ngoài đọc danh mục dữ liệu mở theo chuẩn JSON-LD/DCAT."

## Biên bản

- Commit / link CI:
- Máy / RAM / hệ điều hành / Docker / hồ sơ (`full` hay `demo-light`):
- Người chạy, ngày giờ:
- Mã đề nghị thiết bị dùng trong cảnh 2:
- Cảnh lỗi hoặc bỏ qua (ghi rõ lý do, ví dụ chưa nạp kịch bản VPN):
