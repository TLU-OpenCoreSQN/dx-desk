-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W3-01/W3-02/W3-03: máy trạng thái 8 trạng thái + Poka-yoke DB + SLA.
-- Chạy như migration owner (không phải application login). 001/002 đã được ledger
-- checksum khóa nên mọi thay đổi ở đây là forward-only.
--
-- Quy ước SLA (tài liệu hóa):
--   * sla_due_at      = created_at + sla_policies.resolution_minutes (phút), tính lúc INSERT.
--   * sla_paused_ms   = số MILLI-GIÂY (bigint) ticket bị tạm dừng vì ở waiting_user,
--                       cộng dồn khi RỜI waiting_user. Chọn bigint millis vì đơn giản
--                       khi so sánh/cộng trong API và frontend (không phụ thuộc unit của interval).
--   * waiting_since   = thời điểm gần nhất bước VÀO waiting_user (NULL khi không chờ).
--   * Ngưỡng vi phạm SLA = sla_due_at + sla_paused_ms (cờ sla_breached do W4-03 dùng;
--     tuần 3 chỉ tính và lưu).
-- SQLSTATE do các trigger dưới đây raise (API map sang thông báo tiếng Việt, không lộ SQL):
--   * 45001 = cạnh chuyển không thuộc máy trạng thái.
--   * 45002 = vai trò không được phép đi cạnh này (kể cả thiếu tư cách requester).
--   * 45003 = thiếu/vi phạm độ dài resolution_note khi chuyển sang resolved.

-- 1. Trạng thái: bỏ CHECK 7 giá trị, thêm waiting_user và pending_approval (9 giá trị chữ thường).
ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (
  status IN (
    'new', 'triaged', 'assigned', 'in_progress', 'waiting_user',
    'pending_approval', 'resolved', 'closed', 'cancelled'
  )
);

-- 2. Cột SLA + resolution note + field động theo danh mục.
ALTER TABLE public.tickets ADD COLUMN sla_due_at timestamptz;
ALTER TABLE public.tickets ADD COLUMN sla_paused_ms bigint NOT NULL DEFAULT 0
  CHECK (sla_paused_ms >= 0);
ALTER TABLE public.tickets ADD COLUMN waiting_since timestamptz;
ALTER TABLE public.tickets ADD COLUMN resolution_note text
  CHECK (resolution_note IS NULL OR length(btrim(resolution_note)) BETWEEN 5 AND 2000);
ALTER TABLE public.tickets ADD COLUMN request_fields jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(request_fields) = 'object');

-- Backfill cho dữ liệu tuần 2 (các ticket cũ đều đang 'new', chưa từng chờ).
UPDATE public.tickets t SET sla_due_at =
  t.created_at + make_interval(mins => p.resolution_minutes)
  FROM public.sla_policies p WHERE p.priority = t.priority AND t.sla_due_at IS NULL;
ALTER TABLE public.tickets ALTER COLUMN sla_due_at SET NOT NULL;

-- 3. Danh mục: trường bắt buộc/động theo loại ticket (requirement_fields là mảng
--    đối tượng {key,label,required}; API dùng để kiểm tra trường thiếu khi tạo ticket).
ALTER TABLE public.categories ADD COLUMN requirement_fields jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(requirement_fields) = 'array');

UPDATE public.categories SET requirement_fields = '[
  {"key": "client_version", "label": "Phiên bản client VPN", "required": true},
  {"key": "error_message", "label": "Dòng lỗi hiển thị", "required": true},
  {"key": "device_os", "label": "Hệ điều hành", "required": false}
]'::jsonb WHERE code = 'vpn';
UPDATE public.categories SET requirement_fields = '[
  {"key": "account_name", "label": "Tên tài khoản", "required": true},
  {"key": "issue_type", "label": "Loại sự cố tài khoản", "required": true}
]'::jsonb WHERE code = 'account';
UPDATE public.categories SET requirement_fields = '[
  {"key": "software_name", "label": "Tên phần mềm", "required": true},
  {"key": "error_message", "label": "Dòng lỗi hiển thị", "required": false}
]'::jsonb WHERE code = 'software';
UPDATE public.categories SET requirement_fields = '[
  {"key": "device_code", "label": "Mã thiết bị", "required": true},
  {"key": "location", "label": "Vị trí làm việc", "required": true}
]'::jsonb WHERE code = 'hardware';

