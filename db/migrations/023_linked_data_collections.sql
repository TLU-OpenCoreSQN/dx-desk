-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
CREATE FUNCTION private.linked_resources(p_kind text)
RETURNS TABLE(code text, name text, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT c.code, c.name, c.description FROM public.categories c
   WHERE p_kind IN ('services', 'request-types') AND c.active
     AND c.code ~ '^[a-z][a-z0-9_-]{1,39}$'
  UNION ALL
  SELECT d.code, d.name, ''::text FROM private.device_types d
   WHERE p_kind = 'device-types' AND d.active
  ORDER BY 1
$$;
REVOKE ALL ON FUNCTION private.linked_resources(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION private.linked_resources(text) TO api_login;
