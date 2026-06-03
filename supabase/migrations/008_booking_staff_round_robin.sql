-- Staff round-robin assignment + profile booking emails

alter table public.profiles
  add column if not exists booking_email text;

alter table public.calendar_settings
  add column if not exists round_robin_profile_ids jsonb not null default '[]'::jsonb,
  add column if not exists last_round_robin_index integer not null default 0;
