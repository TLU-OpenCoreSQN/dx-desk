# Hướng dẫn đóng góp

Tài liệu này dành cho thành viên nhóm khi sửa mã, cấu hình hoặc tài liệu của DX-Desk.
Cài đặt và vận hành chi tiết xem [README](README.md) và [docs/cai-dat.md](docs/cai-dat.md);
mục lục tài liệu ở [docs/README.md](docs/README.md).

## Chuẩn bị môi trường

- Git, Docker Engine với Compose v2, Node.js `>=22.12`.
- GNU Make là tùy chọn. Trên Windows dùng `node scripts/dxdesk.mjs <lệnh>`, chạy cùng runner với `make`.
- Để chạy các cổng kiểm tra cục bộ: `reuse` (`pip install reuse`), `shellcheck`.

Dựng stack lần đầu:

```sh
cp .env.example .env
node scripts/dxdesk.mjs up       # hoặc: make up
node scripts/dxdesk.mjs verify   # kiểm chứng Keycloak, APISIX, API, PostgREST, n8n
```

Tài khoản thử nghiệm và mật khẩu xem README. Không có `package.json` ở thư mục gốc:
mỗi gói có lockfile riêng, chạy npm với `--prefix` (ví dụ `npm ci --prefix apps/api`).

## Quy trình làm việc

1. **Issue.** Mỗi việc là một Issue, tạo từ mẫu *Công việc theo kế hoạch* (mã `W<tuần>-<số>`,
   ví dụ `W6-15`) hoặc *Báo lỗi*. Gắn nhãn tuần và nhãn không gian (H, P, D, I, nền tảng, PoF).
2. **Nhánh phát triển.** Mỗi thành viên làm việc trên nhánh `develop-<tên>` của mình
   (ví dụ `develop-secnv`). Đồng bộ `main` trước khi bắt đầu, sau đó phát triển, sửa lỗi,
   build và chạy thử trên nhánh này. Không tự đổi tên hoặc xóa nhánh của người khác.
