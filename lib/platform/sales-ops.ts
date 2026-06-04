import type { AgentType, LeadCategory, LeadStatus } from "./types";
import { WORKFLOW_STAGES } from "./workflow/schemas";

/** Product positioning — sales operations first, support retained */
export const PLATFORM_PRODUCT_NAME = "AI Sales Agent Operations";
export const PLATFORM_TAGLINE =
  "Deploy AI sales agents, qualify leads, book meetings, and hand off to your team.";

import type { AgentOperationalRole } from "@/lib/demo/multi-agent/types";
import { OPERATIONAL_ROLE_LABELS } from "@/lib/demo/multi-agent/types";

export const AGENT_OPERATIONAL_ROLE_OPTIONS: {
  value: AgentOperationalRole;
  label: string;
}[] = (
  Object.entries(OPERATIONAL_ROLE_LABELS) as [AgentOperationalRole, string][]
).map(([value, label]) => ({ value, label }));

export const AGENT_TYPE_OPTIONS: { value: AgentType; label: string; description: string }[] = [
  { value: "sales", label: "Sales Agent", description: "Primary — qualify, recommend, and close" },
  { value: "booking", label: "Booking Agent", description: "Push demos and consultation bookings" },
  { value: "demo", label: "Demo Agent", description: "Product demos and discovery calls" },
  { value: "support", label: "Support Agent", description: "Customer support (secondary)" },
  { value: "onboarding", label: "Onboarding Agent", description: "New customer onboarding" },
];

export const LEAD_CATEGORY_LABELS: Record<LeadCategory, string> = {
  hot: "Hot Lead",
  warm: "Warm Lead",
  cold: "Cold Lead",
  support: "Support Request",
  not_qualified: "Not Qualified",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  created: "Created",
  open: "Open",
  working: "Working",
  qualified: "Qualified",
  disqualified: "Disqualified",
  opportunity_created: "Opportunity Created",
  opportunity_lost: "Opportunity Lost",
  customer: "Customer",
};

export const CONVERSATION_STAGE_LABELS: Record<(typeof WORKFLOW_STAGES)[number], string> = {
  greeting: "Onboarding",
  discovery: "Discovery",
  qualification: "Stack / team / budget",
  recommendation: "Recommendation",
  objection_handling: "Objection handling",
  booking: "Booking",
  handoff: "Handoff",
  close: "Close",
};

/** Legacy stage values stored before workflow stage rename. */
export const LEGACY_STAGE_LABELS: Record<string, string> = {
  new_visitor: "New visitor",
  human_handoff: "Handoff",
  follow_up: "Follow-up",
  closed: "Close",
};

export const BANT_DIMENSIONS = [
  { key: "need", label: "Need" },
  { key: "budget", label: "Budget" },
  { key: "authority", label: "Authority" },
  { key: "timeline", label: "Timeline" },
] as const;

export const HANDOFF_TRIGGERS = [
  "Lead is hot (high BANT score)",
  "Customer asks for a human",
  "Customer is ready to buy",
  "Custom pricing requested",
  "Serious objection raised",
  "Customer complaint",
  "AI confidence is low",
] as const;

export const DEFAULT_HANDOFF_RULES_PLACEHOLDER = `Escalate to a human when:
- Lead is hot or ready to buy
- Customer asks for a person or custom pricing
- Serious objection you cannot resolve in one turn
- Complaint or support issue outside sales scope
- You are unsure (low confidence)`;

export const DEFAULT_QUALIFICATION_PLACEHOLDER = `Qualify using Need, Budget, Authority, Timeline (BANT).
Ask about business goals, budget range, who decides, and when they want to start.
Move to booking when qualified and interest is warm or hot.`;

export const DEFAULT_BOOKING_RULES_PLACEHOLDER = `Offer consultation, demo, or sales call when qualified.
Confirm preferred date/time and collect email or phone for calendar invite.
Do not invent availability — suggest the customer pick a slot or hand off to staff.`;

export const DEFAULT_CRM_RULES_PLACEHOLDER = `After each meaningful turn, update:
- Lead score and category (hot / warm / cold)
- Service interest, budget, timeline
- Conversation summary and recommended next action
- Follow-up date when appropriate`;

export function formatLeadCategory(category: string | null | undefined): string {
  if (!category) return "—";
  const key = category.toLowerCase().replace(/\s+/g, "_") as LeadCategory;
  return LEAD_CATEGORY_LABELS[key] ?? category.replace(/_/g, " ");
}

export function formatLeadStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const key = status as LeadStatus;
  return LEAD_STATUS_LABELS[key] ?? status.replace(/_/g, " ");
}

export function agentTypeLabel(type: AgentType | string): string {
  return AGENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? String(type);
}
