-- Screen sharing + presentation control for demo sessions

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS screen_share_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS screen_share_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS screen_share_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS screen_share_by text,
  ADD COLUMN IF NOT EXISTS current_presenter_type text,
  ADD COLUMN IF NOT EXISTS current_presenter_id text,
  ADD COLUMN IF NOT EXISTS presentation_control_mode text NOT NULL DEFAULT 'ai_controlled';

COMMENT ON COLUMN demo_sessions.presentation_control_mode IS
  'ai_controlled | staff_controlled | shared_control';

CREATE TABLE IF NOT EXISTS demo_presentation_events (
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

CREATE INDEX IF NOT EXISTS idx_demo_presentation_events_session
  ON demo_presentation_events (demo_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_demo_presentation_events_org
  ON demo_presentation_events (organization_id, created_at DESC);
