# Phát hành v0.5.0 (mốc M4, Chủ Nhật 15/11/2026)

Tài liệu chuẩn bị cho W5-09 (issue #34), người phụ trách Nguyên. **Chưa tạo tag hoặc GitHub Release.**
Quy trình gắn thẻ giống [v0.1.0](phat-hanh-v0.1.0.md). Chỉ phát hành khi bảng mốc M4 dưới đây không
còn dòng "Chưa xong" ở phạm vi cam kết, hoặc dòng đó đã được đội đồng ý dời sang mốc sau và ghi lý do.

## Bảng mốc M4

Trạng thái: **Đạt** (đã gộp `main`, CI xanh), **Đang review** (có PR), **Chưa xong**, **Có rủi ro**.
Cập nhật ngày 07/11/2026; người cập nhật ghi ngày mới khi sửa bảng.

| Mã | Việc | Người | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| W5-01 | Ứng dụng 2 "Xin cấp thiết bị" | Quyền | Chưa xong | #26 |
| W5-02 | RLS cho `device_requests` | Quyền | Chưa xong | #27 |
| W5-03 | Biên bản bàn giao PDF lưu SeaweedFS | Quyền | Chưa xong | #28 |
| W5-04 | Tài nguyên JSON-LD | Quyền | Chưa xong | #29 |
| W5-05 | Dữ liệu giả lập 6–8 tuần | Séc | Chưa xong | #30 |
| W5-06 | Dashboard Metabase | Séc | Chưa xong — có sẵn view `reporting.self_service_weekly` và vai trò `reporting_reader` từ W5-08 | #31 |
| W5-07 | Danh mục dữ liệu JSON-LD/DCAT | Séc | Chưa xong | #32 |
| W5-08 | Wiki.js SSO, 6 bài, gợi ý, lượt tự phục vụ | Nguyên | Đạt | PR #37 gộp `main` 04/11, CI run [41863352656](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/41863352656) xanh; nghiệm thu máy dev và cài sạch ở mục dưới; còn đóng issue #33 |
| W5-09 | Notices, docs, đo RAM, phát hành | Nguyên | Đang làm — phần Wiki.js đã gộp qua PR #37; checklist phát hành bên dưới chưa tick mục nào | #34 |
| W5-10 | View chỉ số tự động hóa H-P-D-I | Quyền | Chưa xong | #35 |
| QĐ-7 | Nơi chạy bản Internet | Nguyên | Có rủi ro nếu chưa chốt trước 14/11 — ADR 0010 *Đề xuất* | #36, PR #37 |

## Nghiệm thu cài sạch

| Ngày | Người | Máy | Cách làm | Kết quả |
|---|---|---|---|---|
| 04/11/2026 | Nguyên (máy viết compose) | Windows 11, Docker 29.8.2 | Clone mới nhánh `feature/wiki-knowledge-self-service` (SHA `5893d1b`), `.env` chép từ `.env.example`, project Compose riêng nên volume trống, `node scripts/dxdesk.mjs up` | **Đạt**: `up` thoát 0 (tạo 6 bài Wiki, client `wikijs`), `week5-wiki` 4/4, `stack-test` thoát 0. Chưa thay thế được dòng dưới vì cùng máy đã có image |
| … | *thành viên khác* | … | `cp .env.example .env && make up` trên máy chưa từng chạy DX-Desk | **Bắt buộc trước khi gắn thẻ** |

## Checklist phát hành

Ghi SHA, link run CI hoặc tên người nghiệm thu cạnh mỗi mục khi tick.

- [ ] Mọi PR thuộc phạm vi M4 đã gộp `main`; bảng mốc trên cập nhật, mục dời mốc có lý do.
- [ ] `THIRD-PARTY-NOTICES.md`: thêm Metabase (W5-06), thư viện/phông PDF (W5-03), thư viện JSON-LD (W5-04), thư viện mới của ứng dụng 2 (W5-01). Wiki.js đã chuyển sang thành phần sản phẩm (PR #37).
- [ ] `reuse lint` sạch, gồm dữ liệu giả lập W5-05 (CC0 hoặc CC BY 4.0).
- [ ] Đo lại RAM `full` và `demo-light` đủ ba lượt theo W4-09 khi đã có Wiki.js, Metabase, ứng dụng 2; cập nhật `docs/tai-nguyen.md` và ADR 0010.
- [ ] `docs/`: `cai-dat.md` (dịch vụ, cổng mới của Metabase/ứng dụng 2), `du-lieu.md`, `docs/data/README.md`, ADR 0004, kịch bản demo cảnh 1–3.
- [ ] `CHANGELOG.md`: đổi "Chưa phát hành" thành `[0.5.0] - 2026-11-15`; nâng `version` của `apps/api`, `apps/web` và lockfile, chuỗi version trong `/api/health` và `docs/api/openapi.yaml`.
- [ ] Thành viên khác thử `make up` trên máy sạch (bảng trên).
- [ ] CI xanh trên `main` tại SHA sẽ gắn thẻ, gồm nghiệm thu stack (`week4-stack`, `week4-browser`, `week5-wiki`).
- [ ] Rà không có `.env`, credentials, token, `.local`/`work` trong commit.
- [ ] `git tag -a v0.5.0 -m "DX-Desk v0.5.0"` trên SHA đó của `main`, `git push origin v0.5.0`.
- [ ] `make release VERSION=0.5.0`, kiểm tra tarball không chứa bí mật hoặc tệp sinh.
- [ ] GitHub Release từ tag, release notes theo CHANGELOG, đính kèm tarball; đóng milestone M4.
- [ ] Báo thầy kèm link release và bảng mốc.
