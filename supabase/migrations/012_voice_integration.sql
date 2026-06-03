-- Twilio Voice + call logging (inbound-first)

create table if not exists public.voice_integrations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null default 'twilio',
  twilio_account_sid text,
  twilio_phone_number text,
  default_agent_id uuid references public.agents(id) on delete set null,
  default_voice text default 'alloy',
  human_transfer_phone text,
  recording_enabled boolean not null default true,
  transcription_enabled boolean not null default true,
  business_hours jsonb not null default '{}'::jsonb,
  after_hours_behavior text not null default 'voicemail',
  connection_status text not null default 'not_connected',
  last_tested_at timestamptz,
  inbound_webhook_url text,
  status_callback_url text,
  media_stream_ws_url text,
  use_media_stream boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index if not exists voice_integrations_phone_idx
  on public.voice_integrations (twilio_phone_number)
  where twilio_phone_number is not null and twilio_phone_number <> '';

drop trigger if exists voice_integrations_updated_at on public.voice_integrations;
create trigger voice_integrations_updated_at before update on public.voice_integrations
  for each row execute function public.set_updated_at();

alter table public.voice_integrations enable row level security;

create policy voice_integrations_org on public.voice_integrations
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  provider text not null default 'twilio',
  twilio_call_sid text,
  from_number text,
  to_number text,
  direction text not null default 'inbound',
  status text not null default 'initiated',
  call_type text not null default 'inbound',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  transcript text,
  summary text,
  detected_intent text,
  lead_score integer,
  lead_category text,
  handoff_required boolean not null default false,
  recommended_next_action text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calls_twilio_sid_idx
  on public.calls (twilio_call_sid)
  where twilio_call_sid is not null;

create index if not exists calls_org_created_idx
  on public.calls (organization_id, created_at desc);

drop trigger if exists calls_updated_at on public.calls;
create trigger calls_updated_at before update on public.calls
  for each row execute function public.set_updated_at();

alter table public.calls enable row level security;

create policy calls_org on public.calls
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists call_events_call_idx
  on public.call_events (call_id, created_at);

alter table public.call_events enable row level security;

create policy call_events_org on public.call_events
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

create table if not exists public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  speaker text not null default 'unknown',
  content text not null,
  sequence_num integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists call_transcripts_call_idx
  on public.call_transcripts (call_id, sequence_num);

alter table public.call_transcripts enable row level security;

create policy call_transcripts_org on public.call_transcripts
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );
