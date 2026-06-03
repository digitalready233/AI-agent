-- Organization profile extensions + workspace settings + secrets

alter table public.organizations
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists currency text default 'USD',
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  agent_defaults jsonb not null default '{}'::jsonb,
  sales_pipeline jsonb not null default '{}'::jsonb,
  lead_scoring jsonb not null default '{}'::jsonb,
  human_handoff jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  security jsonb not null default '{}'::jsonb,
  billing jsonb not null default '{}'::jsonb,
  data_privacy jsonb not null default '{}'::jsonb,
  api_settings jsonb not null default '{}'::jsonb,
  team_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  secret_key text not null,
  encrypted_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, secret_key)
);

create index if not exists organization_secrets_org_idx on public.organization_secrets(organization_id);

-- Allow company members to update their organization row
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
  for update using (id = public.user_organization_id());

alter table public.organization_settings enable row level security;
alter table public.organization_secrets enable row level security;

drop policy if exists org_settings_select on public.organization_settings;
create policy org_settings_select on public.organization_settings
  for select using (organization_id = public.user_organization_id());

drop policy if exists org_settings_insert on public.organization_settings;
create policy org_settings_insert on public.organization_settings
  for insert with check (organization_id = public.user_organization_id());

drop policy if exists org_settings_update on public.organization_settings;
create policy org_settings_update on public.organization_settings
  for update using (organization_id = public.user_organization_id());

-- Secrets: no direct client access (server uses service role or admin context)
drop policy if exists org_secrets_deny on public.organization_secrets;
create policy org_secrets_deny on public.organization_secrets
  for all using (false);

-- Optional: sales_manager role (relax profiles check)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in (
    'super_admin',
    'company_admin',
    'sales_manager',
    'sales_agent',
    'support_agent',
    'viewer'
  )
);

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists organization_settings_updated_at on public.organization_settings;
create trigger organization_settings_updated_at before update on public.organization_settings
  for each row execute function public.set_updated_at();
