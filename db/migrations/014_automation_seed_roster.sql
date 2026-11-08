-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- The scoped automation client can reconcile the active roster it already manages.
CREATE OR REPLACE FUNCTION private.automation_teams() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM private.require_automation();
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'active', t.active,
      'members', (SELECT coalesce(jsonb_agg(m.user_id ORDER BY m.user_id), '[]'::jsonb)
                  FROM private.team_members m WHERE m.team_id = t.id AND m.active)) ORDER BY t.name), '[]'::jsonb)
    FROM public.teams t
  );
END
$$;
