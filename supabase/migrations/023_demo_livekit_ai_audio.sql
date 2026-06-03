-- Native LiveKit AI audio publishing state
ALTER TABLE demo_sessions
  ADD COLUMN IF NOT EXISTS ai_audio_track_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_audio_mode text NOT NULL DEFAULT 'fallback_tts',
  ADD COLUMN IF NOT EXISTS ai_audio_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS ai_audio_error text,
  ADD COLUMN IF NOT EXISTS ai_last_spoken_at timestamptz;

ALTER TABLE demo_sessions
  DROP CONSTRAINT IF EXISTS demo_sessions_ai_audio_mode_check;

ALTER TABLE demo_sessions
  ADD CONSTRAINT demo_sessions_ai_audio_mode_check
  CHECK (ai_audio_mode IN ('fallback_tts', 'livekit_track', 'realtime_agent'));

ALTER TABLE demo_sessions
  DROP CONSTRAINT IF EXISTS demo_sessions_ai_audio_status_check;

ALTER TABLE demo_sessions
  ADD CONSTRAINT demo_sessions_ai_audio_status_check
  CHECK (
    ai_audio_status IN (
      'idle',
      'listening',
      'thinking',
      'speaking',
      'paused',
      'failed'
    )
  );

CREATE INDEX IF NOT EXISTS idx_demo_sessions_ai_audio_active
  ON demo_sessions (organization_id, ai_audio_status)
  WHERE ai_joined = true AND ai_audio_status <> 'idle';

COMMENT ON COLUMN demo_sessions.ai_audio_mode IS 'fallback_tts | livekit_track | realtime_agent';
COMMENT ON COLUMN demo_sessions.ai_audio_status IS 'idle | listening | thinking | speaking | paused | failed';