3. **Commit** theo mục [Thông điệp commit](#thông-điệp-commit). Gom các sửa nhỏ cùng một
   chức năng trước khi bàn giao.
4. **Nhánh bàn giao.** Chỉ xuất bản `feature/<ten-chuc-nang>` khi chức năng đã hoàn thiện,
   build và kiểm thử đạt. Không đưa việc đang dở vào nhánh feature. Cần sửa tiếp thì quay lại
   nhánh `develop-<tên>`, kiểm thử, rồi cập nhật nhánh feature bằng các commit đúng phạm vi.
5. **Pull request** vào `main` theo mẫu có sẵn, ghi `Closes #<số>`. Cần ít nhất một người duyệt
   và CI xanh. `main` là bản tích hợp, không đẩy trực tiếp.

CI chạy cho mọi pull request và khi push vào `main`, `feature/**` và các nhánh `develop-*` được khai báo
trong [.github/workflows/ci.yml](.github/workflows/ci.yml). Build thành công hay checkbox được đánh
dấu không phải là nghiệm thu: trong pull request ghi SHA của bản đã chạy và bằng chứng
(lệnh, kết quả, báo cáo trong `.local/reports/` hoặc artifact CI).

## Thông điệp commit

Theo [Conventional Commits](https://www.conventionalcommits.org/vi), viết bằng tiếng Việt:

```text
<loại>(<phạm vi>): <mô tả ngắn, chữ thường, không dấu chấm cuối>

- Thay đổi gì và vì sao, mỗi ý một dòng.
- Ghi rõ đã cập nhật tài liệu/kiểm thử nào.
```

- Loại: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
- Phạm vi theo phần bị ảnh hưởng: `web`, `api`, `db`, `infra`, `config`, `scripts`, `docs`…;
  nhiều phần thì nối bằng dấu phẩy, ví dụ `feat(web,config): …`.
- Ghi mã việc ở cuối dòng tiêu đề khi có, ví dụ `(W6-15)`.
- Mỗi commit là một thay đổi có ý nghĩa, đi kèm kiểm thử và tài liệu liên quan.

## Kiểm thử trước khi mở pull request

Chạy các lệnh ứng với phần đã sửa; CI chạy lại toàn bộ.

| Đã sửa | Lệnh |
|---|---|
| Mọi thay đổi | `reuse lint` |
| `apps/api` | `npm ci --prefix apps/api && npm test --prefix apps/api` |
| `apps/web`, `apps/device-request` | `npm ci --prefix apps/<app> && npm run build --prefix apps/<app> && npm test --prefix apps/<app>` |
| `db/` (migration, policy), máy trạng thái | build `apps/api` rồi `npm ci --prefix tools/testing && npm run integration --prefix tools/testing`; `node tools/testing/migration-test.mjs` (cần `psql`) |
| `config/` | `node scripts/dxdesk.mjs config validate`, `npm run check --prefix tools/testing` |
| `infra/compose`, `.env.example` | `docker compose --env-file .env -f infra/compose/docker-compose.yml [--profile full\|demo-light] config -q` |
| `infra/apisix` | `sh scripts/check-apisix.sh`, `node tools/testing/gateway-test.mjs` |
| `scripts/*.sh`, `infra/postgres/init/*.sh` | `shellcheck` |
| Dependency mới | `npm audit --omit=dev --audit-level=high` trong gói đó |
| Luồng chạy trên stack thật | `node scripts/dxdesk.mjs verify`; tự động hóa: `node tools/testing/week4-stack.mjs` |

`make test` chạy build và unit test cho cả ba ứng dụng.

Lưu ý:

- Các bài nghiệm thu stack làm thay đổi trạng thái dùng chung (khởi động lại n8n, tạm đổi chính sách SLA).
  Không chạy hai bài cùng lúc trên một stack.
- `make reset` xóa toàn bộ volume và dữ liệu.

## Quy tắc kỹ thuật bắt buộc

- **Migration không sửa lại.** Migration đã áp dụng được lưu checksum trong `migration_meta.applied`.
  Muốn thay đổi thì thêm tệp mới đánh số tiếp theo trong `db/migrations/` (policy trong `db/policies/`).
- **Phân quyền nằm ở RLS của PostgreSQL**, không nằm trong mã ứng dụng. API truy cập CSDL qua
  `Database.asUser` / `asAutomation` (`apps/api/src/database.ts`); không thêm đường đi vòng qua RLS.
- **Máy trạng thái phiếu có hai bản**, phải khớp 1:1: `apps/api/src/state-machine.ts` và bảng
  `private.ticket_transitions` trong migration. Sửa một bên thì sửa cả bên kia; kiểm thử tích hợp
  sẽ báo lỗi khi lệch.
- **Thông báo lỗi** trả cho người dùng là câu tiếng Việt cố định (ánh xạ trong `apps/api/src/app.ts`).
  Không để thông báo gốc của PostgreSQL hay câu SQL lọt ra client.
- **Gateway:** sửa `infra/apisix/apisix.yaml`. `runtime.yaml` do `scripts/render-gateway.mjs` sinh ra, không sửa tay.
- **Thông báo Mattermost** chỉ mang loại sự kiện và ID; không đưa tiêu đề, mô tả, thông tin người yêu cầu hay liên kết.
- **Image Docker** ghim phiên bản trong `.env.example`, không dùng `latest`.
- **Bí mật:** không đưa giá trị thật vào kho. `.env.example` chỉ chứa giá trị mẫu.

## Header giấy phép

Mọi tệp mã mới bắt đầu bằng header SPDX, dùng cú pháp chú thích của ngôn ngữ đó:

```text
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN      (shell, YAML, Makefile, Dockerfile)
# SPDX-License-Identifier: Apache-2.0

// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN     (TypeScript, JavaScript)
// SPDX-License-Identifier: Apache-2.0

-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN     (SQL)
-- SPDX-License-Identifier: Apache-2.0
```

- JSON, Markdown, `.gitkeep`, `.gitignore`… đã được khai báo chung trong [REUSE.toml](REUSE.toml), không cần header.
- Tệp khác không viết được chú thích (ảnh, CSV…) hoặc dùng giấy phép khác Apache-2.0
  (bài wiki CC BY 4.0, dữ liệu CC0-1.0) phải thêm vào `REUSE.toml`.
- Kiểm tra bằng `reuse lint`.

## Tài liệu

Cập nhật tài liệu trong cùng pull request với mã:

- Đổi cách cài đặt hoặc vận hành: `README.md`, `docs/cai-dat.md`.
- Đổi API: `docs/api/contract.md` và `docs/api/openapi.yaml`.
- Thay đổi người dùng hoặc người vận hành nhận thấy được: thêm dòng vào mục `[Chưa phát hành]` của
  [CHANGELOG.md](CHANGELOG.md) (nhóm Thêm / Thay đổi / Sửa…, mở đầu bằng mã việc).
- Quyết định kiến trúc: tạo `docs/adr/NNNN-ten.md` từ [mẫu](docs/adr/0000-mau.md), số tiếp theo.
- Quy ước đặt tên và vẽ sơ đồ trong `docs/` xem [docs/README.md](docs/README.md#quy-ước).

## Định nghĩa "xong"

- [ ] Mã đã gộp vào `main` qua pull request được duyệt, CI xanh.
- [ ] Tệp mới có header SPDX hoặc được khai báo trong `REUSE.toml`.
- [ ] Chạy được từ máy sạch bằng `cp .env.example .env && make up`, không phải sửa tay tệp nào khác.
- [ ] Quy tắc nghiệp vụ mới có kiểm thử tự động.
- [ ] README, `docs/`, OpenAPI và CHANGELOG đã cập nhật nếu cần.
