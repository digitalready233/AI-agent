-- Browser-based AI demo calls foundation

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  title text not null default 'Product demo',
  demo_type text not null default 'product',
  status text not null default 'scheduled' check (
    status in (
      'scheduled', 'waiting', 'in_progress', 'completed',
      'missed', 'cancelled', 'human_taken_over'
    )
  ),
  current_demo_stage text not null default 'welcome',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  summary text,
  transcript text,
  detected_intent text,
  lead_score integer,
  lead_category text,
  handoff_required boolean not null default false,
  booking_recommended boolean not null default false,
  recommended_next_action text,
  recording_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_sessions_org_created_idx
  on public.demo_sessions (organization_id, created_at desc);

create table if not exists public.demo_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  role text not null default 'prospect' check (role in ('prospect', 'agent', 'staff')),
  display_name text,
  email text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists demo_participants_session_idx
  on public.demo_participants (demo_session_id);

create table if not exists public.demo_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  sender_type text not null check (sender_type in ('prospect', 'agent', 'staff', 'system')),
  sender_name text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists demo_messages_session_idx
  on public.demo_messages (demo_session_id, created_at);

create table if not exists public.demo_transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  speaker text not null default 'unknown',
  content text not null,
  sequence_num integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists demo_transcripts_session_idx
  on public.demo_transcripts (demo_session_id, sequence_num);

create table if not exists public.demo_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  content text not null default '',
  asset_type text not null default 'slide' check (
    asset_type in (
      'slide', 'service_card', 'product_step', 'pricing_placeholder',
      'case_study', 'faq'
    )
  ),
  sort_order integer not null default 0,
  attached_agent_id uuid references public.agents(id) on delete set null,
  attached_knowledge_base_id uuid references public.knowledge_bases(id) on delete set null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_assets_org_idx
  on public.demo_assets (organization_id, sort_order);

create table if not exists public.demo_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  outcome_type text not null default 'completed',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists demo_outcomes_session_idx
  on public.demo_outcomes (demo_session_id);

drop trigger if exists demo_sessions_updated_at on public.demo_sessions;
create trigger demo_sessions_updated_at before update on public.demo_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists demo_assets_updated_at on public.demo_assets;
create trigger demo_assets_updated_at before update on public.demo_assets
  for each row execute function public.set_updated_at();

alter table public.demo_sessions enable row level security;
alter table public.demo_participants enable row level security;
alter table public.demo_messages enable row level security;
alter table public.demo_transcripts enable row level security;
alter table public.demo_assets enable row level security;
alter table public.demo_outcomes enable row level security;

create policy demo_sessions_org on public.demo_sessions for all using (
  organization_id in (select organization_id from public.profiles where user_id = auth.uid())
);
create policy demo_participants_org on public.demo_participants for all using (
  organization_id in (select organization_id from public.profiles where user_id = auth.uid())
);
create policy demo_messages_org on public.demo_messages for all using (
  organization_id in (select organization_id from public.profiles where user_id = auth.uid())
);
create policy demo_transcripts_org on public.demo_transcripts for all using (
  organization_id in (select organization_id from public.profiles where user_id = auth.uid())
);
create policy demo_assets_org on public.demo_assets for all using (
  organization_id in (select organization_id from public.profiles where user_id = auth.uid())
);
create policy demo_outcomes_org on public.demo_outcomes for all using (
  organization_id in (select organization_id from public.profiles where user_id = auth.uid())
);
