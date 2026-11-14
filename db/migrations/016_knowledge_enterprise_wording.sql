-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Thống nhất bài tri thức với bối cảnh doanh nghiệp của DX-Desk (danh mục, nhóm xử lý,
-- vai trò Employee/Agent/Manager): bỏ cách viết "của trường", thay bài LMS bằng bài
-- phần mềm nghiệp vụ nội bộ. Giữ nguyên id nên ánh xạ category_articles không đổi.
-- Migration 012 đã áp dụng (có checksum) nên không sửa trực tiếp.

UPDATE public.knowledge_articles SET title = 'Kết nối VPN từ xa vào mạng nội bộ'
WHERE id = '20000000-0000-4000-8000-000000000001';

UPDATE public.knowledge_articles SET title = 'Hộp thư điện tử công việc'
WHERE id = '20000000-0000-4000-8000-000000000002';

UPDATE public.knowledge_articles SET title = 'Kết nối Wi-Fi tại văn phòng',
  summary = 'Chọn đúng mạng, đăng nhập bằng tài khoản tổ chức, quên mạng cũ khi đổi mật khẩu.'
WHERE id = '20000000-0000-4000-8000-000000000003';

UPDATE public.knowledge_articles SET slug = 'phan-mem-nghiep-vu', title = 'Phần mềm nghiệp vụ nội bộ',
  summary = 'Đăng nhập hệ thống văn bản, nhân sự, kế toán; không thấy chức năng được giao, lỗi tải tệp.',
  wiki_path = 'ho-tro/phan-mem-nghiep-vu' WHERE wiki_path = 'ho-tro/lms';

UPDATE public.knowledge_articles SET title = 'Đổi và khôi phục mật khẩu tài khoản tổ chức'
WHERE id = '20000000-0000-4000-8000-000000000005';

UPDATE public.knowledge_articles SET title = 'Phần mềm bản quyền của tổ chức',
  summary = 'Danh sách phần mềm được cấp phép, cách kích hoạt và khi nào cần gửi yêu cầu cài đặt.'
WHERE id = '20000000-0000-4000-8000-000000000006';
