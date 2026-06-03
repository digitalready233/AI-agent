-- Sales ops: agent booking/CRM rules, conversation stage, booking link, campaign audiences

alter table public.agents
  add column if not exists booking_rules text,
  add column if not exists crm_update_rules text;

alter table public.conversations
  add column if not exists conversation_stage text;

alter table public.bookings
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

create index if not exists bookings_conversation_idx on public.bookings(conversation_id);

create table if not exists public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'replied', 'failed', 'skipped')
  ),
  created_at timestamptz not null default now(),
  unique(campaign_id, lead_id)
);

create index if not exists campaign_leads_campaign_idx on public.campaign_leads(campaign_id);
create index if not exists campaign_leads_org_idx on public.campaign_leads(organization_id);
