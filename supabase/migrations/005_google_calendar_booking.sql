-- Google Calendar booking: settings, extended bookings, OAuth-friendly secrets usage

create table if not exists public.calendar_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  timezone text not null default 'UTC',
  calendar_id text not null default 'primary',
  slot_interval_minutes integer not null default 30,
  buffer_minutes integer not null default 0,
  meeting_types jsonb not null default '[]'::jsonb,
  staff_availability jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists meeting_type text,
  add column if not exists google_calendar_event_id text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists staff_email text;

create index if not exists bookings_starts_at_idx on public.bookings (starts_at);
create index if not exists bookings_google_event_idx on public.bookings (google_calendar_event_id)
  where google_calendar_event_id is not null;

drop trigger if exists calendar_settings_updated_at on public.calendar_settings;
create trigger calendar_settings_updated_at before update on public.calendar_settings
  for each row execute function public.set_updated_at();

alter table public.calendar_settings enable row level security;

create policy calendar_settings_org on public.calendar_settings
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );
