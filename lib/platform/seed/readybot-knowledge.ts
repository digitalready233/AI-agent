import { randomUUID } from "crypto";
import type { KnowledgeEntry } from "@/lib/platform/types";
import { isUuid } from "@/lib/platform/uuid";

type ReadybotArticleDef = {
  /** Stable id for JSON/demo seed only (not valid Postgres uuid). */
  slug: string;
  title: string;
  category: string;
  content: string;
};

const READYBOT_ARTICLES: ReadybotArticleDef[] = [
  {
    slug: "ke-dr-profile",
    title: "Digital Ready Ltd — Company Profile",
    category: "Company Profile",
    content: `Digital Ready Ltd is a premium 360° digital marketing firm based in Adenta, Accra, Ghana.

We help Ghanaian SMEs, mid-market brands, and enterprises grow through:
- Performance advertising (Meta, Google, TikTok)
- Social media management and brand reputation
- Websites, e-commerce, CRM/automation, and full digital strategy

We work with clients across Accra, Kumasi, Tema, and nationwide — retail, FMCG, fintech, real estate, hospitality, professional services, and NGOs.

**Pricing:** All commercial proposals are custom after a strategy consultation. We do not publish fixed rate cards online.`,
  },
  {
    slug: "ke-dr-pricing-policy",
    title: "Pricing & Commercial Policy",
    category: "Pricing",
    content: `Digital Ready does not quote fixed public prices in chat.

**Investment tiers (qualification only — not binding quotes):**
- **Tier A — SME / Emerging Brand:** Typically under ~GHS 5,000/month in marketing spend or project budget (e.g. single-channel social, starter ads, landing page).
- **Tier B — Growing Mid-Market:** Roughly GHS 5,000–20,000/month (multi-channel campaigns, ongoing social + ads, website improvements).
- **Tier C — Corporate / Enterprise:** GHS 20,000+/month (full-funnel, multiple markets, transformation programmes).

A **lead strategist** prepares the formal proposal after discovery. Mention MoMo-friendly payment plans only if confirmed in the signed proposal.`,
  },
  {
    slug: "ke-dr-pillar-1-ads",
    title: "Pillar 1 — Paid Ads & Lead Generation",
    category: "Service Pillars",
    content: `**Paid Ads & Lead Generation** (Meta, Google, TikTok, performance marketing)

**Best for:** Businesses that need leads, sales, or app installs — not just likes.

**What we deliver:**
- Campaign strategy aligned to Ghana buying behaviour (mobile-first, MoMo, peak seasons: Detty December, Easter, Back-to-school)
- Meta & Instagram ads for retail, services, and events in Accra/Kumasi
- Google Search & Performance Max for high-intent queries ("plumber Accra", "loan app Ghana")
- TikTok for youth brands, food, fashion, and entertainment
- Landing pages, lead forms, WhatsApp click-to-chat, and CRM handoff
- Weekly optimisation, creative testing, and cost-per-lead reporting

**Ghana examples:**
- A Tema furniture shop scaling Meta leads from GHS 45 to GHS 28 CPL in 6 weeks
- A Kumasi clinic using Google Search for appointment bookings
- An Accra fintech testing TikTok + Instagram for app installs

**Discovery questions:** Are you already running ads, or starting fresh? What is your target CPA or monthly lead volume?`,
  },
  {
    slug: "ke-dr-pillar-2-social",
    title: "Pillar 2 — Social Media Management & Branding",
    category: "Service Pillars",
    content: `**Social Media Management & Branding**

**Best for:** Brands that need consistent presence, reputation, and conversion from social — not random posting.

**What we deliver:**
- Content strategy and monthly calendars (English + Twi copy when needed)
- Design, short-form video, and community management
- Social listening and review response (especially Facebook & Instagram in Ghana)
- Influencer coordination for local campaigns
- Brand guidelines, profile optimisation, and campaign launches

**Ghana examples:**
- An Accra restaurant group growing Instagram engagement 3× while pushing reservations via DM
- A Ghanaian skincare brand building trust with UGC and founder-led Reels
- A professional services firm repositioning LinkedIn for B2B leads

**Discovery questions:** Is the pain **reach** (not enough eyeballs) or **conversion** (followers don't buy)? Which platforms matter most — Instagram, Facebook, TikTok, LinkedIn?`,
  },
  {
    slug: "ke-dr-pillar-3-transform",
    title: "Pillar 3 — Full-Scale Digital Transformation",
    category: "Service Pillars",
    content: `**Full-Scale Digital Transformation**

**Best for:** Businesses ready to rebuild or unify web, data, automation, and marketing under one strategy.

**What we deliver:**
- Business websites and e-commerce (Paystack/Flutterwave integrations common in Ghana)
- CRM setup (HubSpot, Zoho, or lightweight pipelines) and WhatsApp Business API flows
- Marketing automation, email/SMS hooks, and analytics (GA4, Meta Pixel, conversion APIs)
- SEO and local search (Google Business Profile for Accra locations)
- Roadmaps for in-house teams vs full agency management

**Ghana examples:**
- A logistics SME replacing WhatsApp-only orders with a site + automated status updates
- A real estate developer launching a lead portal with agent assignment rules
- A manufacturing brand connecting ERP exports to marketing dashboards

**Discovery questions:** Do you have Google Analytics, a CRM, or are we building the foundation? Timeline for go-live?`,
  },
  {
    slug: "ke-dr-objections",
    title: "Objection Handling — Ghana Market",
    category: "Objection Handling",
    content: `**Too expensive:** Focus on cost per lead/sale vs vanity metrics. Offer phased rollout (e.g. one channel first). Propose strategy call — no obligation quote.

**We tried ads before / burned budget:** Audit previous account structure, creative, and landing experience. Ghana traffic is cheap; poor conversion is often offer, page speed, or follow-up — not "ads don't work."

**We only use WhatsApp:** Position WhatsApp Business API + ads driving into WhatsApp as our specialty.

**Need results fast:** Clarify realistic ramp (7–14 days learning phase on Meta). Quick wins possible with retargeting and existing customer lists.`,
  },
  {
    slug: "ke-dr-handoff",
    title: "When to Escalate to Human",
    category: "Operations",
    content: `Escalate to a human strategist when:
- Custom enterprise scope (Tier C) or RFP
- Legal, refund, or complaint
- Pricing pressure requiring approved commercial authority
- Technical integration beyond KB (custom API, ERP)
- Customer requests a named consultant or visit to Adenta office`,
  },
  {
    slug: "ke-premium-travel-docs",
    title: "Premium Travel — Documentation Requirements",
    category: "FAQ",
    content: `For exclusive destinations (private islands, yacht charters, ultra-luxury lodges):

**Always confirm from the guest's passport nationality:**
- Passport validity (typically 6+ months beyond return)
- Visa requirements and e-visa portals — never guess; cite the destination article or escalate
- Yellow fever / health certificates where applicable
- Travel insurance minimums for high-value trips

**Private island & charter specifics:**
- Some islands require letter of invitation or resort confirmation
- Marine permits for certain yacht routes
- Customs pre-clearance for helicopters or private jets

If regulations changed recently, say you will verify with operations — do not invent requirements.`,
  },
  {
    slug: "ke-premium-travel-insurance",
    title: "Premium Travel — Insurance & Concierge",
    category: "Product Collateral",
    content: `Recommend **comprehensive premium travel insurance** for:
- Trip cancellation / interruption on high-value bookings
- Medical evacuation from remote or island locations
- Baggage and equipment for adventure or yacht segments

**Concierge coordination (global partners):**
- Ground transfers, VIP fast-track, private chefs, security details
- Coordinate with approved premium service providers only — escalate bespoke requests

Never quote insurance premiums in chat; explain coverage categories and offer human concierge for binding quotes.`,
  },
  {
    slug: "ke-brand-voice",
    title: "Brand Guidelines — Sales Agent Voice",
    category: "Brand Guidelines",
    content: `**Voice:** Consultative, confident, never pushy. Short sentences on mobile.

**Never:**
- Invent pricing, discounts, or availability
- Promise outcomes we cannot verify in the knowledge base
- Use high-pressure urgency ("last chance today only") unless approved in campaign copy

**Always:**
- One clear question at a time during discovery
- Mirror the prospect's language when multilingual is enabled
- Offer human handoff when legal, medical, or binding commercial terms arise`,
  },
];

