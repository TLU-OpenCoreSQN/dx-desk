# Khảo sát vận hành helpdesk CNTT nội bộ — W4-10

- Mã việc: W4-10 (issue #24). Người phụ trách: Nguyên; hỗ trợ: Séc.
- Cập nhật: 07/11/2026.
- Trạng thái: **chưa trao đổi.** Tham số dữ liệu dưới đây là **giả định của đội**.
  Buổi trao đổi lùi sang tuần 5 và chỉ dùng để chỉnh tham số, không đổi cấu trúc bộ sinh dữ liệu.
- Phạm vi (07/11): DX-Desk thống nhất theo bối cảnh **doanh nghiệp / tổ chức** (danh mục, nhóm xử lý,
  vai trò Employee/Agent/Manager, bài tri thức — migration 013). Trung tâm CNTT của trường là
  **đơn vị tham chiếu**: một bộ phận CNTT nội bộ phục vụ người dùng trong tổ chức. Chỉ hỏi phần
  vận hành helpdesk dùng chung được cho doanh nghiệp, tập trung vào nhóm cán bộ, nhân viên
  (tương ứng vai trò Employee); không hỏi phần riêng của đào tạo (LMS, phòng máy, sinh viên, mùa thi).

Mục đích: có bối cảnh và tham số thật cho bộ sinh dữ liệu (W4-07, W5-05) và mục 2.1
bản ý tưởng; trả lời được câu hỏi "dữ liệu có thật không" của giám khảo. Buổi trao đổi
cũng là dịp hỏi phương án B của ADR 0010 (xin máy chạy bản Internet).

## Câu trả lời ngắn cho giám khảo (đến khi có biên bản)

Toàn bộ ticket trong demo là dữ liệu giả lập, gắn nhãn `[SYNTHETIC]`, sinh từ seed cố định
(`scripts/seed-synthetic.mjs`). Phân bố loại yêu cầu, quy mô và cao điểm là giả định của
đội cho một bộ phận CNTT nội bộ, ghi ở bảng dưới; chưa phải số liệu vận hành thật. Khi có
buổi trao đổi, đội chỉ thay tham số và ghi nguồn tại tệp này.

## Nguyên tắc

- Chỉ ghi số liệu tổng hợp (tỷ lệ, khoảng ước tính). Không ghi tên, email người dùng hay nội dung ticket thật.
- Chỉ ghi tên đơn vị vào kho công khai khi đơn vị đồng ý; nếu không, ghi "bộ phận CNTT của một tổ chức".
- Không ghi âm nếu chưa được đồng ý; biên bản do đội tóm tắt và gửi lại cán bộ xem trước khi đưa vào kho.

## Lịch và đầu việc

- [ ] Nhờ thầy Tạ Chí Hiếu giới thiệu, hẹn 30–45 phút (dự kiến tuần 5, sau demo nội bộ 07/11).
- [ ] Gửi trước danh sách câu hỏi dưới đây; xin phép ghi tên đơn vị.
- [ ] Trao đổi, ghi biên bản theo mẫu cuối tệp, gửi cán bộ duyệt lại.
- [ ] Thay các ô "Giả định" bằng số đã trao đổi; chuyển tham số cho Séc (W4-07/W5-05).
- [ ] Cập nhật mục 2.1 bản ý tưởng (tài liệu ngoài kho).

Nếu đến **16/11** (cùng hạn phương án B của ADR 0010) vẫn chưa hẹn được: đóng W4-10 theo tiêu chí
dự phòng — tham số giữ là giả định của đội, đã ghi rõ trong tệp này.

## Câu hỏi gửi trước

Hỏi trong phạm vi yêu cầu của cán bộ, nhân viên (không tính sinh viên và nghiệp vụ đào tạo).

1. Cán bộ, nhân viên gửi yêu cầu qua kênh nào (email, điện thoại, đến trực tiếp, nhóm chat, phần mềm)? Tỷ lệ mỗi kênh?
2. Năm loại yêu cầu nhiều nhất (tài khoản, email, Wi-Fi/VPN, thiết bị văn phòng, phần mềm, cấp quyền…) và tỷ lệ ước tính?
3. Mỗi tháng khoảng bao nhiêu yêu cầu từ cán bộ, nhân viên? Phục vụ khoảng bao nhiêu người?
4. Có giai đoạn cao điểm không (đầu năm, quyết toán, triển khai hệ thống mới)? Cao điểm gấp mấy lần bình thường?
5. Bao nhiêu người xử lý, chia nhóm thế nào? Có cam kết thời gian phản hồi / xử lý theo mức ưu tiên (SLA) không?
6. Yêu cầu cấp quyền vào hệ thống nghiệp vụ có cần lãnh đạo đơn vị phê duyệt không? Phê duyệt bằng cách nào?
7. Hiện đang dùng công cụ gì để theo dõi yêu cầu? Khó khăn lớn nhất là gì?

## Tham số cho bộ sinh dữ liệu (giả định của đội)

Các số dưới đây **không** lấy từ đơn vị tham chiếu. Đội đặt để bộ sinh dữ liệu có cấu trúc
giống một bộ phận CNTT nội bộ, đủ để demo luồng VPN và báo cáo SLA. Cột "Nguồn" đổi thành
"Biên bản dd/mm" khi đã trao đổi.

| Tham số | Giá trị giả định | Ánh xạ trong DX-Desk | Nguồn |
|---|---|---|---|
| Số yêu cầu mỗi tháng (tuần thường) | 600 | `--count` theo số tuần × 150 | Giả định |
| Hệ số cao điểm (2 tuần đầu năm, triển khai hệ thống mới) | ×2,5 | phân bố ngày tạo ticket | Giả định |
| Đơn vị người gửi | 6 phòng ban mô phỏng, phân bố đều | ghi trong mô tả ticket (W4-07) | Giả định |
| Tài khoản, email, phần mềm nghiệp vụ | 35% | `account` | Giả định |
| Wi-Fi, mạng, VPN | 25% (trong đó VPN 8%) | `vpn` | Giả định |
| Thiết bị văn phòng | 20% | `hardware` | Giả định |
| Phần mềm bản quyền | 12% | `software` | Giả định |
| Cấp quyền hệ thống (cần duyệt) | 5% | `access` | Giả định |
| Sự cố hệ thống dùng chung | 3% | `system-error` | Giả định |
| Kênh tiếp nhận | Email 40%, trực tiếp/điện thoại 35%, nhóm chat 25% | chỉ dùng cho mục 2.1, chưa vào schema | Giả định |
| Số người xử lý | 6, chia 3 nhóm (Mạng, Tài khoản/Phần mềm, Thiết bị) | team và roster Keycloak | Giả định |

Tình huống VPN client 4.2 (W5-05) là tham số kịch bản riêng, không suy từ bảng trên.

### Đề xuất cho câu hỏi mở ở W4-07

W4-07 cần chốt: tạo người dùng giả lập trong realm Keycloak hay chỉ dùng người dùng mẫu.
Đề xuất của người phụ trách W4-10: **chỉ dùng người dùng mẫu sẵn có trong realm**, gán
thuộc tính phòng ban ở phía bộ sinh dữ liệu (ghi trong mô tả ticket, gắn nhãn
`[SYNTHETIC]`). Lý do: không phình realm, không phải dọn tài khoản giả sau demo, và
thống kê theo phòng ban vẫn tái lập được nhờ seed cố định. Quyết định cuối cùng chốt cùng Séc.

## Mẫu biên bản

```text
Ngày, hình thức (trực tiếp/trực tuyến), thời lượng:
Đơn vị (nếu được phép ghi tên):
Thành viên đội tham dự:
Đơn vị đồng ý ghi tên công khai: có / không
1. Kênh tiếp nhận và tỷ lệ:
2. Năm loại yêu cầu nhiều nhất và tỷ lệ:
3. Số yêu cầu/tháng từ cán bộ, nhân viên; số người được phục vụ:
4. Giai đoạn cao điểm và hệ số:
5. Nhân sự xử lý, cách chia nhóm, SLA hoặc thời gian xử lý thông thường:
6. Quy trình phê duyệt cấp quyền:
7. Công cụ đang dùng, khó khăn lớn nhất:
ADR 0010 phương án B (máy chạy bản Internet): đã hỏi / kết quả:
Tham số đã thay trong bảng trên:
Cán bộ đã xem lại biên bản: ngày …
```
