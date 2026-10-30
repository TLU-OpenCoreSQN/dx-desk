# 0009. JWT tại APISIX và capability tải tệp qua API

- Ngày: 30/10/2026. Trạng thái: đã triển khai, nghiệm thu bằng gateway container.
- Phạm vi: W3-06, W3-07; bổ sung ADR 0007.

`openid-connect` tại APISIX dùng public key PEM sinh từ JWKS RS256 của Keycloak.
`dxdesk.mjs up` nạp đúng issuer công khai và audience từ `.env`, ghi cấu hình sinh
ra `infra/apisix/runtime.yaml` rồi khởi động lại gateway. Template vẫn được review
trong git; runtime không chứa private key/client secret. Phương án này tránh gọi
JWKS công khai `localhost` từ container (nguyên nhân CI #15), không nới issuer.
API/PostgREST tiếp tục xác minh token và RLS bảo vệ từng hàng/cột.

Plugin bật bearer_only, chỉ RS256, không nhận alg none/không hỗ trợ, xác minh issuer
và audience bắt buộc trên `/api/*`, `/rest/*`. Health và nội dung tệp ký là hai ngoại
lệ cụ thể. Sai audience trả 403 theo plugin; token thiếu/giả/hết hạn/sai issuer → 401.
Rate limit 30 req/s + burst 10 trên cả hai đường dữ liệu. Body gateway 20 MiB,
parser API 16 MiB, nghiệp vụ tệp 10 MiB. Access log bỏ query và Authorization.

Khi xoay khóa: chạy lại `node scripts/dxdesk.mjs up` để đồng bộ cả PostgREST và
gateway. Nếu JWKS có nhiều khóa RS256 ký, đặt `GATEWAY_SIGNING_KID` trong `.env`
để chọn khóa đang active rồi chạy up; runner từ chối chọn ngầm. Trong cửa sổ chuyển
khóa, token cũ có thể bị gateway từ chối và cần đăng nhập lại. Chưa có tự động
xoay nhiều khóa; không quảng cáo zero-downtime rotation.

Tải tệp dùng capability HMAC của API, thay vì mở S3/Filer ra browser. Endpoint cấp
URL kiểm JWT/RLS và clean; endpoint đọc kiểm chữ ký/TTL 120 giây và clean một lần
nữa, rồi stream Filer. Chỉ `api_login` gọi được hàm đọc metadata nội bộ của migration
007; anon/authenticated không được gọi và PostgREST không expose schema private.
URL bearer không thu hồi theo user tức thời; thay signing key thu hồi toàn bộ.

Kiểm chứng: `node tools/testing/gateway-test.mjs` dùng APISIX 3.19.0 thật, upstream
HTTP và fixture RSA để kiểm chữ ký, expiry, issuer, audience, 429, 413 và ngoại lệ
route content. Integration kiểm ownership/clean/sửa chữ ký/TTL/bytes. Stack CI kiểm
Keycloak và ClamAV/SeaweedFS thật; browser kiểm PKCE+OTP và quy trình ticket.

Nguồn: [plugin APISIX đúng tag 3.19.0](https://github.com/apache/apisix/blob/3.19.0/docs/en/latest/plugins/openid-connect.md),
[implementation cùng tag](https://github.com/apache/apisix/blob/3.19.0/apisix/plugins/openid-connect.lua).
