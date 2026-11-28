# Vận hành DX-Desk

Dành cho người có quyền truy cập máy chạy Docker. Chạy lệnh từ gốc kho; cần Node.js >=22.12,
Docker Engine và Compose v2. Trên Windows các lệnh Node dùng được trong PowerShell.
Chi tiết cài ban đầu, OTP và biến môi trường: [cai-dat.md](cai-dat.md).

## Khởi động, kiểm tra và dừng

```sh
# Lần đầu: sao chép .env.example thành .env, cấu hình bí mật local.
node scripts/dxdesk.mjs up
node scripts/dxdesk.mjs ps
node scripts/dxdesk.mjs verify
```

`up` dựng CSDL/Keycloak, áp dụng migration có checksum, đồng bộ client/đơn vị/JWKS,
build ứng dụng, chuẩn bị Wiki/Metabase và workflow theo hồ sơ. Dùng lại volume hiện có.
Nó khởi động lại gateway và các tiến trình bind source cần nạp mã mới; dự trù một khoảng gián đoạn.
Chỉ báo sẵn sàng khi lệnh thành công và `verify` đạt; một container Running chưa đủ.

Hồ sơ mặc định `.env.example` là `full`: có Wiki, Metabase, Qdrant và Trợ lý AI.
`COMPOSE_PROFILES=demo-light` giữ Wiki nhưng không bật AI/Qdrant/Metabase; nghiệm thu theo dịch vụ của hồ sơ.
Đổi hồ sơ trên môi trường thử riêng; service của hồ sơ trước có thể vẫn còn chạy nếu chưa dừng.
Đổi cổng/URL phải đồng bộ `.env`, client Keycloak và nguồn cấu hình; chạy lại `up`, kiểm tra SSO.
Địa chỉ local phụ thuộc `.env`, không chép cứng địa chỉ của máy người khác.

```sh
node scripts/dxdesk.mjs down
```

`down` giữ volume. **Đặt lại dữ liệu** bằng `make reset` là thao tác xóa toàn bộ volume dự án,
chỉ dùng môi trường bỏ được sau khi đã sao lưu và xác định đúng project.
Không dùng reset để cập nhật source, sửa schema hoặc sửa một mật khẩu. Không xóa volume Docker hàng loạt.

Trước pull/build: xác định nhánh và cây làm việc sạch, review thay đổi, sao lưu khi có migration.
Sau pull chạy `up` rồi `verify`; không sửa migration đã áp dụng. Checksum lệch thì dừng và đối chiếu Git,
không xóa ledger hoặc sửa checksum bằng tay để bỏ qua kiểm tra.

## Cấu hình doanh nghiệp và workflow

```sh
node scripts/dxdesk.mjs config validate
node scripts/dxdesk.mjs config apply
node infra/n8n/validate-workflows.mjs
node scripts/dxdesk.mjs n8n-reload
```

Nguồn danh mục/nhóm/SLA/module là `config/doanh-nghiep/cau-hinh.json`.
Validate trước apply; xem diff và thử ở demo trước. Thay SLA áp dụng cho phiếu mới,
không làm mới hạn của phiếu cũ. Không tự sửa `config/doanh-nghiep/modules.json` được sinh ra.
Workflow nguồn ở `config/doanh-nghiep/workflows/`, giữ ID ổn định. `up` dừng n8n trước khi import/publish
để tiến trình không đọc trạng thái chuyển tiếp; sau publish mới khởi động n8n. `n8n-reload` kiểm cấu trúc trước
khi dừng/nạp/bật workflow. Workflow vắng trong thư mục không mặc định bị xóa trên server.
Sau reload kiểm routing VPN, outbox và thông báo; `node scripts/stack-test.mjs --restart-n8n`
thử phục hồi sau restart. Không chạy cùng các bài SLA/stack khác trên cùng project.

## Keycloak: realm, người dùng, OTP

