# Tài liệu DX-Desk

Thư mục này chứa tài liệu kỹ thuật dài hơn [README](../README.md) của kho: kiến trúc, cài đặt chi tiết, vận hành, đặc tả API và các quyết định kiến trúc. README chỉ giới thiệu và hướng dẫn chạy nhanh bằng `make up`.

| Tệp | Trả lời câu hỏi | Trạng thái |
|---|---|---|
| [adr/](adr/README.md) | Vì sao hệ thống được thiết kế như vậy, thử nghiệm nào đã làm và kết quả ra sao | Đang viết |
| `kien-truc.md` | Ba tầng DX-OS, ánh xạ H-P-D-I, Zero-Trust (Keycloak, APISIX, RLS), luồng một ticket | Tuần 5–7 |
| `du-lieu.md` | Lược đồ CSDL, chính sách RLS, danh mục JSON-LD và siêu dữ liệu DCAT | Tuần 3–7 |
| `cai-dat.md` | Yêu cầu phần cứng, hồ sơ `full` và `demo-light`, cài từ máy sạch, xử lý sự cố | Tuần 7 |
| `van-hanh.md` | Khởi động, dừng, đặt lại; nạp lại workflow n8n và realm Keycloak; log; sao lưu | Tuần 5 |
| `huong-dan-su-dung.md` | Thao tác theo vai trò Employee, Agent, Manager | Tuần 7 |
| `api/` | Đặc tả OpenAPI của Service Desk API, cách xác thực và gọi qua APISIX | Tuần 7 |

## Quy ước

- Tên tệp viết tiếng Việt không dấu, nối bằng gạch ngang. Chỉ tạo thư mục con khi có nhiều tệp cùng loại.
- Sơ đồ vẽ bằng [Mermaid](https://mermaid.js.org/) ngay trong tệp `.md` để GitHub hiển thị được và không cần khai báo giấy phép riêng cho ảnh. Nếu buộc phải dùng ảnh, thêm đường dẫn ảnh vào `REUSE.toml`.
- Tệp YAML hoặc mã trong `docs/` ghi chú thích SPDX ở đầu tệp để `reuse lint` không báo lỗi.
- Thay đổi cách cài đặt, vận hành hay API thì sửa tài liệu trong cùng pull request với mã.
