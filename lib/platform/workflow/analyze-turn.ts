import { workflowAnalysisSchema, type WorkflowAnalysis } from "./schemas";
import { workflowGenerateObject } from "./llm-invoke";
import type { WorkflowRuntimeContext } from "./workflow-context";
import { isReadybotStyleAgent } from "./readybot-stage-directives";
import { READYBOT_ANALYZER_STAGE_RULES } from "./readybot-stage-engine";

function formatHistory(
  messages: { role: "user" | "assistant"; content: string }[],
  maxTurns = 16
): string {
  return messages
    .slice(-maxTurns)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

export async function analyzeWorkflowTurn(params: {
  ctx: WorkflowRuntimeContext;
  customerMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  knowledgeContext: string;
  customerMetadata?: {
    name?: string;
    email?: string;
    phone?: string;
    businessName?: string;
    serviceInterest?: string;
    budget?: string;
    timeline?: string;
  };
}): Promise<WorkflowAnalysis> {
  const { ctx, customerMessage, history, knowledgeContext, customerMetadata } = params;
  const { agent, effective, settings } = ctx;
  const scoring = settings.lead_scoring;

  const metaLines = customerMetadata
    ? Object.entries(customerMetadata)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  const ctxHistory = formatHistory(history);

  return workflowGenerateObject({
    label: "analyze",
    schema: workflowAnalysisSchema,
    temperature: 0.2,
    system: `You analyze customer messages for an AI sales agent (${agent.name}).
Company/product: ${agent.company_product_name ?? "the business"}.

CRITICAL — two separate fields (never swap them):
1) detected_intent — MUST be exactly one of these strings (NOT "greeting"):
   sales_enquiry | pricing_question | support_request | booking_request | complaint | general_enquiry | human_request
   - Hello/hi/intro only → general_enquiry (NOT greeting)
   - Wants services → sales_enquiry
2) conversation_stage — MUST be exactly one of:
   greeting | discovery | qualification | recommendation | objection_handling | booking | handoff | close
   - Hello/hi only → conversation_stage=greeting AND detected_intent=general_enquiry

Intent meanings:
- sales_enquiry: wants services, growth, or solutions
- pricing_question: cost, packages, quotes
- support_request: help with existing work
- booking_request: schedule a call
- complaint: unhappy or disputing
- general_enquiry: general info or small talk
- human_request: asks for a person or live agent

Score BANT dimensions 0–3 each (integers only):
- need: urgency and fit
- budget: budget clarity and ability to pay
- authority: decision-making power
- timeline: how soon they want to start

Extract lead fields from the conversation (name, phone, email, business, service interest, budget, timeline, authority, objections, preferred contact method). Also when mentioned: growth_milestone (6-month goal), current_stack (ads, analytics, CRM, or fresh start), team_structure (in-house vs agency-managed), budget_tier (Tier A SME / Tier B mid-market / Tier C enterprise). Map service needs to pillars: paid ads, social/branding, or full digital transformation. Use metadata only to fill gaps. Omit unknown fields — do not use empty strings.

Use the knowledge base excerpt below when inferring service_interest or answering context.

Flags:
- custom_pricing_requested, ready_to_pay, human_requested, serious_objection, complaint_detected

suggest_booking only when the lead is warm/hot (score ≥ warm threshold) AND qualified enough to offer scheduling — never for cold or not_qualified leads.

Org scoring thresholds (for your reasoning): hot≥${scoring.hot_threshold}, warm≥${scoring.warm_threshold}, cold≥${scoring.cold_threshold} (on scaled 0–100 total).
${isReadybotStyleAgent(agent) ? `\n${READYBOT_ANALYZER_STAGE_RULES}` : ""}`,
    prompt: `Agent type: ${agent.agent_type}
Qualification rules: ${effective.qualification_prompt || "Standard B2B qualification"}
Lead scoring rules: ${effective.lead_scoring_rules}
Handoff rules: ${effective.handoff_rules}
Booking rules: ${effective.booking_rules}
CRM rules: ${effective.crm_update_rules || "Update lead each turn"}
Pipeline default status for new leads: ${settings.sales_pipeline.default_status}

${metaLines ? `Known customer metadata:\n${metaLines}\n` : ""}
${knowledgeContext ? `Knowledge base excerpt:\n${knowledgeContext.slice(0, 6000)}\n` : ""}
Conversation history:
${ctxHistory || "(no prior messages)"}

Latest customer message:
${customerMessage}`,
    repairOnSchemaError: true,
  });
}
