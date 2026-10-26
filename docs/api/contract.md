# Hợp đồng API tuần 2

API NestJS/TypeScript. Trình duyệt truy cập cùng origin qua APISIX:
`http://localhost:9080/api`. Vite dev proxy `/api` và `/rest` tới APISIX.
Header: `Authorization: Bearer <Keycloak access token>`.
Keycloak: `http://localhost:8080`, realm `dxdesk`, public client `dxdesk-web`,
Authorization Code + PKCE S256. Giữ token trong bộ nhớ, refresh trước request.
Issuer phải khớp chính xác, audience `dxdesk-api`, thuật toán RS256.

- `GET /api/health`: công khai, `{status:"ok",service:"dx-desk-api",version:"0.1.0"}`.
- `GET /api/me`: `{id,username,roles:["Employee"|"Agent"|"Manager"]}`.
- `GET /api/categories`: `{data:[{id,code,name,description}]}`.
- `GET /api/tickets?limit=25&offset=0`: `{data:Ticket[],limit,offset}`.
- `GET /api/tickets/:id`: một Ticket, 404 nếu không tồn tại hoặc không có quyền.
- `GET /api/tickets/:id/events`: `{data:[{id,ticket_id,actor_id,event_type,payload,created_at}]}`.
- `POST /api/tickets`: `{category_id:uuid,title:string(5..200),description:string(10..5000),priority?:"low"|"normal"|"high"|"critical"}`. HTTP 201 trả Ticket.
- `GET /api/device-requests?limit=25&offset=0`: `{data:DeviceRequest[],limit,offset}`.
- `POST /api/device-requests`: `{device_type:"laptop"|"monitor"|"keyboard"|"mouse"|"other",reason:string(10..2000),quantity?:integer(1..10)}`. HTTP 201.

Ticket gồm `id,requester_id,category_id,title,description,priority,status,assigned_to,created_at,updated_at`.
Ticket mới có `status:"new"` và `assigned_to:null`. Chỉ Manager tạo Critical.
DeviceRequest gồm `id,requester_id,device_type,reason,quantity,status,created_at`, trạng thái ban đầu `pending`.
Phân trang limit 1..100, offset 0..100000. Không trả tổng giả.
Không chấp nhận trường ngoài DTO (requester_id/status/assigned_to do hệ thống kiểm soát).
Lỗi: `{statusCode,message}`; message có thể là chuỗi hoặc mảng lỗi validation.
HTTP 400 dữ liệu sai, 401 phiên sai/hết hạn, 403 không đủ quyền, 404 không thấy,
409 trùng, 500 lỗi nội bộ, 503 database chưa sẵn sàng.

Employee chỉ đọc dữ liệu của mình; Agent và Manager đọc tất cả yêu cầu.
RLS áp dụng giống nhau qua API và PostgREST. Dữ liệu danh mục được seed,
không seed ticket của người thật. Schema private và tài khoản database không được phơi cho web.
Tuần 2 chỉ triển khai khung + luồng tối thiểu kiểm chứng. Máy trạng thái đầy đủ,
phân công tự động, SLA timer, upload/quét tệp, dashboard và AI thuộc các tuần sau.
