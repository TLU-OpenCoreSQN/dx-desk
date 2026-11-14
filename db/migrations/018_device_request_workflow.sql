-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W5-02: luồng duyệt đề nghị cấp thiết bị
--   pending -> approved -> preparing -> handed_over, hoặc pending -> rejected.
-- "Quản lý trực tiếp" = Manager có claim JWT department trùng đơn vị của đề nghị. Đơn vị được
-- PostgreSQL đóng dấu từ claim lúc tạo, không nhận từ trình duyệt. Chính sách đọc thay thế nằm
-- ở db/policies/003_device_requests.sql vì policy cũ được tạo sau mọi migration khi cài mới.

CREATE FUNCTION private.department() RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  SELECT nullif(btrim(private.claims()->>'department'), '')
$$;

ALTER TABLE public.device_requests DROP CONSTRAINT device_requests_status_check;
UPDATE public.device_requests SET status = 'handed_over' WHERE status = 'fulfilled';
ALTER TABLE public.device_requests ADD CONSTRAINT device_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'preparing', 'handed_over'));
ALTER TABLE public.device_requests
  ADD COLUMN department text,
  ADD COLUMN decided_by uuid,
  ADD COLUMN decided_at timestamptz,
  ADD COLUMN decision_note text CHECK (decision_note IS NULL OR length(decision_note) BETWEEN 1 AND 2000),
  ADD COLUMN prepared_by uuid,
  ADD COLUMN prepared_at timestamptz,
  ADD COLUMN handed_over_by uuid,
  ADD COLUMN handed_over_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
-- Đề nghị có trước W5-02 không có đơn vị: không Manager nào mang claim này nên không ai duyệt nhầm.
UPDATE public.device_requests SET department = 'chua-gan-don-vi', updated_at = created_at;
ALTER TABLE public.device_requests ALTER COLUMN department SET NOT NULL;
ALTER TABLE public.device_requests ADD CONSTRAINT device_requests_department_check
  CHECK (department ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(department) <= 63);
CREATE INDEX device_requests_department_idx ON public.device_requests(department, status, created_at DESC);

CREATE TABLE public.device_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.device_requests(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'ai')),
  actor_name text NOT NULL DEFAULT '',
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('pending', 'approved', 'rejected', 'preparing', 'handed_over')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_request_events_request_idx ON public.device_request_events(request_id, created_at);