-- Hai danh mục mới cho luồng phê duyệt cấp quyền và lỗi hệ thống.
INSERT INTO public.categories(id, code, name, description, requirement_fields) VALUES
('10000000-0000-4000-8000-000000000005', 'access', 'Cấp quyền hệ thống',
 'Yêu cầu cấp/thay đổi quyền truy cập hệ thống nội bộ (cần phê duyệt)', '[
  {"key": "system_name", "label": "Tên hệ thống", "required": true},
  {"key": "permission_level", "label": "Cấp quyền yêu cầu", "required": true},
  {"key": "valid_until", "label": "Thời hạn sử dụng quyền", "required": true}
]'::jsonb),
('10000000-0000-4000-8000-000000000006', 'system-error', 'Lỗi hệ thống',
 'Sự cố ảnh hưởng hệ thống dùng chung nhiều người dùng', '[
  {"key": "system_name", "label": "Tên hệ thống", "required": true},
  {"key": "error_message", "label": "Dòng lỗi hiển thị", "required": true},
  {"key": "occurred_at", "label": "Thời điểm xảy ra", "required": false}
]'::jsonb);
INSERT INTO public.routing_rules(category_id, team) VALUES
('10000000-0000-4000-8000-000000000005', 'Identity Team'),
('10000000-0000-4000-8000-000000000006', 'IT Support');

-- 4. Bảng cạnh chuyển tiếp (from -> to + vai trò được phép + tư cách requester).
--    requester_allowed = true nghĩa người tạo ticket (requester_id = sub) được đi cạnh
--    đó bất kể vai trò; allowed_roles kiểm tra realm_access.roles của token.
--    Nội dung đồng bộ 1:1 với TRANSITIONS/ROLE_EDGES trong apps/api/src/state-machine.ts.
CREATE TABLE private.ticket_transitions (
  from_status text NOT NULL,
  to_status text NOT NULL,
  allowed_roles text[] NOT NULL DEFAULT '{}',
  requester_allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (from_status, to_status)
);
INSERT INTO private.ticket_transitions(from_status, to_status, allowed_roles, requester_allowed) VALUES
('new', 'triaged', ARRAY['Agent','Manager'], false),
('new', 'cancelled', ARRAY['Agent','Manager'], true),
('new', 'pending_approval', ARRAY['Agent','Manager'], false),
('triaged', 'assigned', ARRAY['Agent','Manager'], false),
('triaged', 'cancelled', ARRAY['Agent','Manager'], true),
('assigned', 'in_progress', ARRAY['Agent','Manager'], false),
('assigned', 'pending_approval', ARRAY['Agent','Manager'], false),
('assigned', 'cancelled', ARRAY['Agent','Manager'], true),
('in_progress', 'waiting_user', ARRAY['Agent','Manager'], false),
('in_progress', 'resolved', ARRAY['Agent','Manager'], false),
('in_progress', 'pending_approval', ARRAY['Agent','Manager'], false),
('waiting_user', 'in_progress', ARRAY['Agent','Manager'], true),
('waiting_user', 'cancelled', ARRAY['Agent','Manager'], true),
('pending_approval', 'assigned', ARRAY['Agent','Manager'], false),
('pending_approval', 'new', ARRAY['Manager'], false),
('resolved', 'closed', '{}', true),
('resolved', 'in_progress', ARRAY['Agent','Manager'], false);

-- 5. Trigger BEFORE UPDATE: đóng dấu updated_at, kiểm tra máy trạng thái + vai trò +
--    resolution_note (Poka-yoke mức DB, áp dụng cả khi ghi thẳng qua PostgREST),
--    và cộng dồn sla_paused_ms khi vào/ra waiting_user.
--    SECURITY DEFINER để đọc private.ticket_transitions mà không phải mở quyền SELECT
--    cho authenticated; RLS WITH CHECK vẫn áp dụng với người gọi.
CREATE FUNCTION private.guard_ticket_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  rule record;
  actor_roles text[];
  actor_id uuid;
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT * INTO rule FROM private.ticket_transitions
     WHERE from_status = OLD.status AND to_status = NEW.status;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket transition is not allowed' USING ERRCODE = '45001';
    END IF;
    IF NEW.status = 'resolved'
       AND (NEW.resolution_note IS NULL
            OR length(btrim(NEW.resolution_note)) NOT BETWEEN 5 AND 2000) THEN
      RAISE EXCEPTION 'Ticket resolution note is required' USING ERRCODE = '45003';
    END IF;
    actor_id := private.user_id();
    SELECT coalesce(array_agg(role_value), '{}'::text[]) INTO actor_roles
      FROM jsonb_array_elements_text(
        coalesce(private.claims() -> 'realm_access' -> 'roles', '[]'::jsonb)
      ) AS role_value;
    IF rule.requester_allowed AND actor_id IS NOT NULL AND actor_id = NEW.requester_id THEN
      NULL; -- người tạo ticket xác nhận (hủy / trả lời / đóng): hợp lệ.
    ELSIF NOT (actor_roles && rule.allowed_roles) THEN
      RAISE EXCEPTION 'Ticket role transition is not allowed' USING ERRCODE = '45002';
    END IF;
    -- SLA pause bookkeeping (xem quy ước đầu file).
    IF NEW.status = 'waiting_user' THEN
      NEW.waiting_since := now();
    ELSIF OLD.status = 'waiting_user' THEN
      IF OLD.waiting_since IS NOT NULL THEN
        NEW.sla_paused_ms := OLD.sla_paused_ms
          + floor(extract(epoch FROM (now() - OLD.waiting_since)) * 1000)::bigint;
      END IF;
      NEW.waiting_since := NULL;
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER ticket_update_guard BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.guard_ticket_update();