Realm JSON được import **khi realm chưa tồn tại**. Restart container không ghi đè realm đã có.
`up` đồng bộ các client/mapper/đơn vị do mã setup quản lý, không thay toàn bộ realm và người dùng.
Thay đổi lớn: sao lưu CSDL Keycloak, thử trên project tách biệt, review diff rồi cập nhật có kiểm soát
bằng Admin Console/Admin API. Không xóa realm đang dùng để “nạp lại”: tài khoản, ID và MFA sẽ bị mất.
Sau thay đổi issuer/khóa, chạy `up` để đồng bộ JWKS và kiểm login Employee/Agent/Manager.
Hồ sơ OTP có hướng dẫn riêng trong [cài đặt](cai-dat.md); không tắt OTP của người khác để test.

Nhập nhân viên CSV: chạy `node scripts/dxdesk.mjs import-nhan-vien --help`, dùng chế độ offline/chạy thử
trước `--thuc-hien`. Tệp mật khẩu xuất ra để ngoài kho, chuyển riêng và yêu cầu đổi lần đầu;
không đưa vào ảnh, commit, issue hoặc log nghiệm thu.

## Xem log và xử lý lỗi

```sh
docker compose --env-file .env -f infra/compose/docker-compose.yml ps
docker compose --env-file .env -f infra/compose/docker-compose.yml logs --tail 100 api apisix
docker compose --env-file .env -f infra/compose/docker-compose.yml logs --tail 100 n8n n8n-publish
docker compose --env-file .env -f infra/compose/docker-compose.yml logs --tail 100 assistant wiki-index
```

`n8n-publish` là tiến trình nạp/kích hoạt workflow; publisher outbox chạy cùng API.
Không công bố `.env`, `docker inspect`, token trong request hoặc log thô chưa kiểm/che bí mật.

| Hiện tượng | Kiểm tra / hành động |
|---|---|
| 401/403 sau SSO | Issuer/audience, thời gian hệ thống, mapper client, JWKS; đăng nhập lại sau `up`, không in JWT |
| 502 sau build API/web | Chạy `up` để gateway nạp lại upstream, kiểm health API, không sửa runtime YAML được sinh |
| Phiếu chưa tự định tuyến | Automation bật chưa, workflow active, n8n/publisher và outbox; thử fixture VPN, không phát lại hàng loạt |
| Thông báo trùng/thiếu | Đối chiếu event ID và idempotency; thông báo chỉ loại sự kiện + ID, không đưa nội dung phiếu vào chat |
| Tệp bị chặn/chưa tải được | ClamAV, kết quả quét, quyền phiếu; URL ký hết hạn thì xin lại, không mở Seaweed ra Internet |
| AI chưa sẵn sàng | `AI_API_KEY` local, model/provider, log assistant/wiki-index, chỉ mục Qdrant; restart assistant sau đổi config |
| Micro không hoạt động | API của trình duyệt, quyền micro, HTTPS/localhost; tiếp tục nhập chữ, không cần thêm khóa AI |
| Migration checksum mismatch | Dừng cập nhật, đối chiếu file với Git và người đã triển khai; thêm migration sửa thay vì sửa file cũ |

APISIX dùng `infra/apisix/apisix.yaml`; `runtime.yaml` sinh từ nguồn và JWKS.
Không sửa tay tệp sinh. AI topic ở `config/doanh-nghiep/assistant.json`; chạy unit/evaluation
rồi restart assistant. Đổi khóa AI trong `.env`, chạy lại `up` để môi trường container được cập nhật.

## Sao lưu và khôi phục

```sh
node scripts/dxdesk.mjs backup
```

