import type { AgentType } from "./types";
import {
  DEFAULT_BOOKING_RULES_PLACEHOLDER,
  DEFAULT_CRM_RULES_PLACEHOLDER,
  DEFAULT_HANDOFF_RULES_PLACEHOLDER,
  DEFAULT_QUALIFICATION_PLACEHOLDER,
} from "./sales-ops";
import {
  buildSystemPrompt,
  buildWelcomeVariants,
  SALES_OPENING_STYLES,
} from "./sales-conversation-openers";
import { MULTILINGUAL_SYSTEM_NOTE } from "./languages";

export type AgentDraftFromPrompt = {
  name: string;
  company_product_name: string;
  agent_type: AgentType;
  position: string;
  language: string;
  welcome_message: string;
  system_prompt: string;
  qualification_prompt: string;
  objection_prompt: string;
  handoff_rules: string;
  booking_rules: string;
  crm_update_rules: string;
  channels: string[];
  suggested_kb_topics: string[];
};

type Vertical = "pizza" | "travel" | "b2b" | "generic";

function detectVertical(text: string): Vertical {
  const t = text.toLowerCase();
  if (/pizza|restaurant|takeaway|food delivery|fast food/.test(t)) return "pizza";
  if (
    /travel|luxury|island|resort|concierge|visa|itinerary|premium trip/.test(t)
  )
    return "travel";
  if (/b2b|saas|enterprise|sales team|outbound|prospect/.test(t)) return "b2b";
  return "generic";
}

function extractBusinessName(description: string): string {
  const quoted = description.match(/["']([^"']+)["']/);
  if (quoted?.[1]) return quoted[1].slice(0, 80);
  const forMatch = description.match(/\bfor\s+(?:a\s+)?([A-Za-z0-9][A-Za-z0-9\s&'-]{2,40})/i);
  if (forMatch?.[1]) return forMatch[1].trim();
  return "Your business";
}

export function buildAgentDraftFromPrompt(
  description: string,
  organizationName: string
): AgentDraftFromPrompt {
  const vertical = detectVertical(description);
  const business = extractBusinessName(description);
  const company = organizationName || business;

  const baseSystem = `${buildSystemPrompt(company, business)}\n\n${MULTILINGUAL_SYSTEM_NOTE}`;

  if (vertical === "pizza") {
    return {
      name: `${business} Phone Agent`,
      company_product_name: business,
      agent_type: "sales",
      position: "Order & catering specialist",
      language: "en",
      welcome_message: SALES_OPENING_STYLES[0].example.replace(
        "reach out",
        "call"
      ),
      system_prompt: `${baseSystem}

You handle incoming calls and chat for a pizza shop:
- Menu questions from the knowledge base only (sizes, toppings, hours, delivery zones).
- Take orders by confirming items, quantity, address, and contact number.
- Upsell politely (sides, drinks) without inventing prices.
- Escalate catering or large orders to staff.`,
      qualification_prompt:
        "Confirm order type (pickup/delivery), location, party size, and timing.",
      objection_prompt:
        "Acknowledge wait-time or price concerns; offer alternatives from KB; never promise discounts not documented.",
      handoff_rules: DEFAULT_HANDOFF_RULES_PLACEHOLDER,
      booking_rules:
        "For catering or events, collect date, headcount, and phone — then hand off to staff.",
      crm_update_rules: DEFAULT_CRM_RULES_PLACEHOLDER,
      channels: ["phone", "website", "whatsapp"],
      suggested_kb_topics: [
        "Menu & pricing",
        "Delivery zones & hours",
        "Catering policy",
        "Brand voice",
      ],
    };
  }

  if (vertical === "travel") {
    return {
      name: `${business} Concierge Agent`,
      company_product_name: business,
      agent_type: "sales",
      position: "Luxury travel consultant",
      language: "en",
      welcome_message: buildWelcomeVariants(company).split("\n\n---\n\n")[0]!,
      system_prompt: `${baseSystem}

Luxury & exclusive travel specialist:
- Explain documentation requirements for exclusive destinations (private islands, remote regions) using KB only.
- Track that regulations change — advise verifying with human specialists before final booking.
- Suggest premium travel insurance when appropriate (per KB, not invented coverage).
- Coordinate premium services globally via handoff — never confirm unavailable services.`,
      qualification_prompt:
        "Discover destination, dates, party size, budget tier, and special requirements (visas, medical, accessibility).",
      objection_prompt:
        "Handle timing and budget objections with tiered options; no guaranteed availability without staff confirmation.",
      handoff_rules: `${DEFAULT_HANDOFF_RULES_PLACEHOLDER}\n- Custom itineraries, private islands, or regulatory edge cases always escalate.`,
      booking_rules: DEFAULT_BOOKING_RULES_PLACEHOLDER,
      crm_update_rules: DEFAULT_CRM_RULES_PLACEHOLDER,
      channels: ["website", "phone", "email", "whatsapp"],
      suggested_kb_topics: [
        "Destination documentation",
        "Regulatory updates",
        "Premium insurance",
        "Brand guidelines",
        "FAQ",
      ],
    };
  }

  const agentType: AgentType = vertical === "b2b" ? "sales" : "sales";
  return {
    name: `${business} AI SDR`,
    company_product_name: business,
    agent_type: agentType,
    position: "AI Sales Development Representative",
    language: "en",
    welcome_message: buildWelcomeVariants(company).split("\n\n---\n\n")[0]!,
    system_prompt: `${baseSystem}

Conduct discovery calls, deliver screen-share demos when invited, answer product questions from KB, and chat in multiple languages.
Qualify B2B leads, book meetings, and sync outcomes to CRM.`,
    qualification_prompt: DEFAULT_QUALIFICATION_PLACEHOLDER,
    objection_prompt:
      "Address ROI, timing, and competitor questions using approved collateral only.",
    handoff_rules: DEFAULT_HANDOFF_RULES_PLACEHOLDER,
    booking_rules: DEFAULT_BOOKING_RULES_PLACEHOLDER,
    crm_update_rules: DEFAULT_CRM_RULES_PLACEHOLDER,
    channels: ["website", "phone", "email", "whatsapp"],
    suggested_kb_topics: [
      "Product collateral",
      "FAQ",
      "Brand guidelines",
      "Objection handling",
    ],
  };
}
