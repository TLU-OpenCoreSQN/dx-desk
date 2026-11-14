-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Department membership is enough to read the request, but only its actual approver can retrieve the PDF.
CREATE FUNCTION private.require_handover_access(p_requester uuid, p_approver uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF current_setting('role', true) = 'ticket_automation' THEN
    PERFORM private.require_automation();
  ELSIF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR NOT coalesce(private.user_id() = p_requester OR private.user_id() = p_approver OR private.has_role('Agent'), false) THEN
    RAISE sqlstate 'PT404' USING MESSAGE = 'Device request not found';
  END IF;
END
$$;
REVOKE ALL ON FUNCTION private.require_handover_access(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.device_handover_data(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE request public.device_requests;
BEGIN
  SELECT * INTO request FROM public.device_requests WHERE id = p_id;
  IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE = 'Device request not found'; END IF;
  PERFORM private.require_handover_access(request.requester_id, request.decided_by);
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
CREATE OR REPLACE FUNCTION private.set_device_handover(p_id uuid, p_key text, p_size bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE request public.device_requests;
BEGIN
  SELECT * INTO request FROM public.device_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE = 'Device request not found'; END IF;
  PERFORM private.require_handover_access(request.requester_id, request.decided_by);
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

DROP FUNCTION private.require_handover_access(uuid, text, text);