Xếp lịch **một phiên bảo trì**: backup tạm dừng các dịch vụ ghi đang chạy để DB và tệp cùng trạng thái,
rồi bật lại trong `finally`. Nếu gateway vốn chạy, APISIX được restart sau writers để bỏ IP upstream cũ.
Chỉ báo hoàn tất khi phục hồi dịch vụ xong. Nếu báo lỗi phục hồi, archive hoàn chỉnh được giữ;
kiểm dịch vụ/gateway và `verify` trước khi mở lại cho người dùng. Gateway vốn tắt không tự bật.
Sao lưu gồm roles, các CSDL của hồ sơ, SeaweedFS và manifest SHA-256; `.env` **không nằm trong bản sao**.
Giữ `.env`, khóa mã hóa n8n và bí mật liên quan riêng trong nơi bảo mật. Thiếu khóa cũ có thể khiến
credentials không giải mã được dù dữ liệu DB đã phục hồi. Qdrant có thể dựng lại từ Wiki nguồn.

Lưu mặc định trong `.local/backups`, cấu hình `BACKUP_DIR`/`BACKUP_KEEP` xem [cài đặt](cai-dat.md).
Kiểm manifest, copy ra thiết bị/kho tách máy, giới hạn người đọc và diễn tập phục hồi định kỳ.
Khóa thao tác trong `.local/backup-locks` ngăn hai lần backup/restore trên cùng project.
Nếu tiến trình bị kill để lại khóa, xác nhận không còn tác vụ chạy và đúng project trước khi xử lý khóa;
không xóa khóa để chạy chồng tác vụ.

```sh
# Chỉ chạy trên project đích đã xác định và được phép thay toàn bộ dữ liệu:
node scripts/dxdesk.mjs restore <thu-muc-ban-sao> --xac-nhan
node scripts/dxdesk.mjs up
node scripts/dxdesk.mjs verify
```

**Restore xóa/thay CSDL và nội dung SeaweedFS của project đích.** Kiểm đường dẫn, manifest,
profile, phiên bản chính PostgreSQL và project trước khi xác nhận. Script kiểm checksum/cấu trúc
archive trước khi dừng/xóa; lỗi khi đã phục hồi một phần vẫn cần người vận hành xử lý,
không có cam kết tự rollback toàn stack. Không tiếp tục phục vụ từ trạng thái phục hồi dở.
Diễn tập vào project/volume riêng, không dùng bản đang phục vụ làm nơi thử. Đối chiếu số dòng,
vai trò RLS, tệp tải SHA-256, đăng nhập và `verify`, rồi mới công nhận phục hồi thành công.
VPS/lịch sao lưu tự động chỉ coi là đã bật khi có log lần chạy và người chịu trách nhiệm xác nhận.

## Nghiệm thu một phiên bản source

```sh
# Cây Git sạch, chỉ chạy ở demo: tạo dữ liệu giả lập, restart n8n và thử SLA thật.
node tools/testing/regression.mjs --allow-demo-writes
# Chạy riêng một nhóm, vẫn tuần tự:
node tools/testing/regression.mjs --allow-demo-writes --only=verify,requester-reopen
```

Runner ghi SHA/tree, OS/Node/Docker, profile, thời gian và cả bài fail vào
`.local/reports/regression-<thoi-gian>/report.json`; log lọc các bí mật đã biết trong `.env`.
Kiểm `cleaned_up` của bài OTP/CSV: hoàn thành các bước nghiệp vụ nhưng chưa dọn fixture vẫn là bài fail.
Kiểm restart n8n chỉ bật lại service đã dừng bằng `--no-deps`; nạp workflow dùng lệnh riêng ở trên.
Vẫn review artifact trước khi chia sẻ. Chạy `npm ci --prefix tools/testing` và cài Playwright Chromium trước.
Các unit/integration/migration chạy riêng theo [CONTRIBUTING](../CONTRIBUTING.md).
Một host dev đã có volume không được gọi là máy sạch. Kiểm clone/cài mới ở VM/runner mới
và người khác làm theo hướng dẫn là gate riêng. Đợt #92 hiện nghiệm thu source/PR, **chưa gắn v1.0.0**.
