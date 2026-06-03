-- WhatsApp Cloud API: per-org routing and template placeholders

create table if not exists public.whatsapp_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  phone_number_id text not null,
  waba_id text,
  default_agent_id uuid references public.agents(id) on delete set null,
  webhook_verify_token text,
  message_templates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_settings_phone_number_idx
  on public.whatsapp_settings (phone_number_id);

drop trigger if exists whatsapp_settings_updated_at on public.whatsapp_settings;
create trigger whatsapp_settings_updated_at before update on public.whatsapp_settings
  for each row execute function public.set_updated_at();

alter table public.whatsapp_settings enable row level security;

create policy whatsapp_settings_org on public.whatsapp_settings
  for all using (
    organization_id in (
      select organization_id from public.profiles where user_id = auth.uid()
    )
  );
