-- Demo recording, timeline, replay, and manager review

-- Session recording state (extends 021 flags)
ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS recording_consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS recording_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_provider text,
  ADD COLUMN IF NOT EXISTS recording_error text,
  ADD COLUMN IF NOT EXISTS follow_up_draft text,
  ADD COLUMN IF NOT EXISTS follow_up_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_demo_automation_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_quality_score smallint,
  ADD COLUMN IF NOT EXISTS lead_quality_score smallint,
  ADD COLUMN IF NOT EXISTS ai_performance_rating smallint,
  ADD COLUMN IF NOT EXISTS human_takeover_rating smallint,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS replay_view_count integer NOT NULL DEFAULT 0;

ALTER TABLE demo_sessions
  DROP CONSTRAINT IF EXISTS demo_sessions_recording_status_check;

ALTER TABLE demo_sessions
  ADD CONSTRAINT demo_sessions_recording_status_check
  CHECK (
    recording_status IN (
      'idle',
      'pending_consent',
      'starting',
      'recording',
      'stopped',
      'failed',
      'unavailable'
    )
  );

CREATE TABLE IF NOT EXISTS demo_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id uuid NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'livekit_egress',
  status text NOT NULL DEFAULT 'idle',
  egress_id text,
  recording_url text,
  thumbnail_url text,
  duration_seconds integer,
  file_size bigint,
  consent_given boolean NOT NULL DEFAULT false,
  started_by text,
  started_at timestamptz,
  ended_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_recordings_session
  ON demo_recordings (demo_session_id);

CREATE INDEX IF NOT EXISTS idx_demo_recordings_org
  ON demo_recordings (organization_id, created_at DESC);

ALTER TABLE demo_recordings
  DROP CONSTRAINT IF EXISTS demo_recordings_status_check;

ALTER TABLE demo_recordings
  ADD CONSTRAINT demo_recordings_status_check
  CHECK (status IN ('idle', 'starting', 'recording', 'stopped', 'failed', 'processing'));

CREATE TABLE IF NOT EXISTS demo_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id uuid NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  event_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_timeline_session
  ON demo_timeline_events (demo_session_id, event_at ASC);

CREATE INDEX IF NOT EXISTS idx_demo_timeline_org
  ON demo_timeline_events (organization_id, event_at DESC);
