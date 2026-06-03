-- Tavus CVI conversation fields on demo sessions

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS tavus_conversation_id text,
  ADD COLUMN IF NOT EXISTS tavus_conversation_url text,
  ADD COLUMN IF NOT EXISTS tavus_replica_id text,
  ADD COLUMN IF NOT EXISTS tavus_persona_id text;

CREATE INDEX IF NOT EXISTS idx_demo_sessions_tavus_conversation
  ON demo_sessions (tavus_conversation_id)
  WHERE tavus_conversation_id IS NOT NULL;
