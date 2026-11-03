# Khảo sát Trung tâm CNTT của trường — W4-10

- Mã việc: W4-10 (issue #24). Người phụ trách: Nguyên; hỗ trợ: Séc.
- Cập nhật: 03/11/2026.
- Trạng thái: **chưa trao đổi.** Tham số dữ liệu dưới đây là **giả định của đội**.
  Buổi trao đổi lùi sang tuần 5 và chỉ dùng để chỉnh tham số, không đổi cấu trúc bộ sinh dữ liệu.

Mục đích: có bối cảnh và tham số thật cho bộ sinh dữ liệu (W4-07, W5-05) và mục 2.1
bản ý tưởng; trả lời được câu hỏi "dữ liệu có thật không" của giám khảo.

## Câu trả lời ngắn cho giám khảo (đến khi có biên bản)

Toàn bộ ticket trong demo là dữ liệu giả lập, gắn nhãn `[SYNTHETIC]`, sinh từ seed cố định
(`scripts/seed-synthetic.mjs`). Phân bố loại yêu cầu, quy mô và mùa cao điểm là giả định của
đội, ghi ở bảng dưới; chưa phải số liệu vận hành của Trung tâm CNTT. Khi có buổi trao đổi,
đội chỉ thay tham số và ghi nguồn tại tệp này.

## Nguyên tắc

- Chỉ ghi số liệu tổng hợp (tỷ lệ, khoảng ước tính). Không ghi tên, email người dùng hay nội dung ticket thật.
- Chỉ ghi tên đơn vị vào kho công khai khi đơn vị đồng ý; nếu không, ghi "Trung tâm CNTT của một trường đại học".
- Không ghi âm nếu chưa được đồng ý; biên bản do đội tóm tắt và gửi lại cán bộ xem trước khi đưa vào kho.

## Lịch và đầu việc

- [ ] Nhờ thầy Tạ Chí Hiếu giới thiệu, hẹn 30–45 phút (dự kiến tuần 5, sau demo nội bộ 07/11).
- [ ] Gửi trước danh sách câu hỏi dưới đây; xin phép ghi tên đơn vị.
- [ ] Trao đổi, ghi biên bản theo mẫu cuối tệp, gửi cán bộ duyệt lại.
- [ ] Thay các ô "Giả định" bằng số đã trao đổi; chuyển tham số cho Séc (W4-07/W5-05).
- [ ] Cập nhật mục 2.1 bản ý tưởng (tài liệu ngoài kho).

## Câu hỏi gửi trước

1. Người dùng gửi yêu cầu qua kênh nào (email, điện thoại, đến trực tiếp, nhóm chat, phần mềm)? Tỷ lệ mỗi kênh?
2. Năm loại yêu cầu nhiều nhất (email, Wi-Fi, LMS, phòng máy, phần mềm bản quyền, VPN…) và tỷ lệ ước tính?
3. Mỗi tháng khoảng bao nhiêu yêu cầu? Tỷ lệ giữa giảng viên, sinh viên và cán bộ?
4. Thời điểm cao điểm trong năm học (đầu kỳ, đăng ký tín chỉ, mùa thi)? Cao điểm gấp mấy lần bình thường?
5. Trung tâm có bao nhiêu người xử lý, chia nhóm thế nào? Thời gian xử lý thông thường?
6. Hiện đang dùng công cụ gì để theo dõi yêu cầu? Khó khăn lớn nhất là gì?

## Tham số cho bộ sinh dữ liệu (giả định của đội)

Các số dưới đây **không** lấy từ Trung tâm CNTT. Đội đặt để bộ sinh dữ liệu có cấu trúc
giống bối cảnh trường, đủ để demo luồng VPN và báo cáo SLA. Cột "Nguồn" đổi thành
"Biên bản dd/mm" khi đã trao đổi.

| Tham số | Giá trị giả định | Ánh xạ trong DX-Desk | Nguồn |
|---|---|---|---|
| Số yêu cầu mỗi tháng (tuần thường) | 600 | `--count` theo số tuần × 150 | Giả định |
| Hệ số cao điểm (2 tuần đầu kỳ, đăng ký tín chỉ) | ×2,5 | phân bố ngày tạo ticket | Giả định |
| Tỷ lệ đối tượng | Sinh viên 70%, giảng viên 20%, cán bộ 10% | thuộc tính người dùng (W4-07) | Giả định |
| Tài khoản, email, LMS | 35% | `account` | Giả định |
| Wi-Fi, mạng, VPN | 25% (trong đó VPN 8%) | `vpn` | Giả định |
| Phòng máy, thiết bị | 20% | `hardware` | Giả định |
| Phần mềm bản quyền | 12% | `software` | Giả định |
| Cấp quyền hệ thống (cần duyệt) | 5% | `access` | Giả định |
| Sự cố hệ thống dùng chung | 3% | `system-error` | Giả định |
| Kênh tiếp nhận | Email 40%, trực tiếp/điện thoại 35%, nhóm chat 25% | chỉ dùng cho mục 2.1, chưa vào schema | Giả định |
| Số người xử lý | 6, chia 3 nhóm (Mạng, Tài khoản/Phần mềm, Thiết bị) | team và roster Keycloak | Giả định |
| Mùa thi | ×1,3, chủ yếu phòng máy và LMS | trọng số theo tuần | Giả định |

Tình huống VPN client 4.2 (W5-05) là tham số kịch bản riêng, không suy từ bảng trên.

### Đề xuất cho câu hỏi mở ở W4-07

W4-07 cần chốt: tạo người dùng giả lập trong realm Keycloak hay chỉ dùng người dùng mẫu.
Đề xuất của người phụ trách W4-10: **chỉ dùng người dùng mẫu sẵn có trong realm**, gán
thuộc tính đối tượng/đơn vị ở phía bộ sinh dữ liệu (ghi trong mô tả ticket, gắn nhãn
`[SYNTHETIC]`). Lý do: không phình realm, không phải dọn tài khoản giả sau demo, và
thống kê theo đối tượng vẫn tái lập được nhờ seed cố định. Quyết định cuối cùng chốt cùng Séc.

## Mẫu biên bản

```text
Ngày, hình thức (trực tiếp/trực tuyến), thời lượng:
Đơn vị (nếu được phép ghi tên):
Thành viên đội tham dự:
Đơn vị đồng ý ghi tên công khai: có / không
1. Kênh tiếp nhận và tỷ lệ:
2. Năm loại yêu cầu nhiều nhất và tỷ lệ:
3. Số yêu cầu/tháng; tỷ lệ giảng viên – sinh viên – cán bộ:
4. Thời điểm cao điểm và hệ số:
5. Nhân sự xử lý, cách chia nhóm, thời gian xử lý thông thường:
6. Công cụ đang dùng, khó khăn lớn nhất:
Tham số đã thay trong bảng trên:
Cán bộ đã xem lại biên bản: ngày …
```
