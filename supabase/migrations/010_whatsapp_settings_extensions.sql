-- WhatsApp settings: business phone, connection test metadata, optional callback URL override

alter table public.whatsapp_settings
  add column if not exists business_phone_number text,
  add column if not exists connection_status text not null default 'not_connected',
  add column if not exists last_tested_at timestamptz,
  add column if not exists webhook_callback_url text;

comment on column public.whatsapp_settings.connection_status is
  'not_connected | connected | error';
