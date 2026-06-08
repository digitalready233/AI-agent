import {
  WORKFLOW_INTENTS,
  WORKFLOW_STAGES,
  workflowAnalysisSchema,
  type WorkflowAnalysis,
  type WorkflowIntent,
  type WorkflowStage,
} from "./schemas";

const INTENT_SET = new Set<string>(WORKFLOW_INTENTS);
const STAGE_SET = new Set<string>(WORKFLOW_STAGES);

/** Map common LLM mistakes (Groq/OpenAI) → valid intent. */
const INTENT_ALIASES: Record<string, WorkflowIntent> = {
  greeting: "general_enquiry",
  hello: "general_enquiry",
  hi: "general_enquiry",
  introduction: "general_enquiry",
  discovery: "general_enquiry",
  qualification: "sales_enquiry",
  recommendation: "sales_enquiry",
  objection_handling: "sales_enquiry",
  sales: "sales_enquiry",
  sales_inquiry: "sales_enquiry",
  sales_enquiry: "sales_enquiry",
  pricing: "pricing_question",
  price: "pricing_question",
  support: "support_request",
  booking: "booking_request",
  schedule: "booking_request",
  complaint: "complaint",
  human: "human_request",
  handoff: "human_request",
  general: "general_enquiry",
  general_inquiry: "general_enquiry",
};

const STAGE_ALIASES: Record<string, WorkflowStage> = {
  sales_enquiry: "discovery",
  pricing_question: "discovery",
  support_request: "discovery",
  booking_request: "booking",
  complaint: "objection_handling",
  human_request: "handoff",
  general_enquiry: "greeting",
  follow_up: "discovery",
  closed: "close",
  human_handoff: "handoff",
  new_visitor: "greeting",
};

function cleanString(val: unknown): string | undefined {
  if (val == null) return undefined;
  const s = String(val).trim();
  return s.length > 0 ? s : undefined;
}

export function normalizeIntent(raw: unknown): WorkflowIntent {
  const key = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (INTENT_SET.has(key)) return key as WorkflowIntent;
  if (key in INTENT_ALIASES) return INTENT_ALIASES[key]!;
  if (STAGE_SET.has(key)) return "general_enquiry";
  return "general_enquiry";
}

export function normalizeStage(raw: unknown): WorkflowStage {
  const key = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (STAGE_SET.has(key)) return key as WorkflowStage;
  if (key in STAGE_ALIASES) return STAGE_ALIASES[key]!;
  if (INTENT_SET.has(key)) {
    if (key === "booking_request") return "booking";
    if (key === "human_request" || key === "complaint") return "handoff";
    return "discovery";
  }
  return "greeting";
}

function cleanLeadExtraction(raw: unknown): WorkflowAnalysis["lead_extraction"] {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    full_name: cleanString(obj.full_name),
    phone: cleanString(obj.phone),
    email: cleanString(obj.email),
    business_name: cleanString(obj.business_name),
    service_interest: cleanString(obj.service_interest),
    budget: cleanString(obj.budget),
    timeline: cleanString(obj.timeline),
    authority: cleanString(obj.authority),
    objections: cleanString(obj.objections),
    preferred_contact_method: cleanString(obj.preferred_contact_method),
    discovery_goal_focus: cleanString(obj.discovery_goal_focus),
    growth_milestone: cleanString(obj.growth_milestone),
    current_stack: cleanString(obj.current_stack),
    team_structure: cleanString(obj.team_structure),
    budget_tier: cleanString(obj.budget_tier),
  };
}

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 0;
  return Math.min(3, Math.max(0, v));
}

/** Repair raw JSON from models that use wrong enums or empty strings. */
export function normalizeWorkflowAnalysis(raw: unknown): WorkflowAnalysis {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const draft = {
    detected_intent: normalizeIntent(obj.detected_intent),
    conversation_stage: normalizeStage(obj.conversation_stage),
    ai_confidence: Math.min(
      1,
      Math.max(0, Number(obj.ai_confidence) || 0.7)
    ),
    conversation_summary: cleanString(obj.conversation_summary) ?? "Customer message received.",
    recommended_next_action:
      cleanString(obj.recommended_next_action) ?? "Continue the conversation.",
    lead_extraction: cleanLeadExtraction(obj.lead_extraction),
    lead_scores: {
      need: clampScore(
        (obj.lead_scores as Record<string, unknown> | undefined)?.need
      ),
      budget: clampScore(
        (obj.lead_scores as Record<string, unknown> | undefined)?.budget
      ),
      authority: clampScore(
        (obj.lead_scores as Record<string, unknown> | undefined)?.authority
      ),
      timeline: clampScore(
        (obj.lead_scores as Record<string, unknown> | undefined)?.timeline
      ),
    },
    flags: {
      custom_pricing_requested: Boolean(
        (obj.flags as Record<string, unknown> | undefined)?.custom_pricing_requested
      ),
      ready_to_pay: Boolean(
        (obj.flags as Record<string, unknown> | undefined)?.ready_to_pay
      ),
      human_requested: Boolean(
        (obj.flags as Record<string, unknown> | undefined)?.human_requested
      ),
      serious_objection: Boolean(
        (obj.flags as Record<string, unknown> | undefined)?.serious_objection
      ),
      complaint_detected: Boolean(
        (obj.flags as Record<string, unknown> | undefined)?.complaint_detected
      ),
    },
    suggest_booking: Boolean(obj.suggest_booking),
  };

  return workflowAnalysisSchema.parse(draft);
}

export function tryParseAnalysisFromError(err: unknown): WorkflowAnalysis | null {
  const e = err as { text?: string; cause?: { text?: string } };
  const text = e.text ?? (e.cause as { text?: string } | undefined)?.text;
  if (!text?.trim()) return null;
  try {
    const json = JSON.parse(text) as unknown;
    return normalizeWorkflowAnalysis(json);
  } catch {
    return null;
  }
}
