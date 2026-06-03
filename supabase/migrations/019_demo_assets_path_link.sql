-- Link demo assets to guided demo paths

alter table public.demo_assets
  add column if not exists demo_path_id uuid references public.demo_paths(id) on delete set null;

create index if not exists demo_assets_path_order_idx
  on public.demo_assets (organization_id, demo_path_id, sort_order);
