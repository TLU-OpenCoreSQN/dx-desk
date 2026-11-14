-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Route claimed deliveries from stored events, including pending rows with an older inbox ACK.
CREATE FUNCTION private.device_notice_channel(p_event_id uuid, p_lease_token uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE channel_key text;
BEGIN
  PERFORM private.require_automation();
  SELECT CASE o.envelope->>'event_type'
    WHEN 'device_request.created' THEN 'device-manager:' || r.department
    WHEN 'device_request.approved' THEN 'device-it'
    WHEN 'device_request.rejected' THEN 'device-requester:' || r.requester_id::text
    WHEN 'device_request.handed_over' THEN 'device-requester:' || r.requester_id::text
  END INTO channel_key
  FROM private.outbox o
  JOIN public.device_request_events e ON e.id = o.event_id
  JOIN public.device_requests r ON r.id = e.request_id
  WHERE o.event_id = p_event_id AND o.destination = 'device_request'
    AND o.status = 'processing' AND o.lease_token = p_lease_token
    AND o.locked_until > statement_timestamp();
  RETURN channel_key;
END
$$;

REVOKE ALL ON FUNCTION private.device_notice_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.device_notice_channel(uuid, uuid) TO ticket_automation;
