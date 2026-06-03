-- Human staff live join / takeover for demo sessions

alter table public.demo_sessions
  add column if not exists ai_paused boolean not null default false,
  add column if not exists human_takeover_started_at timestamptz,
  add column if not exists human_takeover_ended_at timestamptz,
  add column if not exists human_takeover_by uuid references auth.users(id) on delete set null,
  add column if not exists handoff_reason text,
  add column if not exists handoff_status text not null default 'none' check (
    handoff_status in (
      'none', 'requested', 'notified', 'joined', 'taken_over', 'resolved'
    )
  );

create index if not exists demo_sessions_handoff_active_idx
  on public.demo_sessions (organization_id, handoff_required, handoff_status)
  where handoff_required = true;

create table if not exists public.demo_events (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'handoff_triggered',
      'staff_notified',
      'staff_joined',
      'takeover_started',
      'ai_paused',
      'ai_resumed',
      'takeover_ended',
      'demo_completed'
    )
  ),
  actor_type text not null default 'system' check (
    actor_type in ('system', 'prospect', 'staff', 'agent')
  ),
  actor_id text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists demo_events_session_idx
  on public.demo_events (demo_session_id, created_at desc);

create index if not exists demo_events_org_idx
  on public.demo_events (organization_id, created_at desc);
