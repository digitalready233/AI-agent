-- AI Sales Demo Experience: guided paths, entry modes, objections

create table if not exists public.demo_paths (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  title text not null,
  description text,
  service_category text,
  target_industry text,
  qualification_questions jsonb not null default '[]'::jsonb,
  demo_asset_sequence jsonb not null default '[]'::jsonb,
  recommended_cta text,
  path_key text,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_paths_org_agent_idx
  on public.demo_paths (organization_id, agent_id, status);

alter table public.demo_sessions
  add column if not exists demo_path_id uuid references public.demo_paths(id) on delete set null,
  add column if not exists entry_mode text not null default 'scheduled'
    check (entry_mode in ('on_demand', 'scheduled')),
  add column if not exists current_demo_asset_id uuid,
  add column if not exists objections jsonb not null default '[]'::jsonb,
  add column if not exists qualification_progress jsonb not null default '{}'::jsonb;

create index if not exists demo_sessions_path_idx
  on public.demo_sessions (demo_path_id);

alter table public.demo_paths enable row level security;
alter table public.demo_paths force row level security;

create policy demo_paths_org on public.demo_paths
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );
