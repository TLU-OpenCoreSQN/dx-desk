-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W5-10: chỉ số tự động hóa H-P-D-I. Số 016 dành cho migration bối cảnh doanh nghiệp (W5-11).

-- W6-08 ghi bước do AI thực hiện bằng actor_type = 'ai'; trước mốc đó cột chỉ có user/system.
ALTER TABLE public.ticket_events DROP CONSTRAINT ticket_events_actor_type_check;
ALTER TABLE public.ticket_events ADD CONSTRAINT ticket_events_actor_type_check
  CHECK (actor_type IN ('user', 'system', 'ai'));

-- Một "bước xử lý" = một sự kiện status_changed (tạo phiếu không phải bước xử lý). Phân loại,
-- phân công, nhận việc, giải quyết, đóng đều là một lần chuyển trạng thái. Dòng assignment_changed
-- là audit đi kèm nên không đếm lại; routing_unresolved, sla_warning và sla_breached là cảnh báo.
-- Cùng định nghĩa với reporting.ticket_operations_weekly (migration 015), thêm phần hệ thống và AI.
CREATE VIEW reporting.automation_weekly AS
WITH steps AS (
  SELECT date_trunc('week', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS week_start,
         count(*) AS steps,
         count(*) FILTER (WHERE actor_type = 'user') AS human_steps,
         count(*) FILTER (WHERE actor_type = 'system') AS system_steps,
         count(*) FILTER (WHERE actor_type = 'ai') AS ai_steps
  FROM public.ticket_events WHERE event_type = 'status_changed' GROUP BY 1
)
SELECT week_start, steps, human_steps, system_steps, ai_steps,
       round(100.0 * human_steps / steps, 1) AS manual_percent,
       round(100.0 * system_steps / steps, 1) AS system_percent,
       round(100.0 * ai_steps / steps, 1) AS ai_percent
FROM steps;

REVOKE ALL ON reporting.automation_weekly FROM PUBLIC;
GRANT SELECT ON reporting.automation_weekly TO reporting_reader;
