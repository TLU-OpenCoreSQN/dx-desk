# Credentials n8n

Workflow hello tuần 2 không cần credentials. Khi workflow cần gọi dịch vụ ngoài,
đặt bản export n8n vào `credentials.json` trong thư mục này (gitignored).
Không commit credentials, access token hoặc encryption key.

Nạp bằng `node scripts/dxdesk.mjs credentials-import`, sau đó
`node scripts/dxdesk.mjs n8n-reload`.
Giữ `N8N_ENCRYPTION_KEY` ổn định giữa các lần chạy.
Lệnh import dùng chính image n8n và database của stack; không sửa mã n8n.
