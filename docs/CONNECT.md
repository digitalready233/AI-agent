# How To Connect Everything — Digital Ready Ghana AI Agent

This guide maps your **prompt playbook** to **real integrations** in this project.

## Architecture

```
Customer (Website / WhatsApp / Phone)
        ↓
   Webhook or Chat API
        ↓
   /api/chat  |  /api/whatsapp/webhook  |  /api/twilio/voice
        ↓
   AI Agent (prompts + tools)
        ↓
┌───────┴───────┬───────────┬────────────┐
Knowledge Base  CRM      Calendar    Notifications
```

## 0. OpenAI Hosted Prompt (recommended if you use OpenAI Prompts UI)

If you created a **Prompt** in the [OpenAI dashboard](https://platform.openai.com/prompts) (`pmpt_…`) and added your company info there:

**In `.env.local`:**

```env
OPENAI_PROMPT_ID=pmpt_your_prompt_id_here
OPENAI_PROMPT_VERSION=1
OPENAI_PROMPT_MERGE_LOCAL_KB=true
```

**What happens:** When someone asks a question on the website, the app calls OpenAI’s **Responses API** with your **prompt ID**. Answers come from the knowledge/instructions you saved in OpenAI — not from scraping the web.

| Setting | Effect |
|---------|--------|
| `OPENAI_PROMPT_ID` set | Use hosted OpenAI prompt for answers |
| `OPENAI_PROMPT_ID` empty | Use local `lib/agent/prompts` + `knowledge/company-knowledge.md` + CRM tools |
| `OPENAI_PROMPT_MERGE_LOCAL_KB=true` | Also attach `company-knowledge.md` as extra context |

**Note:** Lead tools (`save_lead`, `book_appointment`, etc.) work fully in **local mode**. In **hosted prompt mode**, answers use OpenAI’s prompt; add lead-capture instructions inside your OpenAI prompt, or clear `OPENAI_PROMPT_ID` to use local tools.

Restart after changing env: `npm run dev`

## 1. Knowledge Base

**In this project:** `knowledge/company-knowledge.md` (loaded at runtime when not using hosted prompt only)

**To upgrade:** Add vector search (Supabase pgvector, Pinecone) and a `search_knowledge_base` tool.

**Rule:** If the answer is not in the KB, the agent says: *"I do not want to give you the wrong information. Let me connect you with the team for accurate assistance."*

## 2. CRM

**Env:** `CRM_WEBHOOK_URL`

**Flow:** `save_lead`, `score_lead`, `save_crm_summary` → POST JSON to your webhook.

**Wire to:** HubSpot (Zapier), Zoho, Airtable, or custom API.

**Optional:** `HUBSPOT_ACCESS_TOKEN` — extend `lib/integrations/crm.ts` for direct HubSpot API.

### Zoho CRM (important distinction)

The Zoho URL [Create Webhook API](https://www.zoho.com/crm/developer/docs/api/v8/create-webhook.html) (`POST https://www.zohoapis.com/crm/v8/settings/automation/webhooks`) is **not** where you paste `CRM_WEBHOOK_URL`.

That API **creates webhooks inside Zoho**: when something happens **in Zoho** (e.g. a Lead is created or updated), Zoho **sends** HTTP requests **to your external URL**. It is **Zoho → outside world**, and it requires a **Zoho OAuth** token with scope such as `ZohoCRM.settings.automation_actions.CREATE`.

**This app sends leads the other way:** **AI app → your URL** (`CRM_WEBHOOK_URL`) with a JSON body like:

```json
{
  "event": "lead.upsert",
  "lead": {
    "id": "...",
    "fullName": "...",
    "email": "...",
    "phone": "...",
    "businessName": "...",
    "status": "Hot",
    "leadScore": 10,
    "leadCategory": "Hot Lead",
    "conversationSummary": "...",
    "serviceNeeded": "...",
    "nbat": { "need": 3, "budget": 2, "authority": 2, "timeline": 3 }
  }
}
```

**Recommended ways to get that into Zoho:**

1. **Zoho Flow (or Make / Zapier)** — Create a scenario with a **Custom Webhook** (or “Catch Hook”) as the first step; copy that URL into `CRM_WEBHOOK_URL`. Next step: **Zoho CRM → Create/Update Lead** and map fields from the incoming JSON.
2. **Direct Zoho CRM API** — Add server-side code that calls `POST https://www.zohoapis.com/crm/v8/Leads` (or `upsert`) using **OAuth 2.0** refresh token. That replaces or supplements `CRM_WEBHOOK_URL`; we can add a `Zoho` branch in `lib/integrations/crm.ts` if you want this in-repo.

**When to use Zoho’s “automation webhooks” API:** when you need Zoho to **notify another system** after CRM changes (e.g. sync to a data warehouse or internal app). That is separate from ingesting AI chat leads unless you build a **round-trip** (e.g. Flow receives from app, creates Lead in Zoho, then another Zoho workflow fires a different webhook).

Official reference: [Zoho CRM API v8 — Create Webhook](https://www.zoho.com/crm/developer/docs/api/v8/create-webhook.html).

## 3. Calendar

**Env:** `NEXT_PUBLIC_BOOKING_URL` (Calendly/Cal.com link)

**Advanced:** `GOOGLE_CALENDAR_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON` → `check_calendar_slots` + `book_appointment` use Google Calendar API (stub ready in `lib/integrations/google-calendar.ts`).

## 4. Website Chat

**Already built:** `components/ChatWidget.tsx` → `POST /api/chat`

**Embed:**

```html
<script src="https://YOUR-DOMAIN.com/embed.js" data-base="https://YOUR-DOMAIN.com" async></script>
```

**Agent roles** (optional body field `role`):

| Role | Use |
|------|-----|
| `unified` | Default — sales + support + booking |
| `support` | Customer service focus |
| `sales` | Qualification & closing |
| `appointment` | Booking focus |
| `crm` | Summary capture |

## 5. WhatsApp

**Env:**

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

**Webhook URL (Meta Developer Console):**

`https://YOUR-DOMAIN.com/api/whatsapp/webhook`

**Flow:** Incoming message → AI reply → `sendWhatsAppText` back to customer.

**Compliance:** Use WhatsApp Business Platform (Cloud API), not personal WhatsApp app automation.

## 6. Phone (Twilio Voice)

**Env:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

**Voice webhook:** `https://YOUR-DOMAIN.com/api/twilio/voice`

**Production upgrade:** Twilio **ConversationRelay** for real-time AI voice (see Twilio plugin skills).

## 7. Human Handoff

**Env:** `ESCALATION_SLACK_WEBHOOK`, `ESCALATION_EMAIL_WEBHOOK`, `ESCALATION_EMAIL`

**Tool:** `escalate_to_human` — includes summary, urgency, recommended action.

## 8. Follow-Up Automation

**Env:** `FOLLOWUP_WEBHOOK_URL`

**Tool:** `schedule_follow_up` — connect to n8n, Make.com, or CRM workflow.

**Suggested timing:**

- Hot lead: within 1 hour
- Warm: within 24 hours
- Cold: 3–7 days

## 9. Analytics Dashboard

**URL:** `/admin`  
**API:** `GET /api/analytics` (optional `Authorization: Bearer ADMIN_API_SECRET`)

Tracks: conversations, leads, hot/warm/cold, bookings, escalations, follow-ups.

**Production:** Persist events in PostgreSQL instead of in-memory `lib/analytics.ts`.

## 10. Four Connected Agents

Implemented as **roles** on the same backend (can split into separate deployments later):

| Agent | Role param | Focus |
|-------|------------|--------|
| Customer Service | `support` | Support prompt + escalation |
| Sales Closer | `sales` | Discovery, NBAT scoring, objections, closing |
| Appointment | `appointment` | Booking + calendar slots |
| CRM Summary | `crm` | `save_crm_summary` + minimal chat |

Example:

```json
POST /api/chat
{ "sessionId": "...", "channel": "website", "role": "sales", "messages": [...] }
```

## 11. Lead Scoring (NBAT)

**Tool:** `score_lead` with need, budget, authority, timeline (0–3 each).

| Total | Category | Action |
|-------|----------|--------|
| 0–3 | Cold | Nurture |
| 4–7 | Warm | Educate + follow-up |
| 8–12 | Hot | Book or hand off to human |

## 12. Recommended Build Order

1. ✅ Website chat + knowledge base + lead capture  
2. Set `CRM_WEBHOOK_URL` + test HubSpot/Zapier  
3. WhatsApp webhook + Meta verification  
4. Calendar (booking URL or Google Calendar)  
5. Slack/email escalation  
6. Follow-up automation  
7. Analytics persistence  
8. Twilio voice (ConversationRelay)

## 13. Environment Checklist

Copy `.env.example` → `.env.local` and fill:

- `OPENAI_API_KEY` (required)
- `NEXT_PUBLIC_COMPANY_NAME=Digital Ready Ghana`
- `NEXT_PUBLIC_BOOKING_URL`
- `CRM_WEBHOOK_URL`
- `ESCALATION_SLACK_WEBHOOK`
- WhatsApp + Twilio vars when ready

## 14. No-Code Fast Path

If you want MVP without more code:

1. Deploy this app to Vercel  
2. WhatsApp → Make.com → `POST /api/chat` (custom wrapper) or use built-in webhook  
3. CRM → Zapier catches `CRM_WEBHOOK_URL`  
4. Dashboard → Google Sheets via Zapier from same webhook  
5. Follow-up → Make.com scheduled scenario  

The **custom app path** (this repo) gives you full control, branding, and the complete prompt playbook.
