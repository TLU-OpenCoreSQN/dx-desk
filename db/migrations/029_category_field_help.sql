-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Populate UI help on fresh/old demo databases without overwriting enterprise field definitions.
WITH defaults(code,fields) AS (VALUES
  ('vpn', $json$[{"key":"client_version","placeholder":"VD: 7.2.4","hint":"Mở phần mềm VPN, vào mục Giới thiệu (About) để xem số phiên bản."},{"key":"error_message","placeholder":"VD: \"Không thể kết nối tới máy chủ (mã lỗi -14)\"","hint":"Chép nguyên văn dòng thông báo lỗi trên màn hình, kể cả mã lỗi nếu có."},{"key":"device_os","placeholder":"VD: Windows 11, macOS 14, Android 14","hint":"Hệ điều hành của máy đang gặp sự cố."}]$json$::jsonb),
  ('account', $json$[{"key":"account_name","placeholder":"VD: nguyen.van.a hoặc nguyen.van.a@congty.vn","hint":"Tên bạn dùng để đăng nhập máy tính hoặc email công ty."},{"key":"issue_type","placeholder":"VD: Quên mật khẩu, tài khoản bị khóa, không nhận được mã xác thực","hint":"Mô tả ngắn chuyện gì đang xảy ra với tài khoản."}]$json$::jsonb),
  ('hardware', $json$[{"key":"device_code","placeholder":"VD: mã in trên tem dán ở mặt dưới máy","hint":"Mã tài sản trên tem dán của thiết bị. Không thấy tem thì ghi tên và màu thiết bị."},{"key":"location","placeholder":"VD: Tầng 3, phòng 305, bàn số 12","hint":"Nơi kỹ thuật viên có thể tìm đến bạn hoặc thiết bị."}]$json$::jsonb),
  ('software', $json$[{"key":"software_name","placeholder":"VD: Microsoft Excel, Zoom, phần mềm chấm công","hint":"Tên phần mềm đang gặp lỗi hoặc cần cài đặt."},{"key":"error_message","placeholder":"VD: \"Không thể kết nối tới máy chủ (mã lỗi -14)\"","hint":"Chép nguyên văn dòng thông báo lỗi trên màn hình, kể cả mã lỗi nếu có."}]$json$::jsonb),
  ('access', $json$[{"key":"system_name","placeholder":"VD: Phần mềm kế toán, Email công ty, Hệ thống nhân sự","hint":"Tên phần mềm hoặc trang web bạn đang dùng, đúng như tên hiển thị trên màn hình hoặc biểu tượng."},{"key":"permission_level","placeholder":"VD: Chỉ xem báo cáo; Thêm và sửa chứng từ","hint":"Bạn cần làm được gì trong hệ thống. Nếu chưa rõ, ghi giống quyền của một đồng nghiệp cùng vị trí."},{"key":"valid_until","hint":"Ngày cuối cùng bạn cần dùng quyền này, để bộ phận IT biết khi nào có thể thu hồi."}]$json$::jsonb),
  ('system-error', $json$[{"key":"system_name","placeholder":"VD: Phần mềm kế toán, Email công ty, Hệ thống nhân sự","hint":"Tên phần mềm hoặc trang web bạn đang dùng, đúng như tên hiển thị trên màn hình hoặc biểu tượng."},{"key":"error_message","placeholder":"VD: \"Không thể kết nối tới máy chủ (mã lỗi -14)\"","hint":"Chép nguyên văn dòng thông báo lỗi trên màn hình, kể cả mã lỗi nếu có."},{"key":"occurred_at","placeholder":"VD: Khoảng 9h sáng nay, sau khi khởi động lại máy","hint":"Thời điểm bạn thấy lỗi lần đầu và lỗi có lặp lại hay không."}]$json$::jsonb)
), enriched AS (
 SELECT c.id,jsonb_agg(coalesce(d.field,'{}'::jsonb) || f.field ORDER BY f.ordinality) AS fields
 FROM public.categories c JOIN defaults x ON x.code=c.code
 CROSS JOIN LATERAL jsonb_array_elements(c.requirement_fields) WITH ORDINALITY f(field,ordinality)
 LEFT JOIN LATERAL (SELECT field FROM jsonb_array_elements(x.fields) AS v(field)
   WHERE field->>'key'=f.field->>'key') d ON true
 GROUP BY c.id
)
UPDATE public.categories c SET requirement_fields=e.fields FROM enriched e
WHERE c.id=e.id AND c.requirement_fields IS DISTINCT FROM e.fields;
