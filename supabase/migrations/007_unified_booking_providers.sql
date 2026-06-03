-- Unified booking: Google Calendar + Calendly providers

alter table public.calendar_settings
  add column if not exists default_booking_provider text not null default 'google_calendar',
  add column if not exists enable_google_calendar boolean not null default true,
  add column if not exists enable_calendly boolean not null default false,
  add column if not exists default_meeting_duration_minutes integer not null default 30,
  add column if not exists buffer_before_minutes integer not null default 0,
  add column if not exists buffer_after_minutes integer not null default 0,
  add column if not exists minimum_notice_hours integer not null default 2,
  add column if not exists maximum_days_ahead integer not null default 60,
  add column if not exists default_assigned_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists enable_google_meet boolean not null default true,
  add column if not exists connected_calendar_email text,
  add column if not exists calendly_scheduling_url text,
  add column if not exists calendly_event_types jsonb not null default '[]'::jsonb;

-- Migrate legacy single buffer to before/after when new columns are zero
update public.calendar_settings
set buffer_after_minutes = buffer_minutes
where buffer_after_minutes = 0 and buffer_minutes > 0;

alter table public.bookings
  add column if not exists provider text,
  add column if not exists external_event_id text,
  add column if not exists calendly_invitee_uri text,
  add column if not exists calendly_event_uri text,
  add column if not exists location_type text,
  add column if not exists webhook_payload jsonb;

create index if not exists bookings_provider_idx on public.bookings (provider);
create index if not exists bookings_external_event_idx on public.bookings (external_event_id)
  where external_event_id is not null;

update public.bookings
set provider = 'google_calendar',
    external_event_id = google_calendar_event_id
where google_calendar_event_id is not null and provider is null;
