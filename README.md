# Digital Ready Ghana / DigiSales.ai — 24/7 AI Sales & Support Agent

Production-ready AI agent with the full prompt playbook: greetings, discovery, NBAT lead scoring, objections, booking, support, handoff, follow-up, CRM summaries, and channel-specific rules (website, WhatsApp, voice).

**Connection guide:** see [docs/CONNECT.md](docs/CONNECT.md) for step-by-step wiring to CRM, calendar, WhatsApp, Twilio, and analytics.

## Features

- **Full prompt playbook** in `lib/agent/prompts/modules.ts`
- **NBAT lead scoring** via `score_lead` (0–12 → Cold / Warm / Hot)
- **Agent roles**: `unified`, `support`, `sales`, `appointment`, `crm`
- **Tools**: `save_lead`, `score_lead`, `save_crm_summary`, `book_appointment`, `check_calendar_slots`, `schedule_follow_up`, `escalate_to_human`, `update_crm`
- **Knowledge base**: edit `knowledge/company-knowledge.md` (no invented pricing)
- **CRM webhook**, Slack/email escalation, follow-up webhook
- **WhatsApp webhook** (`/api/whatsapp/webhook`)
- **Twilio voice webhook** (`/api/twilio/voice`)
- **Analytics dashboard** (`/admin`)
- **Embeddable widget** + full-page demo

## Quick start

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the demo, or [http://localhost:3000/embed](http://localhost:3000/embed) for embed-only view.

## Environment

See `.env.example`. Minimum: `OPENAI_API_KEY`.

## Customize the agent

1. **Knowledge** — Update `knowledge/company-knowledge.md` with approved services, pricing, FAQs, and social proof.
2. **Brand** — Adjust `lib/config.ts` (name, booking URL, escalation email).
3. **Playbook** — Refine `lib/agent/system-prompt.ts` if you need extra rules (keep compliance section).

## Embed on your website

**Floating widget** (built-in): deploy the app and visitors use the launcher on `/` or import the React `ChatWidget` in your site.

**iframe embed** (any site):

```html
<script src="https://YOUR-DOMAIN.com/embed.js" data-base="https://YOUR-DOMAIN.com" async></script>
```

## CRM integration

Set `CRM_WEBHOOK_URL`. Each lead upsert sends:

```json
{
  "event": "lead.upsert",
  "lead": { "id", "status", "email", "fullName", ... }
}
```

Wire to HubSpot, Salesforce, Pipedrive, or Zapier.

## Admin: list leads

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_SECRET" http://localhost:3000/api/leads
```

Leads are stored in memory by default — replace `lib/store.ts` with Postgres/Redis for production persistence.

## Deploy

Deploy to Vercel, Render, or any Node host. Set environment variables in the dashboard.
