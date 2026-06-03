# HubSpot field mapping — Digital Ready / ReadyBot

This document describes how platform leads sync to HubSpot when `CRM_WEBHOOK_FORMAT=hubspot` and `CRM_WEBHOOK_URL` points at your ingestion endpoint (private app workflow, Zapier, Make, or custom receiver).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CRM_WEBHOOK_URL` | POST target when a lead is upserted from chat/workflow |
| `CRM_WEBHOOK_FORMAT` | `generic` (default) or `hubspot` |
| `HUBSPOT_WEBHOOK_SECRET` | Optional shared secret sent as `X-Webhook-Secret` for your receiver to verify |
| `HUBSPOT_PROPERTY_*` | Override internal property names (see below) |

Example (`.env.local`):

```env
CRM_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxx/yyyy/
CRM_WEBHOOK_FORMAT=hubspot
HUBSPOT_WEBHOOK_SECRET=your-random-secret
```

## Payload shape (`hubspot` format)

The app POSTs JSON produced by `leadToHubSpotWebhookPayload()`:

```json
{
  "subscriptionType": "contact.upsert",
  "objectId": null,
  "platformLeadId": "lead-uuid",
  "occurredAt": "2026-06-01T12:00:00.000Z",
  "properties": {
    "firstname": "Kwame",
    "lastname": "Mensah",
    "email": "kwame@example.com",
    "phone": "+233241112233",
    "company": "Acme Ghana",
    "dr_lead_intent": "Scale paid ads in Accra",
    "dr_current_stack": "Meta only, no CRM",
    "dr_budget_tier": "Tier B",
    "dr_timeline": "Within 60 days",
    "dr_team_structure": "In-house + agency support",
    "dr_service_interest": "Paid Ads & Lead Generation",
    "dr_lead_score": 72,
    "dr_lead_category": "warm",
    "dr_lead_status": "working",
    "dr_conversation_summary": "...",
    "dr_next_action": "Send strategy brief",
    "dr_source_channel": "whatsapp",
    "dr_conversation_id": "conv-uuid",
    "dr_conversation_stage": "qualification"
  }
}
```

Empty strings are omitted from `properties`.

## HubSpot contact properties to create

Create these **contact** properties in HubSpot (Settings → Properties → Contact). Internal names match defaults; use **Single-line text** unless noted.

| HubSpot internal name | Label | Source |
|----------------------|-------|--------|
| `dr_lead_intent` | DR Lead intent | Growth milestone / primary goal |
| `dr_current_stack` | DR Current stack | Ads, analytics, CRM state |
| `dr_budget_tier` | DR Budget tier | Tier A / B / C from qualification |
| `dr_timeline` | DR Timeline | Kick-off urgency |
| `dr_team_structure` | DR Team model | In-house vs full agency |
| `dr_service_interest` | DR Service interest | Pillar mapping |
| `dr_lead_score` | DR Lead score | Number (0–100) |
| `dr_lead_category` | DR Lead category | hot / warm / cold |
| `dr_lead_status` | DR Lead status | Pipeline status |
| `dr_conversation_summary` | DR Conversation summary | Multi-line text |
| `dr_next_action` | DR Next action | Recommended sales step |
| `dr_source_channel` | DR Source channel | website, whatsapp, etc. |
| `dr_conversation_id` | DR Conversation ID | Platform conversation UUID |
| `dr_conversation_stage` | DR Conversation stage | greeting, discovery, qualification, … |

Standard HubSpot fields used: `firstname`, `lastname`, `email`, `phone`, `company`.

### Property name overrides

If your portal already uses different internal names:

```env
HUBSPOT_PROPERTY_LEAD_INTENT=custom_growth_goal
HUBSPOT_PROPERTY_BUDGET_TIER=custom_budget_band
```

## Zapier / Make mapping

1. **Trigger:** Webhooks by Zapier / Custom webhook (catch POST).
2. **Verify:** Optional — filter on header `X-Webhook-Secret` equals `HUBSPOT_WEBHOOK_SECRET`.
3. **Action:** HubSpot — Create or update contact.
4. Map each key under `properties` to the matching HubSpot property.
5. **Dedupe:** Use `email` or `phone` as the unique key; store `platformLeadId` in a custom property for idempotent updates.

## HubSpot workflow (native)

If you use a private app or custom code action instead of Zapier:

1. Expose an HTTPS endpoint that accepts the payload above.
2. Call HubSpot CRM API `POST /crm/v3/objects/contacts` with `properties`, or search-by-email then `PATCH`.
3. Trigger internal notifications when `dr_lead_category` is `hot` or `dr_conversation_stage` is `booking`.

## Generic format (fallback)

When `CRM_WEBHOOK_FORMAT` is unset or `generic`, the body includes the full `lead` object plus `customFields` (same semantic fields). Use this for non-HubSpot CRMs.

## Code references

- Property map: `lib/integrations/hubspot/property-map.ts`
- Transformer: `lib/integrations/hubspot/transform-lead.ts`
- Dispatch: `lib/integrations/crm/dispatch-lead-webhook.ts`
- Trigger: `lib/platform/workflow/lead-sync.ts` (after each workflow lead upsert)
