---
title: Kết nối VPN của trường từ xa
description: Cài OpenVPN, nhập hồ sơ cấu hình và xử lý lỗi xác thực, lỗi hết thời gian kết nối.
path: ho-tro/vpn
tags: [vpn, mang, tu-xa]
---

# Kết nối VPN của trường từ xa

VPN cho phép bạn dùng các hệ thống chỉ mở trong mạng nội bộ của trường (phần mềm quản lý
đào tạo, thư mục dùng chung của khoa, máy chủ thí nghiệm) khi đang ở nhà hoặc đi công tác.

> Bài này mô tả quy trình chung. Tên máy chủ, tệp cấu hình và nhóm được cấp quyền VPN do
> Trung tâm CNTT công bố; khi khác với bài này, làm theo thông báo của Trung tâm.

## Trước khi bắt đầu

- Tài khoản trường còn hiệu lực và đã được cấp quyền VPN (cán bộ, giảng viên; sinh viên chỉ khi
  có học phần yêu cầu).
- Máy đã cài ứng dụng **OpenVPN Connect** bản mới nhất từ trang chính thức của OpenVPN.
- Đã tải tệp hồ sơ `.ovpn` từ cổng thông tin của Trung tâm CNTT. Không dùng tệp do người khác gửi qua
  chat hoặc email.

## Kết nối lần đầu

1. Mở OpenVPN Connect, chọn **Import Profile → File**, chọn tệp `.ovpn` đã tải.
2. Nhập tên đăng nhập là tài khoản trường (không có phần `@...`), bấm **Connect**.
3. Nhập mật khẩu tài khoản trường. Nếu được hỏi mã xác thực, nhập mã 6 số trong ứng dụng xác thực.
4. Khi biểu tượng chuyển sang màu xanh và hiện **Connected**, thử mở một trang nội bộ.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân hay gặp | Cách tự xử lý |
|---|---|---|
| `AUTH_FAILED` | Sai mật khẩu, mật khẩu vừa đổi, tài khoản bị khóa | Đăng nhập thử webmail; nếu không vào được, xem bài [Mật khẩu](/ho-tro/mat-khau) |
| Treo ở *Connecting…* rồi báo hết thời gian | Mạng nơi bạn đang ở chặn cổng VPN (khách sạn, quán cà phê) | Đổi sang mạng di động 4G/5G rồi thử lại |
| Kết nối được nhưng không mở được trang nội bộ | Hồ sơ `.ovpn` cũ hoặc trình duyệt còn bộ nhớ đệm | Xóa hồ sơ cũ, tải lại hồ sơ mới; mở trang bằng cửa sổ ẩn danh |
| Mất kết nối sau vài phút | Máy vào chế độ ngủ hoặc Wi-Fi yếu | Tắt chế độ tiết kiệm pin cho bộ điều hợp mạng; xem bài [Wi-Fi](/ho-tro/wifi) |

## Khi nào cần gửi yêu cầu hỗ trợ

Gửi yêu cầu trên DX-Desk, danh mục **Kết nối VPN**, nếu đã làm hết các bước trên mà vẫn lỗi.
Ghi kèm phiên bản OpenVPN, dòng lỗi hiển thị và thời điểm xảy ra để kỹ thuật viên tra nhật ký nhanh hơn.
Không gửi mật khẩu trong nội dung yêu cầu.
