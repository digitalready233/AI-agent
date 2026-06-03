-- D-ID Agents session fields on demo sessions

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS did_session_id text,
  ADD COLUMN IF NOT EXISTS did_agent_id text,
  ADD COLUMN IF NOT EXISTS did_stream_id text;

CREATE INDEX IF NOT EXISTS idx_demo_sessions_did_stream
  ON demo_sessions (did_stream_id)
  WHERE did_stream_id IS NOT NULL;
