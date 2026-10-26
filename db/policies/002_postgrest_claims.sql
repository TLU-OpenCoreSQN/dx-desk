-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- PostgREST validates signature, exp and audience. Check issuer and identity too.
CREATE FUNCTION private.check_request() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  expected_issuer text := nullif(current_setting('app.settings.jwt_issuer', true), '');
BEGIN
  IF jsonb_typeof(claims->'exp') IS DISTINCT FROM 'number'
     OR jsonb_typeof(claims->'iat') IS DISTINCT FROM 'number' THEN
    RAISE sqlstate 'PT401' USING message = 'Token expiry and issued-at are required';
  END IF;
  IF (claims->>'exp')::numeric <= extract(epoch FROM statement_timestamp()) THEN
    RAISE sqlstate 'PT401' USING message = 'Token expired';
  END IF;
  IF claims ? 'nbf' THEN
    IF jsonb_typeof(claims->'nbf') IS DISTINCT FROM 'number' THEN
      RAISE sqlstate 'PT401' USING message = 'Invalid token not-before';
    END IF;
    IF (claims->>'nbf')::numeric > extract(epoch FROM statement_timestamp()) THEN
      RAISE sqlstate 'PT401' USING message = 'Token not active yet';
    END IF;
  END IF;
  IF jsonb_typeof(claims->'realm_access'->'roles') IS DISTINCT FROM 'array' THEN
    RAISE sqlstate 'PT401' USING message = 'Roles must be an array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(claims->'realm_access'->'roles') AS role_value
    WHERE jsonb_typeof(role_value) <> 'string'
  ) THEN
    RAISE sqlstate 'PT401' USING message = 'Roles must contain only strings';
  END IF;
  IF expected_issuer IS NULL OR claims->>'iss' IS DISTINCT FROM expected_issuer
     OR claims->>'role' IS DISTINCT FROM 'authenticated'
     OR coalesce(claims->>'sub', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR NOT coalesce((claims->'realm_access'->'roles') ?| ARRAY['Employee', 'Agent', 'Manager'], false)
  THEN
    RAISE sqlstate 'PT401' USING message = 'Invalid identity or issuer';
  END IF;
END
$$;
REVOKE ALL ON FUNCTION private.check_request() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon;
GRANT EXECUTE ON FUNCTION private.check_request() TO anon, authenticated;
