# Tham số giả định cho bộ sinh dữ liệu

- Cập nhật: 12/11/2026. Người phụ trách: Nguyên; hỗ trợ: Séc.
- Phạm vi: DX-Desk phục vụ **bộ phận CNTT nội bộ của doanh nghiệp / tổ chức** (danh mục, nhóm xử lý,
  vai trò Employee/Agent/Manager, bài tri thức — migration 016).
- Mọi tham số dưới đây là **giả định của đội**, không lấy từ số liệu vận hành của đơn vị nào.

## Lịch sử: W4-10 đã hủy

W4-10 (issue #24) dự định trao đổi với Trung tâm CNTT của trường như một đơn vị tham chiếu để chỉnh
tham số. Ngày 12/11/2026 đội chốt DX-Desk chỉ phục vụ doanh nghiệp, không còn liên quan Trung tâm CNTT
của trường, nên **hủy buổi khảo sát**. Phương án B của ADR 0010 (xin máy của trường chạy bản Internet)
cũng bỏ theo. Bộ sinh dữ liệu giữ nguyên cấu trúc; tham số giữ là giả định của đội.

## Câu trả lời ngắn cho giám khảo

Toàn bộ ticket trong demo là dữ liệu giả lập, gắn nhãn `[SYNTHETIC]`, sinh từ seed cố định
(`scripts/seed-synthetic.mjs`). Phân bố loại yêu cầu, quy mô và cao điểm là giả định của
đội cho một bộ phận CNTT nội bộ, ghi ở bảng dưới; không phải số liệu vận hành thật. Doanh nghiệp
triển khai thật chỉ cần đổi tham số của bộ sinh (hoặc dùng dữ liệu của chính mình).

## Tham số cho bộ sinh dữ liệu (giả định của đội)

Đội đặt các số dưới đây để bộ sinh dữ liệu có cấu trúc giống một bộ phận CNTT nội bộ, đủ để demo
luồng VPN và báo cáo SLA.

| Tham số | Giá trị giả định | Ánh xạ trong DX-Desk |
|---|---|---|
| Số yêu cầu mỗi tháng (tuần thường) | 600 | `--count` theo số tuần × 150 |
| Hệ số cao điểm (2 tuần đầu năm, triển khai hệ thống mới) | ×2,5 | phân bố ngày tạo ticket |
| Đơn vị người gửi | 6 phòng ban mô phỏng, phân bố đều | ghi trong mô tả ticket (W4-07) |
| Tài khoản, email, phần mềm nghiệp vụ | 35% | `account` |
| Wi-Fi, mạng, VPN | 25% tổng cộng | `vpn` cho cả nhóm. Bộ sinh không tách trọng số riêng cho VPN trong nhóm này. |
| Thiết bị văn phòng | 20% | `hardware` |
| Phần mềm bản quyền | 12% | `software` |
| Cấp quyền hệ thống (cần duyệt) | 5% | `access` |
| Sự cố hệ thống dùng chung | 3% | `system-error` |
| Kênh tiếp nhận | Email 40%, trực tiếp/điện thoại 35%, nhóm chat 25% | chỉ dùng cho bản ý tưởng, chưa vào schema |
| Số người xử lý | Giả định 6 người, chia 3 nhóm (Mạng, Tài khoản/Phần mềm, Thiết bị) | Realm demo có hai Agent và một Manager để kiểm thử vai trò và roster. |

Tình huống VPN client 4.2 (W5-05) là tham số kịch bản riêng, không suy từ bảng trên.

## Người dùng giả lập

Bộ sinh **chỉ dùng người dùng mẫu sẵn có trong realm**, gán thuộc tính phòng ban ở phía bộ sinh
dữ liệu (ghi trong mô tả ticket, gắn nhãn `[SYNTHETIC]`). Lý do: không phình realm, không phải dọn
tài khoản giả sau demo, và thống kê theo phòng ban vẫn tái lập được nhờ seed cố định.
