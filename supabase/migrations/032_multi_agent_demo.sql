-- Multi-agent demo orchestration: specialist roles, assignments, events

CREATE TABLE IF NOT EXISTS demo_agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  demo_session_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  agent_role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_agent_assignments_session
  ON demo_agent_assignments (demo_session_id, agent_role);

CREATE TABLE IF NOT EXISTS multi_agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  demo_session_id uuid NOT NULL,
  agent_role text NOT NULL,
  agent_id uuid,
  event_type text NOT NULL,
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multi_agent_events_session
  ON multi_agent_events (demo_session_id, created_at DESC);

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS operational_role text DEFAULT 'general_sales';

COMMENT ON COLUMN agents.operational_role IS 'general_sales | demo_presenter | lead_qualification | objection_handling | booking | crm_summary | handoff | follow_up';

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS multi_agent_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_presenter_agent_id uuid,
  ADD COLUMN IF NOT EXISTS qualification_agent_id uuid,
  ADD COLUMN IF NOT EXISTS objection_agent_id uuid,
  ADD COLUMN IF NOT EXISTS booking_agent_id uuid,
  ADD COLUMN IF NOT EXISTS crm_summary_agent_id uuid,
  ADD COLUMN IF NOT EXISTS handoff_agent_id uuid,
  ADD COLUMN IF NOT EXISTS follow_up_agent_id uuid,
  ADD COLUMN IF NOT EXISTS multi_agent_assignment_mode text DEFAULT 'org_default_team';

COMMENT ON COLUMN demo_sessions.multi_agent_assignment_mode IS 'same_agent | org_default_team | smart_assignment | manual';
