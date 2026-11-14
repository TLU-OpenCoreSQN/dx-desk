-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Bổ sung cho migration 016 (đã áp dụng, có checksum nên không sửa):
-- 1. 016 đổi bài LMS theo wiki_path; nếu đường dẫn đã bị đổi tay thì UPDATE khớp 0 dòng mà
--    migration vẫn được ghi nhận. Ở đây cập nhật theo id cố định và báo lỗi nếu thiếu bài.
-- 2. Tóm tắt bài phần mềm nghiệp vụ khớp đúng description trong docs/wiki/phan-mem-nghiep-vu.md
--    (integration test so sánh tiêu đề/tóm tắt/đường dẫn trong DB với docs/wiki).

DO $$
BEGIN
  UPDATE public.knowledge_articles SET slug = 'phan-mem-nghiep-vu', title = 'Phần mềm nghiệp vụ nội bộ',
    summary = 'Đăng nhập các hệ thống nghiệp vụ (văn bản, nhân sự, kế toán), không thấy chức năng được giao, lỗi tải tệp và giới hạn dung lượng.',
    wiki_path = 'ho-tro/phan-mem-nghiep-vu'
  WHERE id = '20000000-0000-4000-8000-000000000004';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiếu bài tri thức 20000000-0000-4000-8000-000000000004 (phần mềm nghiệp vụ).';
  END IF;
END $$;
