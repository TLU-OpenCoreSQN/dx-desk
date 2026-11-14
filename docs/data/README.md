# Bộ dữ liệu giả lập DX-Desk

Dữ liệu do bộ sinh tạo cho demo bộ phận CNTT nội bộ của một doanh nghiệp. Tên đơn vị và
hồ sơ là giả lập. Bản sinh bằng `--offline` và các mẫu tải công khai không chứa định
danh Keycloak, email, nội dung phiếu thực tế hay thông tin cá nhân. Bản nội bộ sinh từ
realm demo có UUID kỹ thuật để kiểm thử RLS, chỉ dùng trong stack demo.

Từ gốc kho mã, chạy:

```sh
node scripts/dxdesk.mjs seed --offline --scenario=vpn-4.2 --weeks=8 --users=100 --seed=dxdesk-w5 --now=2026-11-02T00:00:00Z
```

Script in đường dẫn manifest, `dataset_sha256`, số phiếu và số liệu kịch bản. Cùng
phiên bản script, seed, mốc UTC, tham số và ánh xạ danh tính cho cùng SHA-256.
`--count` mặc định bằng số tuần × 150, tối thiểu 500. `--weights` thay trọng số danh mục;
kịch bản VPN dành riêng hai tuần cuối cho mẫu trước/sau, trọng số áp dụng cho các phiếu còn lại.

Chạy sau khi khởi động stack demo để đọc team và tài khoản mẫu, rồi bỏ `--offline`.
Muốn ghi, đặt `DATABASE_URL` của **migration owner** trỏ đến PostgreSQL của stack
demo riêng, có tên `dxdesk_demo*` hoặc `dxdesk_test*`, và thêm cả `--apply --confirm-demo`.
Nạp lại cùng manifest không nhân đôi phiếu, sự kiện, lượt tự phục vụ hoặc đề nghị thiết bị.
Phiếu lịch sử không phát webhook hay gửi tin Mattermost trong lúc nạp.

| Chỉ số VPN | Tuần trước cập nhật | Tuần sau cập nhật |
| --- | ---: | ---: |
| Phiếu VPN | 100 | 137 (+37%) |
| Từ lúc tạo đến lần giải quyết | 2,4 giờ | 4,1 giờ |
| Client 4.2 | 0 | 99/137 (72% khi làm tròn) |

Hai nhóm gồm các phiếu VPN đã có thời điểm giải quyết. Tỷ lệ 72% lấy mẫu số là số
phiếu VPN **tuần sau**. Trình sinh tự đối chiếu KPI từ sự kiện đã sinh và đối chiếu lại
từ PostgreSQL trước khi commit transaction. Sự kiện thao tác người/hệ thống phục vụ
kiểm tra báo cáo. Số liệu không phải biên bản khảo sát hay kết quả vận hành thật.

Quy mô 150 phiếu/tuần, trọng số danh mục, sáu phòng ban giả lập và hệ số cao điểm 2,5
là [giả định của đội](../tham-so-du-lieu-gia-lap.md).
Xem [lược đồ dữ liệu và RLS](../du-lieu.md) cho cấu trúc các bảng.

**Giấy phép dữ liệu.** Bản giả lập xuất offline và các mẫu ticket, sự kiện, chính sách
SLA của danh mục công khai phát hành theo [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
Ba tệp tải là bản mẫu nhỏ dùng để xem lược đồ. Dùng lệnh seed trên để tạo đầy đủ
kịch bản 6–8 tuần. Tái lập bản mẫu bằng `node scripts/export-demo-samples.mjs`.
