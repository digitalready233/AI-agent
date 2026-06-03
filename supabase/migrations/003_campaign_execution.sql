-- Campaign execution tracking per lead

alter table public.campaign_leads
  add column if not exists attempts int not null default 0,
  add column if not exists last_sent_at timestamptz,
  add column if not exists last_error text,
  add column if not exists channels_sent jsonb not null default '[]'::jsonb;
