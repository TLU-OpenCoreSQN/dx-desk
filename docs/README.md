# Tài liệu DX-Desk

Thư mục này chứa tài liệu kỹ thuật dài hơn [README](../README.md) của kho: kiến trúc, cài đặt chi tiết, vận hành, đặc tả API và các quyết định kiến trúc. README chỉ giới thiệu và hướng dẫn chạy nhanh bằng `make up`.

| Tệp | Trả lời câu hỏi | Trạng thái |
|---|---|---|
| [adr/](adr/README.md) | Vì sao hệ thống được thiết kế như vậy, thử nghiệm nào đã làm và kết quả ra sao | Đang viết |
| `kien-truc.md` | Ba tầng DX-OS, ánh xạ H-P-D-I, Zero-Trust (Keycloak, APISIX, RLS), luồng một ticket | Tuần 5–7 |
| [du-lieu.md](du-lieu.md) | Schema/RLS tuần 2; JSON-LD/DCAT ở mốc sau | Đã có bản tuần 2 |
| [cai-dat.md](cai-dat.md) | Cài đặt/kiểm thử tuần 2, Windows/Linux, xử lý sự cố | Đã có bản tuần 2 |
| `van-hanh.md` | Khởi động, dừng, đặt lại; nạp lại workflow n8n và realm Keycloak; log; sao lưu | Tuần 5 |
| `huong-dan-su-dung.md` | Thao tác theo vai trò Employee, Agent, Manager | Tuần 7 |
| [api/](api/contract.md) | Contract và OpenAPI cho các endpoint tuần 2 | Đã có bản tuần 2 |

## Tài liệu tuần 2

- [Kế hoạch và tiến độ có ô tick](ke-hoach-tuan-2.md).
- [Cài đặt Windows/Linux và kiểm thử](cai-dat.md).
- [Schema và quyền dữ liệu](du-lieu.md).
- [API contract](api/contract.md) và [OpenAPI](api/openapi.yaml).
- [Kịch bản demo/nghiệm thu](demo-tuan-2.md).
- [Báo cáo kiểm thử và bàn giao](bao-cao-kiem-thu-tuan-2.md).
- [Danh sách Issue chuẩn bị cho GitHub](github-issues-tuan-2.md).
- [Chuẩn bị phát hành và việc cần người phụ trách](phat-hanh-tuan-2.md).

## Tài liệu tuần 3

- [Kế hoạch tuần 3 và trạng thái tiêu chí M2](ke-hoach-tuan-3.md).
- [Hoàn thiện tuần 3: ánh xạ W3-01…W3-09, lệnh kiểm thử, phần cần người nghiệm thu](hoan-thien-tuan-3.md).
- [Các bản sửa sau review source](sec-dev-fixes.md).
- ADR tuần 3: [0007 vị trí quét ClamAV](adr/0007-vi-tri-quet-clamav.md), [0008 SSO cho ứng dụng có sẵn](adr/0008-sso-keycloak-cho-ung-dung-co-san.md), [0009 JWT tại gateway và URL tải tệp](adr/0009-gateway-jwt-va-url-tai-tep.md).

## Quy ước

- Tên tệp viết tiếng Việt không dấu, nối bằng gạch ngang. Chỉ tạo thư mục con khi có nhiều tệp cùng loại.
- Sơ đồ vẽ bằng [Mermaid](https://mermaid.js.org/) ngay trong tệp `.md` để GitHub hiển thị được và không cần khai báo giấy phép riêng cho ảnh. Nếu buộc phải dùng ảnh, thêm đường dẫn ảnh vào `REUSE.toml`.
- Tệp YAML hoặc mã trong `docs/` ghi chú thích SPDX ở đầu tệp để `reuse lint` không báo lỗi.
- Thay đổi cách cài đặt, vận hành hay API thì sửa tài liệu trong cùng pull request với mã.