-- 6. Trigger AFTER UPDATE: ghi audit status_changed {from,to,note} trong CÙNG giao dịch.
--    note lấy từ GUC cục bộ app.status_note do API set_config(..., true) trước UPDATE;
--    audit do PostgreSQL sinh, không nhận thẳng từ browser (nhất quán với 001_schema).
CREATE FUNCTION private.audit_ticket_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  INSERT INTO public.ticket_events(ticket_id, actor_id, event_type, payload)
  VALUES (
    NEW.id,
    coalesce(private.user_id(), NEW.requester_id),
    'status_changed',
    jsonb_build_object(
      'from', OLD.status,
      'to', NEW.status,
      'note', coalesce(nullif(current_setting('app.status_note', true), ''), '')
    )
  );
  RETURN NEW;
END
$$;
CREATE TRIGGER ticket_status_changed AFTER UPDATE ON public.tickets
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION private.audit_ticket_status_change();

-- 7. Trigger BEFORE INSERT: sla_due_at = created_at + resolution_minutes theo priority.
--    (Kiểm tra 'critical chỉ Manager' đã có ở RLS tickets_create và API layer W3-02.)
CREATE FUNCTION private.compute_ticket_sla_due() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  resolution_minutes integer;
BEGIN
  SELECT p.resolution_minutes INTO resolution_minutes
    FROM public.sla_policies p WHERE p.priority = NEW.priority;
  IF resolution_minutes IS NULL THEN
    RAISE EXCEPTION 'Missing SLA policy for priority' USING ERRCODE = 'P0001';
  END IF;
  NEW.sla_due_at := NEW.created_at + make_interval(mins => resolution_minutes);
  RETURN NEW;
END
$$;
CREATE TRIGGER ticket_sla_before_insert BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.compute_ticket_sla_due();

-- 8. RLS/GUI: chính sách INSERT mới cho phép status='pending_approval' khi Employee tạo
--    ticket danh mục 'access' (W3-02 rule 3). Đặt tên tickets_create_v3 để không đụng
--    tickets_create trong policies/001_rls.sql (đã checksum); hai policy permissive OR nhau,
--    nên đường 'new' cũ vẫn y nguyên và đường pending_approval chỉ mở đúng một cửa.
CREATE POLICY tickets_create_v3 ON public.tickets FOR INSERT TO authenticated WITH CHECK (
  requester_id = private.user_id()
  AND (private.has_role('Employee') OR private.is_staff())
  AND assigned_to IS NULL
  AND (priority <> 'critical' OR private.has_role('Manager'))
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.active)
  AND (
    status = 'new'
    OR (status = 'pending_approval' AND NOT private.is_staff()
        AND EXISTS (SELECT 1 FROM public.categories c
                    WHERE c.id = category_id AND c.code = 'access'))
  )
);
-- Chính sách UPDATE: USING theo quyền đọc hiện hành; WITH CHECK chỉ giữ ràng buộc
-- miền giá trị. Máy trạng thái + vai trò do trigger guard kiểm tra trên MỌI đường ghi
-- (kể cả PostgREST trực tiếp); assigned_to/requester_id/category_id không được grant
-- nên PostgreSQL tự chặn thay đổi.
CREATE POLICY tickets_update ON public.tickets FOR UPDATE TO authenticated
USING (requester_id = private.user_id() OR private.is_staff())
WITH CHECK (
  status IN (
    'new', 'triaged', 'assigned', 'in_progress', 'waiting_user',
    'pending_approval', 'resolved', 'closed', 'cancelled'
  )
);
-- Mở rộng cột được ghi cho authenticated (001_rls chỉ cho INSERT 4 cột, chưa có UPDATE).
-- Trạng thái/khởi tạo vẫn bị RLS + trigger chặn; các cột khác không grant nên không đổi được.
GRANT INSERT (status, request_fields) ON public.tickets TO authenticated;
GRANT UPDATE (status, resolution_note, sla_paused_ms, waiting_since, updated_at)
  ON public.tickets TO authenticated;

-- 9. ticket_events: CHECK hiện tại ('created','status_changed') và payload object
--    đã phủ shape mới {from,to,note} -> KHÔNG cần đổi ràng buộc (đã xác minh khi đọc 001_schema.sql).

-- 10. Quyền thực thi hàm helper dùng trong trigger/policy (chủ sở hữu definer là
--     migration owner; authenticated KHÔNG cần execute vì trigger là SECURITY DEFINER).
REVOKE ALL ON FUNCTION private.guard_ticket_update(), private.audit_ticket_status_change(),
  private.compute_ticket_sla_due() FROM PUBLIC;
