-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Only the API login can redeem an already verified signed capability. This
-- function is outside PostgREST's public schema and unavailable to JWT roles.
CREATE FUNCTION private.clean_attachment_for_download(p_id uuid)
RETURNS TABLE(object_key text, file_name text, size_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT a.object_key, a.file_name, a.size_bytes
    FROM public.attachments a WHERE a.id=p_id AND a.scan_status='clean'
$$;
REVOKE ALL ON FUNCTION private.clean_attachment_for_download(uuid) FROM PUBLIC, authenticated, anon;
GRANT USAGE ON SCHEMA private TO api_login;
GRANT EXECUTE ON FUNCTION private.clean_attachment_for_download(uuid) TO api_login;
