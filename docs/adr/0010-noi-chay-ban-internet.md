# 0010. Nơi chạy bản Internet của DX-Desk

- Trạng thái: **Đã chốt** 12/11/2026 — thầy đồng ý phương án A (thuê VPS) và chi phí; tên miền chọn sau khi thuê VPS
- Ngày: 04/11/2026 (đề xuất), 12/11/2026 (chốt)
- Người ghi: TV1 (Nguyên, nền tảng)
- Mã kế hoạch: QĐ-7 (issue #36), đầu vào cho W6-06

## Bối cảnh

Giám khảo chấm kho mã 7–9/12, trình diễn 10/12, công bố giải 11/12/2026. Đề bài khuyến khích
sản phẩm chạy trên Internet; tiêu chí xong tuần 6 là người ngoài đội truy cập được bản Internet
và đăng nhập bằng tài khoản thử. Ràng buộc:

- **RAM.** Hồ sơ `demo-light` đo ở W4-09 khoảng 3 GiB container ([tai-nguyen.md](../tai-nguyen.md)).
  Tuần 5 thêm Wiki.js + CSDL của nó (W5-08), Metabase (W5-06) và ứng dụng 2 (W5-01).
  Ước lượng sau tuần 5 ở mục *Ước lượng tài nguyên*.
- **Tên miền và HTTPS.** Keycloak cần URL HTTPS ổn định cho issuer và redirect URI
  (`KEYCLOAK_PUBLIC_URL`, `WIKI_PUBLIC_URL`, client `dxdesk-web`, `wikijs`).
- **Ổn định** ít nhất đến 11/12/2026; chi phí đội chịu được; không vi phạm thể lệ.

## Ước lượng tài nguyên (hồ sơ chạy Internet)

| Thành phần | RAM ước lượng | Nguồn |
|---|---|---|
| `demo-light` tuần 5 (Tầng 1, API, web, n8n, Mattermost, Wiki.js + CSDL) | ~3,0 GiB | Đo 12/11, ba lượt |
| Metabase OSS + PostgreSQL riêng (hồ sơ `full`) | ~1,4 GiB | Đo 12/11, [tai-nguyen.md](../tai-nguyen.md) |
| Ứng dụng 2 (cùng API/web) | không đáng kể | W5-01, chưa đo |
| **Tổng không có Ollama** | **~4,4 GiB** | `full` đo 12/11 (Ollama rỗng ~16 MiB) |
| Ollama + mô hình 1,5–4B (cảnh 4) | +2–4 GiB, CPU nặng | ADR 0005, chờ W6-05 |

Ổ đĩa: image + volume hiện khoảng 10–15 GB; dành 40 GB trở lên (60 GB của Gói 8 đủ khi không tải mô hình). CPU: 2 vCPU đủ cho demo không có
mô hình; mô hình cục bộ cần 4 vCPU trở lên và vẫn chậm.

**Đề xuất về Ollama:** không chạy mô hình trên máy chủ Internet. Cảnh 4 (trợ lý AI) trình diễn trên
máy của đội ở bản cục bộ; bản Internet tắt hồ sơ `full`. Như vậy máy chủ 8 GB RAM đủ, còn dư khoảng
3 GB cho hệ điều hành và đỉnh tải.

## Phương án đã xem xét

Giá đối chiếu trên **trang chính thức** của nhà cung cấp ngày 04/11/2026 (xem mục Nguồn). Giá có thể
đổi; người thuê kiểm lại lần cuối khi đặt hàng.

| Gói (04/11/2026) | Cấu hình | Giá/tháng | Ghi chú |
|---|---|---|---|
| BizFly Cloud — VPS Gói 8 | 4 vCPU, 8 GB RAM, 60 GB SSD, 100 Mbps | 460.000 đ chưa VAT (~506.000 đ gồm VAT 10%) | Trong nước, thanh toán nội địa |
| BizFly Cloud — VPS Gói 5 | 2 vCPU, 8 GB RAM, 40 GB SSD | 340.000 đ chưa VAT | Đủ RAM nhưng CPU sát, ổ đĩa hẹp |
| Hetzner — CX33 | 4 vCPU, 8 GB, 80 GB NVMe, 20 TB | €8,99 chưa VAT, gồm IPv4 | Trang ghi **tạm hết hàng**; gói Arm CAX21 không dùng được vì image ClamAV/n8n… cần amd64 |

| Phương án | Chi phí đến 11/12 | Ưu điểm | Nhược điểm / rủi ro | Kết luận |
|---|---|---|---|---|
| A. Thuê VPS 4 vCPU / 8 GB (BizFly VPS Gói 8) | 16/11–11/12 tính 2 tháng: ~1,01 triệu đồng gồm VAT + tên miền | Có IP công khai, chủ động cấu hình, chạy 24/7, dựng ngay trong ngày | Tốn phí (VPS nước ngoài còn cần thẻ quốc tế); đội tự vận hành bảo mật máy chủ | **Chọn** (12/11) |
| B. Xin máy của trường (qua Trung tâm CNTT của trường) | 0 đồng | Không tốn phí | Thời gian cấp chưa biết; có thể không có IP công khai/cổng 443; phụ thuộc lịch người khác sát mốc W6-06 | **Loại** (12/11): DX-Desk chỉ phục vụ doanh nghiệp, không còn liên quan Trung tâm CNTT của trường; buổi W4-10 đã hủy |
| C. Đường hầm từ máy của đội (Cloudflare Tunnel có tên, cần tên miền trên DNS Cloudflare) | 0 đồng + tên miền | Không cần IP công khai; HTTPS do Cloudflare cấp | Máy phải bật suốt 7–11/12; mất điện/mạng là mất bản Internet; Quick Tunnel (`trycloudflare.com`) đổi URL mỗi lần chạy và không dành cho sản phẩm, nên không dùng được với issuer Keycloak cố định | **Dự phòng** (giả định G6) |

## Quyết định

1. Thuê **một VPS 4 vCPU / 8 GB RAM / 60 GB SSD** (BizFly Cloud VPS Gói 8, kiến trúc amd64), Ubuntu LTS, chạy hồ sơ `demo-light`
   (không Ollama) từ 16/11 đến hết 11/12/2026.
2. **Tên miền** (chọn sau khi thuê VPS, trong W6-06): một tên miền riêng của đội (ưu tiên `.id.vn` nếu thành viên đủ điều kiện nhận
   miễn phí theo chương trình của VNNIC — cần kiểm lại điều kiện hiện hành; nếu không, mua một tên
   miền rẻ năm đầu). Ba tên miền con: `desk.` (APISIX), `sso.` (Keycloak), `wiki.` (Wiki.js).
3. **HTTPS:** reverse proxy Caddy trước APISIX/Keycloak/Wiki.js, chứng chỉ Let's Encrypt tự gia hạn
   (cách làm chi tiết thuộc W6-06, ghi ADR riêng nếu chọn khác).
4. **Dự phòng:** Cloudflare Tunnel có tên từ máy của một thành viên, dùng cùng tên miền (chuyển
   DNS sang Cloudflare). Nếu cả hai không ổn định trong thời gian chấm: trình diễn bản cục bộ, bản
   Internet chỉ giới thiệu bằng đường dẫn.
5. Không dùng phương án B (xem bảng trên).

## Hệ quả

- W6-06 cần: tách `KEYCLOAK_PUBLIC_URL`, `WIKI_PUBLIC_URL`, redirect URI của `dxdesk-web`/`wikijs`
  sang HTTPS; bỏ chế độ `start-dev` của Keycloak; đổi toàn bộ mật khẩu mẫu trong `.env`.
  Script `setup-automation.mjs` hiện chỉ chạy với Keycloak cục bộ (`localDemo`), nên bootstrap
  roster/Mattermost trên máy chủ phải cấu hình tường minh; `setup-wiki.mjs` chạy được với Keycloak
  bất kỳ khi có admin credentials.
- Metabase (W5-06) hiện chỉ có trong hồ sơ `full`, nên `demo-light` trên VPS không có dashboard
  `/bao-cao`. W6-06 chọn một trong hai: thêm Metabase vào hồ sơ chạy Internet (vẫn không Ollama),
  hoặc chỉ trình diễn dashboard ở bản cục bộ. Số đo RAM 12/11 ở [tai-nguyen.md](../tai-nguyen.md).
- Chỉ mở cổng 80/443 (và SSH bằng khóa); các cổng dịch vụ tiếp tục bind `127.0.0.1` như compose hiện tại.
- Tài khoản thử cho giám khảo: tạo riêng, không dùng mật khẩu mẫu trong README.
- Người thuê giữ hóa đơn.

## Theo dõi

- [x] Đối chiếu giá trên trang chính thức của BizFly Cloud và Hetzner (04/11/2026).
- [x] Phương án B: loại ngày 12/11/2026 do đổi phạm vi sang doanh nghiệp.
- [x] Thầy đồng ý phương án A và chi phí (12/11/2026).
- [x] Đổi trạng thái ADR sang **Đã chốt** và cập nhật bảng ADR.
- [ ] Cập nhật issue #36 khi xác nhận các bước thuê VPS và chọn tên miền.
- [ ] Thuê VPS (kiểm lại giá khi đặt hàng), SSH bằng khóa vào được — hạn 16/11 để W6-06 bắt đầu.
- [ ] Chọn tên miền và cấp HTTPS (W6-06).

## Nguồn

- Cloudflare Quick Tunnels (không cần tài khoản, không bảo đảm uptime, chỉ cho thử nghiệm):
  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- Bảng giá BizFly Cloud (chính thức, giá chưa VAT): https://bizflycloud.vn/cloud-server/bang-gia
- Bảng giá Hetzner Cost-Optimized (chính thức, gồm IPv4): https://www.hetzner.com/cloud/cost-optimized/