-- Một định nghĩa quyền đọc dùng cho cả policy lẫn hàm chuyển trạng thái.
CREATE FUNCTION private.can_read_device_request(p_requester uuid, p_department text, p_status text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  SELECT coalesce(p_requester = private.user_id()
      OR (private.has_role('Manager') AND p_department = private.department())
      OR (private.has_role('Agent') AND p_status IN ('approved', 'preparing', 'handed_over')), false)
$$;

CREATE FUNCTION private.stamp_device_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    NEW.department := private.department();
    IF NEW.department IS NULL OR length(NEW.department) > 63 OR NEW.department !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
      RAISE sqlstate '45014' USING MESSAGE = 'Department claim required';
    END IF;
  ELSE
    -- Chủ sở hữu bảng (migration, nhập dữ liệu giả lập) không có JWT.
    NEW.department := coalesce(NEW.department, 'chua-gan-don-vi');
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER device_request_stamp BEFORE INSERT ON public.device_requests
FOR EACH ROW EXECUTE FUNCTION private.stamp_device_request();

CREATE FUNCTION private.audit_device_request_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF private.importing_demo_history() THEN RETURN NEW; END IF;
  INSERT INTO public.device_request_events(request_id, actor_id, actor_name, to_status, created_at)
  VALUES (NEW.id, NEW.requester_id, private.event_actor_name(), NEW.status, NEW.created_at);
  RETURN NEW;
END
$$;
CREATE TRIGGER device_request_created AFTER INSERT ON public.device_requests
FOR EACH ROW EXECUTE FUNCTION private.audit_device_request_created();

-- Outbox (migration 008) nhận thêm nguồn sự kiện thứ hai nên không còn khóa ngoại tới ticket_events;
-- chỉ trigger definer ghi được vào bảng này.
ALTER TABLE private.outbox DROP CONSTRAINT outbox_event_id_fkey;
ALTER TABLE private.outbox DROP CONSTRAINT outbox_destination_check;
ALTER TABLE private.outbox ADD CONSTRAINT outbox_destination_check
  CHECK (destination IN ('automation', 'notification', 'device_request'));

CREATE FUNCTION private.enqueue_device_request_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE request public.device_requests; kind text;
BEGIN
  IF private.importing_demo_history() THEN RETURN NEW; END IF;
  -- Bước "IT chuẩn bị" là việc nội bộ, không ai cần được báo.
  kind := CASE NEW.to_status WHEN 'pending' THEN 'created' WHEN 'preparing' THEN NULL ELSE NEW.to_status END;
  IF kind IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO request FROM public.device_requests WHERE id = NEW.request_id;
  INSERT INTO private.outbox(event_id, destination, envelope) VALUES (NEW.id, 'device_request', jsonb_build_object(
    'schema_version', 1, 'event_id', NEW.id, 'event_type', 'device_request.' || kind,
    'occurred_at', NEW.created_at, 'request_id', NEW.request_id,
    'actor', jsonb_build_object('type', NEW.actor_type, 'id', NEW.actor_id, 'label', NEW.actor_name),
    'payload', jsonb_build_object('status', request.status, 'department', request.department)));
  RETURN NEW;
END
$$;

-- Đề nghị có từ trước W5-02 nhận dòng lịch sử đầu tiên; trigger outbox gắn sau nên không báo lại chuyện cũ.
INSERT INTO public.device_request_events(request_id, actor_id, to_status, created_at)
SELECT id, requester_id, 'pending', created_at FROM public.device_requests;
CREATE TRIGGER device_request_event_outbox AFTER INSERT ON public.device_request_events
FOR EACH ROW EXECUTE FUNCTION private.enqueue_device_request_event();

-- Cổng duy nhất để đổi trạng thái: vai trò authenticated không có quyền UPDATE trên bảng.
-- Nằm ở schema public để ứng dụng 2 gọi qua PostgREST: POST /rest/rpc/transition_device_request.
CREATE FUNCTION public.transition_device_request(p_id uuid, p_to text, p_note text DEFAULT NULL)
RETURNS public.device_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  request public.device_requests;
  previous text;
  actor uuid := private.user_id();
  note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR actor IS NULL THEN
    RAISE sqlstate '42501' USING MESSAGE = 'User identity required';
  END IF;
  SELECT * INTO request FROM public.device_requests WHERE id = p_id FOR UPDATE;
  -- Người không đọc được đề nghị cũng không biết nó có tồn tại hay không.
  IF NOT FOUND OR NOT private.can_read_device_request(request.requester_id, request.department, request.status) THEN
    RAISE sqlstate 'PT404' USING MESSAGE = 'Device request not found';
  END IF;
  IF NOT coalesce((request.status, p_to) IN (('pending', 'approved'), ('pending', 'rejected'),
      ('approved', 'preparing'), ('preparing', 'handed_over')), false) THEN
    RAISE sqlstate '45011' USING MESSAGE = 'Device request transition is not allowed';
  END IF;
  IF p_to IN ('approved', 'rejected') THEN
    IF NOT private.has_role('Manager') OR request.department IS DISTINCT FROM private.department()
       OR request.requester_id = actor THEN
      RAISE sqlstate '45012' USING MESSAGE = 'Direct manager required';
    END IF;
  ELSIF NOT private.has_role('Agent') THEN
    RAISE sqlstate '45012' USING MESSAGE = 'IT role required';
  END IF;
  IF length(note) > 2000 OR (p_to = 'rejected' AND coalesce(length(note), 0) < 5) THEN
    RAISE sqlstate '45013' USING MESSAGE = 'Decision note required';
  END IF;
  previous := request.status;
  UPDATE public.device_requests SET status = p_to, updated_at = clock_timestamp(),
    decided_by = CASE WHEN p_to IN ('approved', 'rejected') THEN actor ELSE decided_by END,
    decided_at = CASE WHEN p_to IN ('approved', 'rejected') THEN clock_timestamp() ELSE decided_at END,
    decision_note = CASE WHEN p_to IN ('approved', 'rejected') THEN note ELSE decision_note END,
    prepared_by = CASE WHEN p_to = 'preparing' THEN actor ELSE prepared_by END,
    prepared_at = CASE WHEN p_to = 'preparing' THEN clock_timestamp() ELSE prepared_at END,
    handed_over_by = CASE WHEN p_to = 'handed_over' THEN actor ELSE handed_over_by END,
    handed_over_at = CASE WHEN p_to = 'handed_over' THEN clock_timestamp() ELSE handed_over_at END
  WHERE id = p_id RETURNING * INTO request;
  -- Ghi sau UPDATE để phong bì outbox mang trạng thái mới.
  INSERT INTO public.device_request_events(request_id, actor_id, actor_name, from_status, to_status, note)
  VALUES (p_id, actor, private.event_actor_name(), previous, p_to, note);
  RETURN request;
END
$$;

-- n8n gọi lại qua API bằng token dịch vụ; kết quả ghi inbox nên gọi lặp trả cùng ACK.
CREATE FUNCTION private.process_device_event(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE event private.outbox; result jsonb; kind text; audience text; team uuid;
BEGIN
  PERFORM private.require_automation();
  SELECT * INTO event FROM private.outbox WHERE event_id = p_event_id AND destination = 'device_request' FOR UPDATE;
  IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE = 'Event not found'; END IF;
  SELECT i.result INTO result FROM private.inbox i WHERE i.event_id = p_event_id;
  IF FOUND THEN RETURN result; END IF;
  kind := split_part(event.envelope->>'event_type', '.', 2);
  -- Đề nghị mới báo quản lý, đã duyệt báo IT, từ chối và bàn giao báo người đề nghị.
  audience := CASE kind WHEN 'created' THEN 'manager' WHEN 'approved' THEN 'it' ELSE 'requester' END;
  IF audience = 'it' THEN SELECT id INTO team FROM public.teams WHERE code = 'support' AND active; END IF;
  result := jsonb_build_object('event_id', p_event_id, 'result', 'notification', 'request_id', event.envelope->'request_id',
    'notification', jsonb_build_object('kind', kind, 'audience', audience, 'team_id', team));
  INSERT INTO private.inbox(event_id, operation, result) VALUES (p_event_id, 'process', result);
  RETURN result;
END
$$;

ALTER TABLE public.device_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_request_events FORCE ROW LEVEL SECURITY;
-- Truy vấn con chạy dưới RLS của device_requests nên lịch sử theo đúng quyền đọc đề nghị.
CREATE POLICY device_events_read ON public.device_request_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.device_requests r WHERE r.id = request_id));
GRANT SELECT ON public.device_request_events TO authenticated;

REVOKE ALL ON FUNCTION private.department(), private.can_read_device_request(uuid, text, text),
  private.stamp_device_request(), private.audit_device_request_created(), private.enqueue_device_request_event(),
  private.process_device_event(uuid), public.transition_device_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.department(), private.can_read_device_request(uuid, text, text),
  public.transition_device_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.process_device_event(uuid) TO ticket_automation;