/**
 * Digital Ready Ltd — ReadyBot knowledge seed (3 pillars + Ghana context).
 * Import into the org master KB via seed or dashboard.
 *
 * Pass `matchExistingByTitle` when upserting into Supabase so ids are UUIDs
 * and re-seeds update the same rows by title.
 */
export function buildReadybotKnowledgeEntries(
  params: {
    knowledgeBaseId: string;
    organizationId: string;
    now: string;
  },
  options?: { matchExistingByTitle?: KnowledgeEntry[] }
): KnowledgeEntry[] {
  const { knowledgeBaseId, organizationId, now } = params;
  const base = {
    knowledge_base_id: knowledgeBaseId,
    organization_id: organizationId,
    status: "active" as const,
    created_at: now,
    updated_at: now,
  };

  const existingByTitle = options?.matchExistingByTitle
    ? new Map(
        options.matchExistingByTitle.map((e) => [e.title.trim(), e] as const)
      )
    : null;

  return READYBOT_ARTICLES.map((article) => {
    const prior = existingByTitle?.get(article.title.trim());
    const priorId =
      prior?.id && isUuid(prior.id) ? prior.id : undefined;
    const id = priorId ?? (existingByTitle ? randomUUID() : article.slug);

    return {
      ...base,
      id,
      title: article.title,
      category: article.category,
      content: article.content,
      created_at: prior?.created_at ?? now,
    };
  });
}
