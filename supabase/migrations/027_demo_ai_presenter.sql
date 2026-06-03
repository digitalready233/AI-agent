-- AI visual presenter (animated card) for demo sessions

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS ai_presenter_state text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS ai_presenter_mode text DEFAULT 'animated_card',
  ADD COLUMN IF NOT EXISTS ai_presenter_last_stage text,
  ADD COLUMN IF NOT EXISTS ai_presenter_last_asset_id uuid,
  ADD COLUMN IF NOT EXISTS ai_presenter_last_updated_at timestamptz;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS presenter_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS demo_presenter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  demo_session_id uuid NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text,
  actor_id text,
  title text NOT NULL DEFAULT '',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_presenter_events_session
  ON demo_presenter_events (demo_session_id, created_at);
