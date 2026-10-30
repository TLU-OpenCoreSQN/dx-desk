-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Forward-only repair: existing migrations/policies retain their ledger checksums.
-- A trigger enforces INSERT invariants even when older permissive policies OR together.

CREATE FUNCTION private.trim_form_value(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;

CREATE FUNCTION private.guard_ticket_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  category record;
  field record;
  spec jsonb;
  normalized jsonb := '{}'::jsonb;
  trimmed_value text;
  expected_status text;
BEGIN
  -- The migration owner may import historical rows; all application writes SET ROLE.
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;
  SELECT c.code, c.requirement_fields INTO category
    FROM public.categories c WHERE c.id = NEW.category_id AND c.active;
  IF NOT FOUND THEN
    RAISE sqlstate '42501' USING MESSAGE = 'Danh mục không tồn tại hoặc không khả dụng.';
  END IF;
  expected_status := CASE WHEN category.code = 'access' AND NOT private.is_staff()
                          THEN 'pending_approval' ELSE 'new' END;
  IF NEW.status IS DISTINCT FROM expected_status THEN
    RAISE sqlstate '42501' USING MESSAGE = 'Trạng thái khởi tạo không hợp lệ với danh mục và vai trò.';
  END IF;
  IF jsonb_typeof(NEW.request_fields) IS DISTINCT FROM 'object' THEN
    RAISE sqlstate 'PT400' USING MESSAGE = 'Dữ liệu biểu mẫu phải là một đối tượng.';
  END IF;
  FOR field IN SELECT key, value AS raw FROM jsonb_each(NEW.request_fields) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(category.requirement_fields) AS item
       WHERE jsonb_typeof(item->'key') = 'string' AND item->>'key' = field.key
    ) THEN
      RAISE sqlstate 'PT400' USING MESSAGE = 'Biểu mẫu chứa trường không thuộc danh mục đã chọn.';
    END IF;
    IF jsonb_typeof(field.raw) IS DISTINCT FROM 'string' THEN
      RAISE sqlstate 'PT400' USING MESSAGE = 'Giá trị trường biểu mẫu phải là chuỗi tối đa 500 ký tự.';
    END IF;
    trimmed_value := private.trim_form_value(field.raw #>> '{}');
    IF length(trimmed_value) > 500 THEN
      RAISE sqlstate 'PT400' USING MESSAGE = 'Giá trị trường biểu mẫu phải là chuỗi tối đa 500 ký tự.';
    END IF;
    IF trimmed_value <> '' THEN normalized := normalized || jsonb_build_object(field.key, trimmed_value); END IF;
  END LOOP;
  FOR spec IN SELECT item FROM jsonb_array_elements(category.requirement_fields) AS item LOOP
    IF jsonb_typeof(spec->'key') = 'string' AND spec->>'key' <> ''
       AND spec->'required' = 'true'::jsonb AND NOT normalized ? (spec->>'key') THEN
      RAISE sqlstate 'PT422' USING MESSAGE = 'Thiếu trường bắt buộc theo danh mục.';
    END IF;
  END LOOP;
  NEW.request_fields := normalized;
  RETURN NEW;
END
$$;
CREATE TRIGGER ticket_insert_guard BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.guard_ticket_insert();

-- Triggers maintain these columns without granting callers permission to SET them.
REVOKE UPDATE (sla_paused_ms, waiting_since, updated_at) ON public.tickets FROM authenticated;

CREATE OR REPLACE FUNCTION private.guard_ticket_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  rule record;
  actor_roles text[];
  actor_id uuid;
BEGIN
  IF ROW(NEW.sla_due_at, NEW.sla_paused_ms, NEW.waiting_since)
     IS DISTINCT FROM ROW(OLD.sla_due_at, OLD.sla_paused_ms, OLD.waiting_since) THEN
    RAISE sqlstate '42501' USING MESSAGE = 'Đồng hồ SLA chỉ được cập nhật bởi hệ thống.';
  END IF;
  IF NEW.resolution_note IS DISTINCT FROM OLD.resolution_note
     AND NOT (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'resolved') THEN
    RAISE sqlstate '42501' USING MESSAGE = 'Kết quả xử lý chỉ được ghi khi chuyển sang đã giải quyết.';
  END IF;
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT * INTO rule FROM private.ticket_transitions
      WHERE from_status = OLD.status AND to_status = NEW.status;
    IF NOT FOUND THEN
      RAISE sqlstate '45001' USING MESSAGE = 'Ticket transition is not allowed';
    END IF;
    IF NEW.status = 'resolved' AND (NEW.resolution_note IS NULL
       OR length(btrim(NEW.resolution_note)) NOT BETWEEN 5 AND 2000) THEN
      RAISE sqlstate '45003' USING MESSAGE = 'Ticket resolution note is required';
    END IF;
    actor_id := private.user_id();
    SELECT coalesce(array_agg(role_value), '{}'::text[]) INTO actor_roles
      FROM jsonb_array_elements_text(
        coalesce(private.claims()->'realm_access'->'roles', '[]'::jsonb)
      ) AS role_value;
    IF rule.requester_allowed AND actor_id IS NOT NULL AND actor_id = NEW.requester_id THEN
      NULL;
    ELSIF NOT (actor_roles && rule.allowed_roles) THEN
      RAISE sqlstate '45002' USING MESSAGE = 'Ticket role transition is not allowed';
    END IF;
    IF OLD.status = 'resolved' AND NEW.status = 'in_progress' THEN
      -- The next resolution must supply its own note, on API and direct REST alike.
      NEW.resolution_note := NULL;
    END IF;
    IF NEW.status = 'waiting_user' THEN
      NEW.waiting_since := now();
    ELSIF OLD.status = 'waiting_user' THEN
      IF OLD.waiting_since IS NOT NULL THEN
        NEW.sla_paused_ms := OLD.sla_paused_ms
          + greatest(0, floor(extract(epoch FROM (now() - OLD.waiting_since)) * 1000)::bigint);
      END IF;
      NEW.waiting_since := NULL;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION private.audit_ticket_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  INSERT INTO public.ticket_events(ticket_id, actor_id, event_type, payload)
  VALUES (NEW.id, coalesce(private.user_id(), NEW.requester_id), 'status_changed',
    jsonb_build_object('from', OLD.status, 'to', NEW.status,
      'note', coalesce(nullif(current_setting('app.status_note', true), ''), ''))
    || CASE WHEN NEW.status = 'resolved'
            THEN jsonb_build_object('resolution_note', NEW.resolution_note)
            ELSE '{}'::jsonb END);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.trim_form_value(text), private.guard_ticket_insert() FROM PUBLIC;
