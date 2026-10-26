# Hướng dẫn đóng góp

## Quy trình

1. Mỗi việc là một Issue (mã việc theo kế hoạch, ví dụ `W3-02`) có nhãn tuần và nhãn không gian (H, P, D, I, nền tảng, PoF).
2. Tạo nhánh riêng từ `main`, ví dụ `feat/ticket-state-machine`. Không đẩy trực tiếp lên `main`.
3. Commit theo [Conventional Commits](https://www.conventionalcommits.org/vi): `feat:`, `fix:`, `docs:`, `chore:`…
4. Mở pull request, cần ít nhất một người duyệt và CI (`reuse lint`, kiểm tra Compose, kiểm thử) phải xanh.

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
