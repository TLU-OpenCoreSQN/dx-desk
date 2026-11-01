# Hướng dẫn đóng góp

## Quy trình

1. Mỗi việc là một Issue (mã việc theo kế hoạch, ví dụ `W3-02`) có nhãn tuần và nhãn không gian (H, P, D, I, nền tảng, PoF).
2. Với phần việc của SecNV, đồng bộ `main` rồi phát triển, sửa lỗi, build và chạy thử trên `develop-secnv`. Nhánh này được đổi tên từ `sec-dev` ngày 01/11/2026; không dùng lại tên cũ.
3. Commit theo [Conventional Commits](https://www.conventionalcommits.org/vi): `feat:`, `fix:`, `docs:`, `chore:`… Mỗi commit là một thay đổi chức năng có ý nghĩa, gồm kiểm thử/tài liệu liên quan; gom các sửa nhỏ cùng chức năng trước khi bàn giao.
4. Chỉ xuất bản `feature/<ten-chuc-nang>` khi chức năng đã hoàn thiện, build và kiểm thử đạt trên `develop-secnv`. Ví dụ `feature/secure-ticket-workflow` là bản bàn giao luồng ticket tuần 3, được đổi tên từ `week3-complete`. Nếu cần sửa tiếp, quay lại `develop-secnv`, kiểm thử rồi mới cập nhật nhánh feature bằng các commit đúng phạm vi; không đưa việc đang dở vào nhánh feature.
5. Mở pull request từ nhánh bàn giao vào `main`, cần ít nhất một người duyệt và CI (`reuse lint`, Compose, build/test, nghiệm thu chức năng) phải xanh. `main` là bản tích hợp, không đẩy trực tiếp. Nhánh của thành viên khác tiếp tục theo quy ước của nhóm; không tự đổi hoặc xóa.

CI chạy khi push `develop-secnv`, `feature/**`, `main` và nhánh đồng đội đang dùng,
cũng như mọi pull request. Đổi tên nhánh không thay thế việc kiểm thử; ghi SHA và
bằng chứng của bản đã chạy, không tự coi checkbox hoặc build thành công là nghiệm thu.

## Định nghĩa "xong"

- Mã đã gộp vào `main` qua pull request được duyệt, CI xanh.
- Mọi tệp mới có header giấy phép Apache-2.0 theo mẫu bên dưới; tệp không viết được chú thích (JSON, Markdown…) được khai báo trong `REUSE.toml`.
- Chạy được từ máy sạch bằng `cp .env.example .env && make up`, không phải sửa tay tệp nào khác.
- Có kiểm thử tự động cho quy tắc nghiệp vụ mới.
- README, `docs/` hoặc OpenAPI được cập nhật nếu thay đổi cách cài đặt hoặc API.

## Header giấy phép

Tệp mã:

```text
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
```

(dùng `//` hoặc `--` tùy ngôn ngữ). Kiểm tra cục bộ bằng `reuse lint` (cài `pip install reuse`).

## Quy ước khác

- Không dùng thẻ `latest` cho image Docker; ghim phiên bản trong `.env.example`.
- Không đưa bí mật thật vào kho; chỉ giá trị mẫu trong `.env.example`.
- Quyết định kiến trúc ghi thành tệp trong `docs/adr/`.
