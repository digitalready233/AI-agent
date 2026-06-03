-- Seed: Digital Ready Ghana demo org
-- Run after 001_platform_schema.sql and after creating a test user in Auth.
-- Replace ORG_ID and USER_ID with your values, or use the signup trigger.

-- Example fixed org for local seed (optional — signup trigger creates org automatically)
-- insert into public.organizations (id, name, industry, website, email, phone, timezone)
-- values (
--   '00000000-0000-4000-8000-000000000001',
--   'Digital Ready Ghana',
--   'Digital Marketing & Technology',
--   'https://digitalreadyghana.com',
--   'hello@digitalreadyghana.com',
--   '+233000000000',
--   'Africa/Accra'
-- );

-- Agents (use organization_id from your org)
/*
insert into public.agents (organization_id, name, nickname, company_product_name, agent_type, language, tone, status, channels, welcome_message, system_prompt) values
(org_id, 'AI Sales Assistant', 'Kofi', 'Digital Ready Ghana', 'sales', 'en', 'professional', 'active', '["website","whatsapp"]', 'Hi! I''m Kofi from Digital Ready Ghana. How can I help grow your business today?', 'You are a senior sales consultant for Digital Ready Ghana...'),
(org_id, 'Customer Support Assistant', 'Ama', 'Digital Ready Ghana', 'support', 'en', 'friendly', 'active', '["website"]', 'Hello! I''m here to help with your account and services.', 'You are a helpful support agent...'),
(org_id, 'Appointment Booking Assistant', 'Esi', 'Digital Ready Ghana', 'booking', 'en', 'professional', 'active', '["website","phone"]', 'I can help you schedule a consultation.', 'You help customers book meetings...');
*/

-- See lib/platform/seed.ts for programmatic seed via API when using JSON fallback mode.
