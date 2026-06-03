-- Campaign automation: templates, multi-step sequences, logs, audience filters

-- Extend campaigns
alter table public.campaigns
  drop constraint if exists campaigns_status_check;

alter table public.campaigns
  add constraint campaigns_status_check check (
    status in ('draft', 'scheduled', 'live', 'paused', 'completed', 'failed')
  );

alter table public.campaigns
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists audience_filters jsonb not null default '{}'::jsonb,
  add column if not exists stop_conditions jsonb not null default '{}'::jsonb,
  add column if not exists message_template_id uuid,
  add column if not exists use_sequence boolean not null default false;

comment on column public.campaigns.channel is 'whatsapp | email | voice_future';

-- Message templates (org-scoped)
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp',
  campaign_type text,
  body text not null default '',
  variables jsonb not null default '[]'::jsonb,
  whatsapp_template_name text,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'rejected', 'active')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_templates_org_idx on public.message_templates(organization_id);

-- Campaign follow-up steps
create table if not exists public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  step_order integer not null default 0,
  delay_amount integer not null default 0,
  delay_unit text not null default 'hours' check (delay_unit in ('minutes', 'hours', 'days')),
  message_template_id uuid references public.message_templates(id) on delete set null,
  message_body text,
  action_after_send text default 'wait_for_reply',
  stop_on_reply boolean not null default true,
  mark_no_response boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create index if not exists campaign_steps_campaign_idx on public.campaign_steps(campaign_id);

-- Campaign execution logs
create table if not exists public.campaign_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_step_id uuid references public.campaign_steps(id) on delete set null,
  channel text not null,
  message_sent text,
  status text not null default 'sent' check (
    status in ('sent', 'failed', 'delivered', 'replied', 'skipped')
  ),
  error_message text,
  sent_at timestamptz not null default now(),
  replied_at timestamptz
);

create index if not exists campaign_logs_campaign_idx on public.campaign_logs(campaign_id, sent_at desc);
create index if not exists campaign_logs_lead_idx on public.campaign_logs(lead_id);

-- Extend campaign_leads for sequences
alter table public.campaign_leads
  add column if not exists current_step_index integer not null default 0,
  add column if not exists next_step_at timestamptz,
  add column if not exists sequence_status text not null default 'active' check (
    sequence_status in ('active', 'paused', 'completed', 'stopped')
  ),
  add column if not exists paused_reason text,
  add column if not exists replied_at timestamptz;

create index if not exists campaign_leads_due_idx
  on public.campaign_leads (campaign_id, next_step_at)
  where sequence_status = 'active' and status not in ('replied', 'skipped');

-- Lead CRM fields for campaigns
alter table public.leads
  add column if not exists last_contacted_at timestamptz,
  add column if not exists marketing_opt_in boolean default true,
  add column if not exists unsubscribed_at timestamptz;

-- RLS
alter table public.message_templates enable row level security;
alter table public.campaign_steps enable row level security;
alter table public.campaign_logs enable row level security;

create policy message_templates_org on public.message_templates
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

create policy campaign_steps_org on public.campaign_steps
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

create policy campaign_logs_org on public.campaign_logs
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );
