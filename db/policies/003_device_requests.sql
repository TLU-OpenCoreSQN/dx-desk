-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W5-02: thay quyền đọc "mọi staff" của 001_rls.sql. Người đề nghị thấy đề nghị của mình,
-- Manager thấy đề nghị của đơn vị mình, IT (Agent) chỉ thấy đề nghị đã được duyệt trở đi.
DROP POLICY devices_read ON public.device_requests;
CREATE POLICY devices_read ON public.device_requests FOR SELECT TO authenticated
USING (private.can_read_device_request(requester_id, department, status));
