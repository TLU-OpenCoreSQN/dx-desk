# 0006. n8n chạy ngoài kho mã, import khi vận hành

- Trạng thái: Đã triển khai quy trình; cần kiểm chứng runtime/restart.
- Ngày: 21/10/2026.
- Người phụ trách: Nguyên (TV1), Quyền theo dõi QĐ-4.
- Mã: W2-04, QĐ-4.

## Quyết định

Dùng image n8n ghim trong `.env.example`, không chép/sửa mã nguồn n8n vào repo.
Workflow do đội viết ở `infra/n8n/workflows/`, được import rồi publish trước khi
service n8n chính khởi động. Workflow hello không cần credentials.

`node scripts/dxdesk.mjs n8n-reload` dừng service, import workflow, publish rồi bật lại.
Nếu workflow cần credentials, đặt export trong `infra/n8n/credentials/credentials.json`
(gitignored), chạy `credentials-import`, rồi reload workflow. Encryption key phải
giữ ổn định; không lưu secret thật vào Git hoặc log.

## Kiểm chứng QĐ-4

`node scripts/stack-test.mjs --restart-n8n` gọi webhook qua APISIX, restart service,
chờ webhook hoạt động trở lại. Job stack CI chạy startup lần hai và kiểm lại.
Máy hiện thiếu Docker, vì vậy chưa khẳng định runtime ổn định.

Giữ n8n làm phương án hiện hành trong tuần 2. Nếu import/restart không ổn định qua
các lần thử có log, ghi lỗi và đánh giá Node-RED/Kestra theo kế hoạch tuần 2–4.
Không tuyên bố n8n là thành phần OSI; xem THIRD-PARTY-NOTICES.
