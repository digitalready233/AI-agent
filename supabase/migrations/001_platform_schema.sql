-- AI Sales Agent Platform — core schema
-- Run in Supabase SQL Editor or via supabase db push

create extension if not exists "pgcrypto";

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  website text,
  email text,
  phone text,
  logo_url text,
  timezone text default 'Africa/Accra',
  created_at timestamptz not null default now()
);

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  role text not null default 'company_admin' check (
    role in (
      'super_admin',
      'company_admin',
      'sales_manager',
      'sales_agent',
      'support_agent',
      'viewer'
    )
  ),
  department text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists profiles_org_idx on public.profiles(organization_id);

-- Agents
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  nickname text,
  company_product_name text,
  agent_type text not null default 'sales' check (
    agent_type in ('sales', 'support', 'demo', 'booking', 'onboarding')
  ),
  position text,
  language text default 'en',
  tone text default 'professional',
  timezone text default 'Africa/Accra',
  voice text,
  voice_speed numeric default 1,
  avatar_url text,
  welcome_message text,
  system_prompt text,
  qualification_prompt text,
  objection_prompt text,
  handoff_rules text,
  lead_scoring_rules text,
  fallback_response text,
  channels jsonb not null default '["website"]'::jsonb,
  status text not null default 'draft' check (status in ('active', 'paused', 'draft')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_org_idx on public.agents(organization_id);

-- Knowledge bases
create table if not exists public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived', 'draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  category text not null,
  content text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(agent_id, knowledge_base_id)
);

-- Leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  business_name text,
  service_interest text,
  budget text,
  timeline text,
  source text default 'website',
  lead_score integer default 0,
  lead_category text default 'warm' check (
    lead_category in ('hot', 'warm', 'cold', 'support', 'not_qualified')
  ),
  lead_status text not null default 'created' check (
    lead_status in (
      'created', 'open', 'working', 'qualified', 'disqualified',
      'opportunity_created', 'opportunity_lost', 'customer'
    )
  ),
  assigned_to uuid references public.profiles(id) on delete set null,
  summary text,
  next_action text,
  follow_up_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_org_idx on public.leads(organization_id);

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  session_id text,
  customer_name text,
  customer_phone text,
  customer_email text,
  channel text not null default 'website',
  status text not null default 'new' check (
    status in (
      'new', 'ai_handling', 'waiting_customer', 'human_needed',
      'assigned', 'booked', 'follow_up', 'resolved', 'closed'
    )
  ),
  detected_intent text,
  ai_confidence numeric,
  summary text,
  recommended_next_action text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'assistant', 'system', 'staff')),
  sender_name text,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_needed text,
  meeting_date date,
  meeting_time time,
  duration_minutes integer default 30,
  assigned_to uuid references public.profiles(id) on delete set null,
  meeting_link text,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'confirmed', 'completed', 'missed', 'rescheduled', 'cancelled')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  name text not null,
  campaign_type text default 'follow_up',
  status text not null default 'draft' check (
    status in ('draft', 'scheduled', 'live', 'paused', 'completed')
  ),
  scheduled_at timestamptz,
  follow_up_rules jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agent tasks / webhooks
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  name text not null,
  trigger_type text not null,
  action_type text not null,
  webhook_url text,
  http_method text default 'POST',
  headers jsonb default '{}'::jsonb,
  payload_template text,
  status text not null default 'active',
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Integrations
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_type text not null,
  status text not null default 'not_connected' check (
    status in ('connected', 'not_connected', 'needs_attention')
  ),
  config jsonb default '{}'::jsonb,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, integration_type)
);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  status text not null default 'unread',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at before update on public.agents
  for each row execute function public.set_updated_at();

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.knowledge_bases enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.agent_knowledge_bases enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.bookings enable row level security;
alter table public.campaigns enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.integrations enable row level security;
alter table public.notifications enable row level security;

-- Helper: user's organization
create or replace function public.user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where user_id = auth.uid() limit 1;
$$;

-- Policies: members access their org data
do $$ declare t text;
begin
  foreach t in array array[
    'agents', 'knowledge_bases', 'knowledge_entries', 'leads',
    'conversations', 'bookings', 'campaigns', 'agent_tasks',
    'integrations', 'notifications'
  ] loop
    execute format('drop policy if exists org_select on public.%I', t);
    execute format(
      'create policy org_select on public.%I for select using (organization_id = public.user_organization_id())',
      t
    );
    execute format('drop policy if exists org_insert on public.%I', t);
    execute format(
      'create policy org_insert on public.%I for insert with check (organization_id = public.user_organization_id())',
      t
    );
    execute format('drop policy if exists org_update on public.%I', t);
    execute format(
      'create policy org_update on public.%I for update using (organization_id = public.user_organization_id())',
      t
    );
    execute format('drop policy if exists org_delete on public.%I', t);
    execute format(
      'create policy org_delete on public.%I for delete using (organization_id = public.user_organization_id())',
      t
    );
  end loop;
end $$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (organization_id = public.user_organization_id() or user_id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (user_id = auth.uid());

drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations
  for select using (id = public.user_organization_id());

-- Messages via conversation org
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.organization_id = public.user_organization_id()
  )
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.organization_id = public.user_organization_id()
  )
);

-- Agent knowledge join
drop policy if exists akb_select on public.agent_knowledge_bases;
create policy akb_select on public.agent_knowledge_bases for select using (
  exists (select 1 from public.agents a where a.id = agent_id and a.organization_id = public.user_organization_id())
);

drop policy if exists akb_mutate on public.agent_knowledge_bases;
create policy akb_insert on public.agent_knowledge_bases for insert with check (
  exists (select 1 from public.agents a where a.id = agent_id and a.organization_id = public.user_organization_id())
);

-- Auto-create profile on signup (requires organization_id in metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_name text;
begin
  org_name := coalesce(new.raw_user_meta_data->>'organization_name', 'My Company');
  org_id := (new.raw_user_meta_data->>'organization_id')::uuid;

  if org_id is null then
    insert into public.organizations (name, email)
    values (org_name, new.email)
    returning id into org_id;
  end if;

  insert into public.profiles (user_id, organization_id, full_name, role)
  values (
    new.id,
    org_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'company_admin')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
