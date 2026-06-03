-- LiveKit AI demo agent worker state on demo_sessions + extended room events

alter table public.demo_sessions
  add column if not exists ai_joined boolean not null default false,
  add column if not exists ai_status text not null default 'not_started' check (
    ai_status in ('not_started', 'starting', 'active', 'paused', 'stopped', 'failed')
  ),
  add column if not exists ai_participant_identity text,
  add column if not exists ai_started_at timestamptz,
  add column if not exists ai_stopped_at timestamptz,
  add column if not exists ai_last_response_at timestamptz;

create index if not exists demo_sessions_ai_active_idx
  on public.demo_sessions (organization_id, ai_status)
  where ai_status in ('starting', 'active', 'paused');

-- demo_sessions.ai_paused already exists from migration 020

alter table public.demo_room_events
  drop constraint if exists demo_room_events_event_type_check;

alter table public.demo_room_events
  add constraint demo_room_events_event_type_check check (
    event_type in (
      'room_created',
      'participant_joined',
      'participant_left',
      'track_published',
      'track_unpublished',
      'staff_joined',
      'ai_joined',
      'ai_started',
      'ai_paused',
      'ai_resumed',
      'ai_stopped',
      'ai_failed',
      'ai_spoke',
      'ai_heard_user',
      'ai_triggered_booking',
      'ai_triggered_handoff',
      'recording_started',
      'recording_stopped',
      'room_ended'
    )
  );

alter table public.demo_room_events
  drop constraint if exists demo_room_events_participant_role_check;

alter table public.demo_room_events
  add constraint demo_room_events_participant_role_check check (
    participant_role is null
    or participant_role in ('prospect', 'staff', 'ai_observer', 'agent', 'ai_agent')
  );
