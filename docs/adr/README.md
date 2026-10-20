# Quyết định kiến trúc (ADR)

Mỗi quyết định hoặc biên bản thử nghiệm ghi thành một tệp `NNNN-ten-ngan.md` theo [mẫu](0000-mau.md): bối cảnh, quyết định, phương án đã xem xét, kết quả hoặc biên bản thử nghiệm, hệ quả. Số tệp được cấp trước trong bảng dưới đây để tránh trùng; khi cần số mới, thêm một dòng vào bảng trong cùng pull request.

| Số | Nội dung | Mã kế hoạch | Người ghi | Trạng thái |
|---|---|---|---|---|
| [0001](0001-apisix-standalone.md) | APISIX chạy chế độ standalone | W2-03 | TV1 | Đã chốt 19/10/2026 |
| 0002 | Vai trò CSDL `authenticated` và phân quyền chi tiết trong RLS qua `request.jwt.claims` | W2-06 | TV2 | Đề xuất |
| 0003 | Biên bản TN-02: Service Desk API đặt `SET LOCAL request.jwt.claims` trong giao dịch | W2-07, TN-02 | TV2 | Đang thử |
| 0004 | Biên bản TN-01 và QĐ-1: Appsmith hay React cho ứng dụng 2 | W2-09, TN-01 | TV3 | Đang thử |
| 0005 | Biên bản TN-05 vòng 1: RAM Tầng 1, tốc độ mô hình 1,5B/3B/4B trên máy 16 GB | W2-10, TN-05 | TV3 | Đang đo |
| 0006 | n8n nằm ngoài kho mã, nạp workflow và credentials khi chạy | W2-04 | TV1 | Đã chốt, chưa ghi |

Các số tiếp theo dự kiến dành cho TN-03/QĐ-3 (vị trí quét ClamAV), TN-04/QĐ-2 (SSO ứng dụng có sẵn), TN-05 vòng 2/QĐ-5 (mô hình LLM) và QĐ-7 (nơi chạy bản Internet).
