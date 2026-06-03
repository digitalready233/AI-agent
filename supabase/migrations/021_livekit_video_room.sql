-- LiveKit video room fields on demo sessions + room event log

alter table public.demo_sessions
  add column if not exists livekit_room_name text,
  add column if not exists livekit_room_status text not null default 'not_created' check (
    livekit_room_status in ('not_created', 'created', 'active', 'ended', 'failed')
  ),
  add column if not exists video_provider text not null default 'internal' check (
    video_provider in ('internal', 'livekit', 'daily_future', 'zoom_future', 'agora_future')
  ),
  add column if not exists video_enabled boolean not null default false,
  add column if not exists audio_enabled boolean not null default true,
  add column if not exists screen_share_enabled boolean not null default false,
  add column if not exists recording_enabled boolean not null default false,
  add column if not exists room_started_at timestamptz,
  add column if not exists room_ended_at timestamptz;

create index if not exists demo_sessions_livekit_active_idx
  on public.demo_sessions (organization_id, livekit_room_status)
  where livekit_room_status in ('created', 'active');

create table if not exists public.demo_room_events (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'room_created',
      'participant_joined',
      'participant_left',
      'track_published',
      'track_unpublished',
      'staff_joined',
      'ai_joined',
      'recording_started',
      'recording_stopped',
      'room_ended'
    )
  ),
  participant_identity text,
  participant_role text check (
    participant_role is null or participant_role in ('prospect', 'staff', 'ai_observer', 'agent')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists demo_room_events_session_idx
  on public.demo_room_events (demo_session_id, created_at desc);
