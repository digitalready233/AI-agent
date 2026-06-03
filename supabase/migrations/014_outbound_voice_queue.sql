-- Outbound voice campaigns: call queue, outcomes, DNC, per-campaign voice settings

-- Lead compliance
alter table public.leads
  add column if not exists do_not_call boolean not null default false,
  add column if not exists do_not_call_at timestamptz;

comment on column public.leads.do_not_call is 'When true, block all outbound voice/SMS outreach';

-- Campaign voice settings (outbound_voice_campaign)
alter table public.campaigns
  add column if not exists voice_settings jsonb not null default '{}'::jsonb;

comment on column public.campaigns.voice_settings is 'Outbound voice: call_window, max_attempts, retry_delay_minutes, voicemail_behavior, human_transfer_phone';

-- Call outcome (business result, distinct from Twilio status)
alter table public.calls
  add column if not exists call_outcome text;

comment on column public.calls.call_outcome is 'answered|no_answer|busy|failed|voicemail|qualified|not_interested|booked|human_transfer|do_not_call';

-- Outbound call queue
create table if not exists public.outbound_call_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_lead_id uuid references public.campaign_leads(id) on delete set null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  phone_number text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending' check (
    status in ('pending', 'dialing', 'completed', 'exhausted', 'skipped', 'cancelled')
  ),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  call_outcome text check (
    call_outcome is null or call_outcome in (
      'answered', 'no_answer', 'busy', 'failed', 'voicemail',
      'qualified', 'not_interested', 'booked', 'human_transfer', 'do_not_call'
    )
  ),
  error_message text,
  last_call_id uuid references public.calls(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index if not exists outbound_call_queue_campaign_status_idx
  on public.outbound_call_queue (campaign_id, status, next_attempt_at);

create index if not exists outbound_call_queue_due_idx
  on public.outbound_call_queue (organization_id, status, scheduled_at)
  where status = 'pending';

drop trigger if exists outbound_call_queue_updated_at on public.outbound_call_queue;
create trigger outbound_call_queue_updated_at before update on public.outbound_call_queue
  for each row execute function public.set_updated_at();

alter table public.outbound_call_queue enable row level security;

create policy outbound_call_queue_org on public.outbound_call_queue
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

-- Allow voice channel on campaigns (align with app)
comment on column public.campaigns.channel is 'whatsapp | email | voice | outbound_voice_campaign maps to channel=voice + campaign_type=outbound_voice_campaign';
