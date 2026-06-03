-- External talking avatar providers for demo sessions

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS avatar_provider text DEFAULT 'internal_card',
  ADD COLUMN IF NOT EXISTS avatar_id text,
  ADD COLUMN IF NOT EXISTS avatar_replica_id text,
  ADD COLUMN IF NOT EXISTS avatar_persona_id text,
  ADD COLUMN IF NOT EXISTS avatar_voice_id text,
  ADD COLUMN IF NOT EXISTS avatar_style text,
  ADD COLUMN IF NOT EXISTS avatar_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_fallback_mode text DEFAULT 'internal_card';

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS avatar_session_id text,
  ADD COLUMN IF NOT EXISTS avatar_provider text,
  ADD COLUMN IF NOT EXISTS avatar_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS avatar_stream_url text,
  ADD COLUMN IF NOT EXISTS avatar_join_url text,
  ADD COLUMN IF NOT EXISTS avatar_error text,
  ADD COLUMN IF NOT EXISTS avatar_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_stopped_at timestamptz;

CREATE TABLE IF NOT EXISTS avatar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'not_connected',
  api_key_encrypted text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_avatar_id text,
  default_voice_id text,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_avatar_integrations_org
  ON avatar_integrations (organization_id);

CREATE TABLE IF NOT EXISTS avatar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  demo_session_id uuid REFERENCES demo_sessions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avatar_events_session
  ON avatar_events (demo_session_id, created_at);
