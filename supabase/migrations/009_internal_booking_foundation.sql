-- Internal booking foundation: meeting_types, staff_availability, extended bookings

-- Meeting types (per organization)
create table if not exists public.meeting_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  provider text not null default 'internal' check (
    provider in ('internal', 'google_calendar', 'calendly')
  ),
  location_type text not null default 'phone_call' check (
    location_type in ('phone_call', 'google_meet', 'zoom', 'office', 'custom')
  ),
  assigned_staff uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists meeting_types_org_idx on public.meeting_types (organization_id);

-- Staff availability (per staff member, per day)
create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'UTC',
  is_available boolean not null default true,
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists staff_availability_org_staff_idx
  on public.staff_availability (organization_id, staff_id);

-- Booking settings: default provider internal
alter table public.calendar_settings
  alter column default_booking_provider set default 'internal';

update public.calendar_settings
set default_booking_provider = 'internal'
where default_booking_provider is null
   or default_booking_provider not in ('internal', 'google_calendar', 'calendly', 'both');

-- Extend bookings for internal module
alter table public.bookings
  add column if not exists meeting_type_id uuid references public.meeting_types(id) on delete set null,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists timezone text;

create index if not exists bookings_meeting_type_idx on public.bookings (meeting_type_id);
create index if not exists bookings_assigned_to_idx on public.bookings (assigned_to);

-- RLS
alter table public.meeting_types enable row level security;
alter table public.staff_availability enable row level security;

drop policy if exists meeting_types_org on public.meeting_types;
create policy meeting_types_org on public.meeting_types
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists staff_availability_org on public.staff_availability;
create policy staff_availability_org on public.staff_availability
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );

drop trigger if exists meeting_types_updated_at on public.meeting_types;
create trigger meeting_types_updated_at before update on public.meeting_types
  for each row execute function public.set_updated_at();

drop trigger if exists staff_availability_updated_at on public.staff_availability;
create trigger staff_availability_updated_at before update on public.staff_availability
  for each row execute function public.set_updated_at();
