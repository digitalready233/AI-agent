-- Recording/replay v2: follow-up tasks, manager review status, consent_required

ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS manager_notes text,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'not_reviewed';

ALTER TABLE demo_sessions
  DROP CONSTRAINT IF EXISTS demo_sessions_recording_status_check;

ALTER TABLE demo_sessions
  ADD CONSTRAINT demo_sessions_recording_status_check
  CHECK (
    recording_status IN (
      'idle',
      'consent_required',
      'pending_consent',
      'starting',
      'recording',
      'stopped',
      'failed',
      'unavailable'
    )
  );

ALTER TABLE demo_sessions
  DROP CONSTRAINT IF EXISTS demo_sessions_review_status_check;

ALTER TABLE demo_sessions
  ADD CONSTRAINT demo_sessions_review_status_check
  CHECK (review_status IN ('not_reviewed', 'reviewed', 'needs_attention'));

ALTER TABLE demo_recordings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  demo_session_id uuid REFERENCES demo_sessions(id) ON DELETE SET NULL,
  lead_id uuid,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  due_at timestamptz,
  assigned_to text,
  follow_up_draft text,
  priority text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_org_due
  ON follow_up_tasks (organization_id, due_at);

CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_session
  ON follow_up_tasks (demo_session_id);

ALTER TABLE follow_up_tasks
  DROP CONSTRAINT IF EXISTS follow_up_tasks_status_check;

ALTER TABLE follow_up_tasks
  ADD CONSTRAINT follow_up_tasks_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled'));
