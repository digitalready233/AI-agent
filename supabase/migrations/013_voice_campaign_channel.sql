-- Voice outbound campaigns use campaigns.channel = 'voice'
comment on column public.campaigns.channel is 'whatsapp | email | voice | voice_future (legacy)';
