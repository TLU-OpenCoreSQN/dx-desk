-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE private.assistant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT private.user_id(),
  title text NOT NULL DEFAULT 'Cuộc trò chuyện mới' CHECK (length(title) BETWEEN 1 AND 100),
  automatic_title boolean NOT NULL DEFAULT true,
  context_summary text NOT NULL DEFAULT '',
  summarized_through bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
CREATE INDEX assistant_sessions_owner_updated ON private.assistant_sessions(owner_id, updated_at DESC, id);
CREATE TABLE private.assistant_turns (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  owner_id uuid NOT NULL DEFAULT private.user_id(),
  ordinal bigserial NOT NULL UNIQUE,
  question text NOT NULL CHECK (length(question) BETWEEN 1 AND 8000),
  answer text NOT NULL DEFAULT '' CHECK (length(answer) <= 16000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','error','interrupted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  finished_at timestamptz,
  FOREIGN KEY (session_id,owner_id) REFERENCES private.assistant_sessions(id,owner_id) ON DELETE CASCADE
);
CREATE INDEX assistant_turns_history ON private.assistant_turns(session_id,ordinal DESC);
CREATE UNIQUE INDEX assistant_one_pending_turn ON private.assistant_turns(session_id) WHERE status='pending';
ALTER TABLE private.assistant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assistant_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE private.assistant_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assistant_turns FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_session_owner ON private.assistant_sessions TO authenticated
  USING (owner_id=private.user_id()) WITH CHECK (owner_id=private.user_id());
CREATE POLICY assistant_turn_owner ON private.assistant_turns TO authenticated
  USING (owner_id=private.user_id()) WITH CHECK (owner_id=private.user_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON private.assistant_sessions,private.assistant_turns TO authenticated;
GRANT USAGE ON SEQUENCE private.assistant_turns_ordinal_seq TO authenticated;
