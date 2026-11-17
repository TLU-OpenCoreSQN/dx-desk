# Phát hành v0.5.0 (mốc M4)

Tài liệu chuẩn bị cho W5-09 (issue #34), người phụ trách Nguyên. **Đã phát hành 17/11/2026:** tag `v0.5.0` trên `main` `f564410`, [GitHub Release](https://github.com/TLU-OpenCoreSQN/dx-desk/releases/tag/v0.5.0) kèm `dx-desk-0.5.0.tar.gz`.

**Lùi ngày phát hành (12/11/2026):** ngày dự kiến ban đầu là Chủ Nhật 15/11. Đội quyết định chỉ gắn thẻ
`v0.5.0` khi W5-01..04 và W5-10 đã gộp `main`; ngày mới chốt khi các PR đó vào review.
Quy trình gắn thẻ giống [v0.1.0](phat-hanh-v0.1.0.md). Chỉ phát hành khi bảng mốc M4 dưới đây không
còn dòng "Chưa xong" ở phạm vi cam kết, hoặc dòng đó đã được đội đồng ý dời sang mốc sau và ghi lý do.

## Bảng mốc M4

Trạng thái: **Đạt** (đã gộp `main`, CI xanh), **Theo PR** (xem trạng thái merge và CI ở liên kết), **Chưa xong**, **Có rủi ro**.
Cập nhật ngày 17/11/2026; người cập nhật ghi ngày mới khi sửa bảng.

| Mã | Việc | Người | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| W5-01 | Ứng dụng 2 "Xin cấp thiết bị" | Quyền | Đạt | #26 đã đóng, [PR #43](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/43) gộp `main` 14/11 (`0711738`), [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/43565361949) gồm `week5-device` |
| W5-02 | RLS cho `device_requests` | Quyền | Đạt | #27, [PR #42](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/42), migrations 018 và 021, [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/43564099930) |
| W5-03 | Biên bản bàn giao PDF lưu SeaweedFS | Quyền | Đạt | #28 đã đóng, [PR #44](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/44) gộp `main` 14/11 (`3ea052b`), migrations 019 và 022, [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/43565565633) |
| W5-04 | Tài nguyên JSON-LD | Quyền | Đạt | #29 đã đóng, [PR #45](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/45) gộp `main` 14/11 (`d5c0809`), migrations 020 và 023, [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/43566041353) |
| W5-05 | Dữ liệu giả lập 6–8 tuần | Séc | Đạt | PR #38 gộp `main` 11/11 (`29c07ae`), CI run [42989051130](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/42989051130) xanh; #30 đã đóng |
| W5-06 | Dashboard Metabase | Séc | Đạt (hồ sơ `full`) | PR #38, CI run [42989051130](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/42989051130) gồm job "Metabase và KPI demo tuần 5"; #31 đã đóng |
| W5-07 | Danh mục dữ liệu JSON-LD/DCAT | Séc | Đạt | PR #38, CI run [42989051130](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/42989051130); #32 đã đóng |
| W5-08 | Wiki.js SSO, 6 bài, gợi ý, lượt tự phục vụ | Nguyên | Đạt | PR #37 gộp `main` 04/11, CI run [41863352656](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/41863352656) xanh; nghiệm thu máy dev và cài sạch ở mục dưới; #33 đã đóng. Bối cảnh doanh nghiệp được cập nhật trong [PR #39](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/39). |
| W5-09 | Notices, docs, đo RAM, phát hành | Nguyên | Đã phát hành. Còn thiếu biên bản nghiệm thu máy sạch của một thành viên khác. | #34, [Release v0.5.0](https://github.com/TLU-OpenCoreSQN/dx-desk/releases/tag/v0.5.0) ngày 17/11, [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/44025966010) tại `f564410`, [số đo RAM](tai-nguyen.md#đo-lại-trước-v050--có-ứng-dụng-2-w5-09-17112026) và [kịch bản demo](demo-tuan-5.md) |
| W5-10 | View chỉ số tự động hóa H-P-D-I | Quyền | Đạt | #35, [PR #41](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/41), migration 017, [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/43257507451) |
| QĐ-7 | Nơi chạy bản Internet | Nguyên | Đã chốt 12/11 (thuê VPS, ADR 0010); còn thuê VPS và SSH được trước 16/11 | #36 |
| W4-10 | Khảo sát Trung tâm CNTT (tồn từ M3) | Nguyên | Hủy 12/11 — dự án chỉ phục vụ doanh nghiệp; tham số giữ là giả định của đội ([tham-so-du-lieu-gia-lap.md](tham-so-du-lieu-gia-lap.md)) | #24 |

## Nghiệm thu cài sạch

| Ngày | Người | Máy | Cách làm | Kết quả |
|---|---|---|---|---|
| 04/11/2026 | Nguyên (máy viết compose) | Windows 11, Docker 29.8.2 | Clone mới nhánh `feature/wiki-knowledge-self-service` (SHA `5893d1b`), `.env` chép từ `.env.example`, project Compose riêng nên volume trống, `node scripts/dxdesk.mjs up` | **Đạt**: `up` thoát 0 (tạo 6 bài Wiki, client `wikijs`), `week5-wiki` 4/4, `stack-test` thoát 0. Chưa thay thế được dòng dưới vì cùng máy đã có image |
| … | *thành viên khác* | … | `cp .env.example .env && make up` trên máy chưa từng chạy DX-Desk | **Chưa có kết quả được ghi nhận khi gắn thẻ**. Cần bổ sung biên bản nghiệm thu theo tiêu chí của #34. |

## Checklist phát hành

Ghi SHA, link run CI hoặc tên người nghiệm thu cạnh mỗi mục khi tick.

- [x] Mọi PR thuộc phạm vi M4 đã gộp `main` (17/11, đến `8e5f434` gồm UI/UX [PR #47](https://github.com/TLU-OpenCoreSQN/dx-desk/pull/47), [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/44007106904)); bảng mốc trên cập nhật, mục dời mốc có lý do.
- [x] `THIRD-PARTY-NOTICES.md` (PR #44, #45 gộp `main` 14/11; ứng dụng 2 không thêm thư viện mới): thêm thư viện/phông PDF (W5-03), thư viện JSON-LD (W5-04), thư viện mới của ứng dụng 2 (W5-01). Đã xong 12/11: Wiki.js, Mattermost TE, Metabase OSS chuyển sang thành phần sản phẩm; PR #38 không thêm dependency npm mới. 13/11: PDFKit và phông Noto Sans (OFL-1.1, `LICENSES/OFL-1.1.txt`) đã ghi ở PR #44, `jsonld` 9.0.0 (BSD-3-Clause, devDependency) ở PR #45; đánh dấu xong khi các PR này gộp `main`.
- [x] (`f564410`, [CI](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/44025966010)) `reuse lint` sạch tại SHA gắn thẻ. Dữ liệu giả lập W5-05 đã khai báo CC0-1.0 trong `REUSE.toml` (PR #38).
- [x] (17/11, `8f4320f`, [tai-nguyen.md](tai-nguyen.md#đo-lại-trước-v050--có-ứng-dụng-2-w5-09-17112026)) Đã đo RAM ba lượt mỗi hồ sơ khi có ứng dụng 2, đạt đỉnh `demo-light` 3,22 GiB và `full` 4,60 GiB. Số đo được ghi trong tài liệu tài nguyên và ADR 0010.
- [x] (17/11, kịch bản [demo-tuan-5.md](demo-tuan-5.md)) `docs/`: `cai-dat.md` (dịch vụ, cổng mới của Metabase/ứng dụng 2), `du-lieu.md`, `docs/data/README.md`, ADR 0004, kịch bản demo cảnh 1–3.
- [x] (PR phát hành 17/11) `CHANGELOG.md`: đổi "Chưa phát hành" thành `[0.5.0] - <ngày gắn thẻ>`; nâng `version` của `apps/api`, `apps/web` và lockfile, chuỗi version trong `/api/health` và `docs/api/openapi.yaml`.
- [ ] Thành viên khác thử `make up` trên máy sạch (bảng trên).
- [x] ([run 44025966010](https://github.com/TLU-OpenCoreSQN/dx-desk/actions/runs/44025966010), 14/14 job) CI xanh trên `main` tại SHA sẽ gắn thẻ, gồm nghiệm thu stack (`week4-stack`, `week4-browser`, `week5-wiki`).
- [x] (17/11, cây `main` và tarball chỉ có `.env.example`) Rà không có `.env`, credentials, token, `.local`/`work` trong commit.
- [x] (17/11, Nguyên, tag trỏ `f564410`) `git tag -a v0.5.0 -m "DX-Desk v0.5.0"` trên SHA đó của `main`, `git push origin v0.5.0`.
- [x] (17/11, 355 mục, không có bí mật hay tệp sinh) `make release VERSION=0.5.0`, kiểm tra tarball không chứa bí mật hoặc tệp sinh.
- [x] ([v0.5.0](https://github.com/TLU-OpenCoreSQN/dx-desk/releases/tag/v0.5.0), 17/11) GitHub Release từ tag, release notes theo CHANGELOG, đính kèm tarball; đóng milestone M4.
- [ ] Báo thầy kèm link release và bảng mốc.
