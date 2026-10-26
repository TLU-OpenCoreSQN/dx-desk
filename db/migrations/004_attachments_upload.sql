-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W3-06 (ADR 0007, QĐ-3): ghi metadata tệp đính kèm kèm kết quả quét clamd.
-- Chạy như migration owner (không phải application login). 001/002/003 đã được ledger
-- checksum khóa nên mọi thay đổi ở đây là forward-only.
--
-- Vì sao KHÔNG cấp INSERT trực tiếp trên public.attachments cho authenticated:
--   001_rls.sql ghi rõ "Column grants prevent forged ... scan results". Nếu grant cột
--   scan_status, một lời gọi PostgREST thẳng (cùng role authenticated như API) sẽ tự
--   đánh dấu tệp 'clean' mà chưa qua clamd. Do đó đường ghi DUY NHẤT là hàm
--   SECURITY DEFINER dưới đây — cùng khuôn mẫu mà các trigger audit của 001/003 dùng
--   (authenticated không INSERT được ticket_events; chỉ trigger definer ghi được).
--   Hàm chạy với quyền owner (BYPASSRLS của superuser) nên nó TỰ áp lại predicate
--   nhìn-thấy-ticket của RLS (đúng điều kiện của tickets_read) trước khi ghi; API vẫn
--   kiểm tra khả kiến bằng SELECT qua db.asUser (RLS) TRƯỚC khi lưu object để không để
--   lại object mồ côi.
-- SQLSTATE raise (API map sang thông báo tiếng Việt, không lộ SQL):
--   * 42501 = không nhìn thấy ticket theo RLS (người gọi không có quyền).
--   * 22023 = scan_status ngoài {clean, infected, failed} (pending do DB mặc định, API không tự ghi).

CREATE FUNCTION private.record_attachment(
  p_ticket_id uuid,
  p_file_name text,
  p_object_key text,
  p_content_type text,
  p_size_bytes bigint,
  p_scan_status text
) RETURNS public.attachments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  result public.attachments;
BEGIN
  IF p_scan_status NOT IN ('clean', 'infected', 'failed') THEN
    RAISE EXCEPTION 'Invalid attachment scan status' USING ERRCODE = '22023';
  END IF;
  -- Tái lập chính xác predicate của policy tickets_read: chỉ chủ ticket hoặc staff.
  IF NOT EXISTS (
    SELECT 1 FROM public.tickets t
     WHERE t.id = p_ticket_id
       AND (t.requester_id = private.user_id() OR private.is_staff())
  ) THEN
    RAISE sqlstate '42501' USING MESSAGE = 'Attachment ticket is not visible';
  END IF;
  -- uploaded_by luôn là danh tính từ JWT (không nhận từ body); file_name chỉ là dữ liệu cột.
  INSERT INTO public.attachments(
    ticket_id, uploaded_by, file_name, object_key, content_type, size_bytes, scan_status
  )
  VALUES (
    p_ticket_id, private.user_id(), p_file_name, p_object_key, p_content_type,
    p_size_bytes, p_scan_status
  )
  RETURNING * INTO result;
  RETURN result;
END
$$;

-- Chỉ authenticated (role mà API SET LOCAL ROLE) được gọi; PUBLIC không.
REVOKE ALL ON FUNCTION private.record_attachment(uuid, text, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_attachment(uuid, text, text, text, bigint, text) TO authenticated;
