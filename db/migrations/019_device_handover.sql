-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W5-03: biên bản bàn giao PDF của đề nghị thiết bị, lưu ở SeaweedFS.
-- API sinh tệp và ghi khóa qua các hàm private dưới đây; schema private không lộ qua PostgREST,
-- nên trình duyệt không tự đặt được khóa tệp.

ALTER TABLE public.device_requests
  ADD COLUMN handover_key text,
  ADD COLUMN handover_size_bytes bigint CHECK (handover_size_bytes IS NULL OR handover_size_bytes BETWEEN 1 AND 5242880),
  ADD COLUMN handover_generated_at timestamptz,
  ADD CONSTRAINT device_requests_handover_check CHECK (
    (handover_key IS NULL AND handover_size_bytes IS NULL AND handover_generated_at IS NULL)
    OR (status = 'handed_over' AND handover_key = 'device-handover/' || id::text || '.pdf'
        AND handover_size_bytes IS NOT NULL AND handover_generated_at IS NOT NULL));

-- Người gọi: dịch vụ tự động hóa (sau sự kiện bàn giao) hoặc người dùng đọc được đề nghị (tải lần đầu
-- khi tự động hóa tắt). Cả hai đều chỉ thao tác trên đề nghị đã bàn giao.
CREATE FUNCTION private.require_handover_access(p_requester uuid, p_department text, p_status text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF current_setting('role', true) = 'ticket_automation' THEN
    PERFORM private.require_automation();
  ELSIF current_setting('role', true) IS DISTINCT FROM 'authenticated'
     OR NOT private.can_read_device_request(p_requester, p_department, p_status) THEN
    RAISE sqlstate 'PT404' USING MESSAGE = 'Device request not found';
  END IF;
END
$$;

-- Dữ liệu in trên biên bản. Tên người lấy từ lịch sử do PostgreSQL ghi (tên đăng nhập trong JWT),
-- không có lý do đề nghị hay ghi chú duyệt.
CREATE FUNCTION private.device_handover_data(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE request public.device_requests;
BEGIN
  SELECT * INTO request FROM public.device_requests WHERE id = p_id;
  IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE = 'Device request not found'; END IF;
  PERFORM private.require_handover_access(request.requester_id, request.department, request.status);
  IF request.status <> 'handed_over' THEN RAISE sqlstate '45015' USING MESSAGE = 'Device request is not handed over'; END IF;
  RETURN jsonb_build_object(
    'id', request.id, 'device_type', request.device_type, 'quantity', request.quantity, 'department', request.department,
    'created_at', request.created_at, 'decided_at', request.decided_at, 'handed_over_at', request.handed_over_at,
    'handover_key', request.handover_key,
    'requester_name', (SELECT nullif(e.actor_name, '') FROM public.device_request_events e
      WHERE e.request_id = p_id AND e.from_status IS NULL ORDER BY e.created_at, e.id LIMIT 1),
    'approver_name', (SELECT nullif(e.actor_name, '') FROM public.device_request_events e
      WHERE e.request_id = p_id AND e.to_status = 'approved' ORDER BY e.created_at DESC, e.id DESC LIMIT 1),
    'handed_over_by_name', (SELECT nullif(e.actor_name, '') FROM public.device_request_events e
      WHERE e.request_id = p_id AND e.to_status = 'handed_over' ORDER BY e.created_at DESC, e.id DESC LIMIT 1));
END
$$;

-- Khóa tệp là giá trị xác định theo mã đề nghị; ghi một lần, gọi lặp không đổi gì.
CREATE FUNCTION private.set_device_handover(p_id uuid, p_key text, p_size bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE request public.device_requests;
BEGIN
  SELECT * INTO request FROM public.device_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE = 'Device request not found'; END IF;
  PERFORM private.require_handover_access(request.requester_id, request.department, request.status);
  IF request.status <> 'handed_over' THEN RAISE sqlstate '45015' USING MESSAGE = 'Device request is not handed over'; END IF;
  IF p_key IS DISTINCT FROM 'device-handover/' || p_id::text || '.pdf' OR p_size IS NULL OR p_size NOT BETWEEN 1 AND 5242880 THEN
    RAISE sqlstate '22023' USING MESSAGE = 'Invalid handover object';
  END IF;
  IF request.handover_key IS NOT NULL THEN RETURN false; END IF;
  UPDATE public.device_requests SET handover_key = p_key, handover_size_bytes = p_size,
    handover_generated_at = clock_timestamp() WHERE id = p_id;
  RETURN true;
END
$$;

-- Chỉ login của API đổi được URL ký (đã kiểm chữ ký) thành khóa tệp; giống tệp đính kèm (migration 007).
CREATE FUNCTION private.device_handover_for_download(p_id uuid)
RETURNS TABLE(object_key text, size_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT r.handover_key, r.handover_size_bytes FROM public.device_requests r
   WHERE r.id = p_id AND r.status = 'handed_over' AND r.handover_key IS NOT NULL
$$;

REVOKE ALL ON FUNCTION private.require_handover_access(uuid, text, text), private.device_handover_data(uuid),
  private.set_device_handover(uuid, text, bigint), private.device_handover_for_download(uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION private.device_handover_data(uuid), private.set_device_handover(uuid, text, bigint)
  TO authenticated, ticket_automation;
GRANT EXECUTE ON FUNCTION private.device_handover_for_download(uuid) TO api_login;
