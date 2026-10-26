# Quyết định kiến trúc (ADR)

Mỗi quyết định hoặc biên bản thử nghiệm ghi thành một tệp `NNNN-ten-ngan.md` theo [mẫu](0000-mau.md): bối cảnh, quyết định, phương án đã xem xét, kết quả hoặc biên bản thử nghiệm, hệ quả. Số tệp được cấp trước trong bảng dưới đây để tránh trùng; khi cần số mới, thêm một dòng vào bảng trong cùng pull request.

| Số | Nội dung | Mã kế hoạch | Người ghi | Trạng thái |
|---|---|---|---|---|
| [0001](0001-apisix-standalone.md) | APISIX chạy chế độ standalone | W2-03 | TV1 | Đã chốt 19/10/2026 |
| [0002](0002-vai-tro-csdl-rls.md) | Vai trò CSDL và RLS dùng chung | W2-06 | TV2 | Đã triển khai, chờ review |
| [0003](0003-tn02-jwt-claims.md) | TN-02: claims trong giao dịch NestJS | W2-07, TN-02 | TV2 | Kiểm chứng theo kế hoạch tuần 2 |
| [0004](0004-tn01-appsmith-react.md) | TN-01: chọn phương án dự phòng React | W2-09, TN-01 | TV3 | Đánh giá tài liệu, chờ review |
| [0005](0005-tn05-tai-nguyen.md) | TN-05 vòng 1: công cụ và quy trình đo | W2-10, TN-05 | TV3 | Chưa đo máy demo |
| [0006](0006-n8n-import.md) | n8n, import workflow và credentials | W2-04 | TV1 | Có quy trình, chờ runtime |
| [0007](0007-vi-tri-quet-clamav.md) | TN-03: vị trí quét ClamAV cho tệp đính kèm | W3-06, TN-03, QĐ-3 | TV1 | Đã chốt (QĐ-3), chờ EICAR trên Docker/CI |
| [0008](0008-sso-keycloak-cho-ung-dung-co-san.md) | TN-04: SSO cho Wiki.js, Mattermost TE, Metabase OSS | W3-08, TN-04, QĐ-2 | TV1 | QĐ-2 chốt theo tài liệu, chưa thử runtime |

Các số tiếp theo dự kiến dành cho TN-05 vòng 2/QĐ-5 (mô hình LLM) và QĐ-7 (nơi chạy bản Internet).
