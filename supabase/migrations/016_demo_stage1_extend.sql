-- Stage 1 demo module extensions (additive)

alter table public.demo_sessions
  add column if not exists scheduled_at timestamptz,
  add column if not exists admin_notes text;

alter table public.demo_participants
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists name text,
  add column if not exists phone text;

update public.demo_participants
set name = coalesce(name, display_name)
where name is null and display_name is not null;

alter table public.demo_outcomes
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists next_action text,
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists handoff_required boolean not null default false;

-- Expand demo_assets asset_type values
alter table public.demo_assets drop constraint if exists demo_assets_asset_type_check;
alter table public.demo_assets add constraint demo_assets_asset_type_check check (
  asset_type in (
    'slide', 'service_card', 'product_step', 'pricing_placeholder', 'pricing_overview',
    'case_study', 'faq', 'objection_response'
  )
);
