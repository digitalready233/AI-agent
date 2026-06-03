# AI Sales Agent Platform

SalesCloser-style SaaS dashboard for managing AI sales agents, knowledge bases, leads, conversations, bookings, and integrations.

## Quick start (demo mode — no Supabase)

```bash
npm install
npm run dev
```

1. Open http://localhost:3000/auth/login  
2. Sign in with **admin@digitalreadyghana.com** / **demo1234**  
3. Explore **http://localhost:3000/dashboard**

Demo data is seeded on first login into `data/platform/*.json`.

## Production setup (Supabase)

1. Create a Supabase project.  
2. Run SQL from `supabase/migrations/001_platform_schema.sql` in the SQL Editor.  
3. Enable Email auth in Authentication → Providers.  
4. Set environment variables (see `.env.example`).  
5. Register at `/auth/register` — trigger creates org + profile.  
6. Optional: run `supabase/seed.sql` or use demo content as reference.
7. Set `SUPABASE_SERVICE_ROLE_KEY` (server-only) for public live chat at `/embed` and `/agent`.
8. Create an agent in the dashboard, copy its id to `NEXT_PUBLIC_PLATFORM_AGENT_ID` in `.env.local`, restart dev.

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | For Supabase auth | Omit for demo mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For Supabase auth | Public, RLS-protected |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin scripts only | **Never** in client code |
| `OPENAI_API_KEY` | Agent test chat | Server routes only |
| `PLATFORM_DEMO_EMAIL` | Demo mode | Default admin email |
| `PLATFORM_DEMO_PASSWORD` | Demo mode | Default password |

## Routes

| Path | Description |
|------|-------------|
| `/auth/login` | Platform sign-in |
| `/auth/register` | Sign up (Supabase) |
| `/dashboard` | Executive analytics |
| `/dashboard/agents` | Agent list |
| `/dashboard/agents/new` | Agent builder |
| `/dashboard/agents/[id]` | Agent detail + test chat |
| `/dashboard/knowledge` | Knowledge bases |
| `/dashboard/knowledge/new` | Create KB + entries |
| `/dashboard/leads` | CRM |
| `/dashboard/conversations` | Inbox |
| `/dashboard/bookings` | Calendar |
| `/dashboard/campaigns` | Campaigns |
| `/dashboard/webhooks` | Agent tasks / webhooks |
| `/dashboard/integrations` | Integration cards |
| `/dashboard/analytics` | Charts |
| `/dashboard/team` | Team members |
| `/dashboard/settings` | Company profile |

Legacy routes (`/`, `/agent`, `/embed`, `/admin`) remain for the public website and live chat widget.

## API (server-only)

All platform APIs require an authenticated session (Supabase user or demo cookie). Secrets never reach the browser.

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST/PUT/DELETE | `/api/platform/agents` | Agent CRUD + KB linking |
| POST | `/api/platform/agents/test` | Test chat (system prompt + linked KB → OpenAI/Groq) |
| POST | `/api/platform/workflow` | Full agent workflow turn (intent, scoring, lead sync, handoff) |
| GET/POST/PUT/DELETE | `/api/platform/leads` | Lead CRM |
| GET/POST/PUT/DELETE | `/api/platform/knowledge-bases` | KB + entries (`type: "entry"` for entries) |
| GET/POST/PUT/DELETE | `/api/platform/bookings` | Bookings |
| GET/POST/DELETE | `/api/platform/agent-tasks` | Webhook tasks |
| POST | `/api/platform/agent-tasks/test` | Fire test webhook |
| GET/PATCH | `/api/platform/integrations` | Integration status (no secrets stored in UI) |
| PATCH | `/api/platform/conversations/[id]` | Conversation status / assignment |
| PUT | `/api/platform/organization` | Org settings |
| POST | `/api/auth/demo-login` | Demo mode sign-in |
| POST | `/api/auth/signout` | Sign out (Supabase + demo cookie) |

## What needs real credentials

- **OpenAI** — agent test chat and live `/api/chat`  
- **WhatsApp / Twilio** — existing webhook routes  
- **Google Calendar, HubSpot, Slack** — integration cards are UI + config placeholders  
- **CRM webhook** — `CRM_WEBHOOK_URL` (existing)  

## Database schema

See `supabase/migrations/001_platform_schema.sql` for full PostgreSQL tables: `organizations`, `profiles`, `agents`, `knowledge_bases`, `knowledge_entries`, `leads`, `conversations`, `messages`, `bookings`, `campaigns`, `agent_tasks`, `integrations`, `notifications`.
