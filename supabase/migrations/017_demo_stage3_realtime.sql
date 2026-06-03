-- Stage 3: realtime demo room — transcript enrichment + session realtime metadata

alter table public.demo_transcripts
  add column if not exists speaker_type text,
  add column if not exists input_type text default 'text' check (input_type in ('text', 'voice')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.demo_transcripts.speaker_type is 'prospect | agent | staff | system';
comment on column public.demo_transcripts.input_type is 'text | voice';

-- Backfill speaker_type from speaker for existing rows
update public.demo_transcripts
set speaker_type = case
  when lower(speaker) in ('prospect', 'customer', 'user', 'guest') then 'prospect'
  when lower(speaker) in ('agent', 'ai', 'assistant') then 'agent'
  when lower(speaker) = 'staff' then 'staff'
  else 'prospect'
end
where speaker_type is null;
