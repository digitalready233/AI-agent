-- Avatar smart routing rules and per-session provider metrics

CREATE TABLE IF NOT EXISTS avatar_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL,
  fallback_provider text NOT NULL DEFAULT 'internal_card',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avatar_routing_rules_org_priority
  ON avatar_routing_rules (organization_id, priority ASC);

CREATE TABLE IF NOT EXISTS avatar_provider_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider text NOT NULL,
  demo_session_id uuid,
  status text NOT NULL,
  start_time_ms integer,
  session_duration_seconds integer,
  failed_reason text,
  fallback_used boolean NOT NULL DEFAULT false,
  booking_created boolean NOT NULL DEFAULT false,
  lead_category text,
  human_handoff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avatar_provider_metrics_org_provider
  ON avatar_provider_metrics (organization_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avatar_provider_metrics_session
  ON avatar_provider_metrics (demo_session_id)
  WHERE demo_session_id IS NOT NULL;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS avatar_provider_mode text DEFAULT 'org_default',
  ADD COLUMN IF NOT EXISTS avatar_preferred_provider text,
  ADD COLUMN IF NOT EXISTS avatar_allow_auto_switch boolean DEFAULT true;

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS avatar_fallback_provider text,
  ADD COLUMN IF NOT EXISTS avatar_routing_rule_id uuid,
  ADD COLUMN IF NOT EXISTS avatar_provider_mode text;

COMMENT ON COLUMN agents.avatar_provider_mode IS 'org_default | fixed | smart_routing';
COMMENT ON COLUMN demo_sessions.avatar_fallback_provider IS 'Provider used when primary avatar fails';
