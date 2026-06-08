import type { Conversation, Lead, LeadStatus } from "@/lib/platform/types";
import type { WorkspaceSettings } from "@/lib/platform/settings-types";
import { saveLead } from "@/lib/platform/data";
import type { SalesPipelineSettings } from "@/lib/platform/settings-types";
import { dispatchLeadCrmWebhook } from "@/lib/integrations/crm/dispatch-lead-webhook";
import type { WorkflowAnalysis } from "./schemas";
import { resolveLeadCategory } from "./lead-category";
import { sumLeadScores } from "./scoring";
import type { LeadScoringSettings } from "@/lib/platform/settings-types";

export async function upsertLeadFromWorkflow(params: {
  organizationId: string;
  conversation: Conversation;
  analysis: WorkflowAnalysis;
  channel: string;
  scoring: LeadScoringSettings;
  pipeline: SalesPipelineSettings;
  workspace: WorkspaceSettings;
  customerMetadata?: {
    name?: string;
    email?: string;
    phone?: string;
    businessName?: string;
    serviceInterest?: string;
    budget?: string;
    timeline?: string;
  };
  existingLead: Lead | null;
}): Promise<Lead> {
  const { analysis, existingLead, customerMetadata, scoring, pipeline, workspace } =
    params;
  const extracted = analysis.lead_extraction;
  const scores = sumLeadScores(analysis.lead_scores, scoring);
  const category = resolveLeadCategory(analysis, scores.total, scoring);
  const now = new Date().toISOString();

  const pick = (...values: (string | null | undefined)[]) =>
    values.find((v) => v && v.trim())?.trim() ?? null;

  const extraNotes = [
    extracted.discovery_goal_focus &&
      `Discovery focus: ${extracted.discovery_goal_focus}`,
    extracted.growth_milestone && `Growth milestone: ${extracted.growth_milestone}`,
    extracted.current_stack && `Current stack: ${extracted.current_stack}`,
    extracted.team_structure && `Team model: ${extracted.team_structure}`,
    extracted.budget_tier && `Budget tier: ${extracted.budget_tier}`,
    extracted.authority && `Authority: ${extracted.authority}`,
    extracted.objections && `Objections: ${extracted.objections}`,
    extracted.preferred_contact_method &&
      `Preferred contact: ${extracted.preferred_contact_method}`,
  ]
    .filter(Boolean)
    .join("\n");

  const mergedNotes = [existingLead?.notes, extraNotes].filter(Boolean).join("\n\n") || null;

  const leadStatus = deriveLeadStatus(category, pipeline, existingLead?.lead_status);

  const lead: Lead = {
    id: existingLead?.id ?? crypto.randomUUID(),
    organization_id: params.organizationId,
    full_name: pick(extracted.full_name, customerMetadata?.name, existingLead?.full_name),
    phone: pick(extracted.phone, customerMetadata?.phone, existingLead?.phone),
    email: pick(extracted.email, customerMetadata?.email, existingLead?.email),
    business_name: pick(
      extracted.business_name,
      customerMetadata?.businessName,
      existingLead?.business_name
    ),
    service_interest: pick(
      extracted.service_interest,
      customerMetadata?.serviceInterest,
      existingLead?.service_interest
    ),
    budget: pick(
      extracted.budget,
      extracted.budget_tier,
      customerMetadata?.budget,
      existingLead?.budget
    ),
    timeline: pick(extracted.timeline, customerMetadata?.timeline, existingLead?.timeline),
    source:
      existingLead?.source ??
      (params.channel === "whatsapp" ? "WhatsApp" : params.channel),
    lead_score: scores.total,
    lead_category: category,
    lead_status: leadStatus,
    assigned_to:
      existingLead?.assigned_to ?? workspace.default_lead_owner_id ?? null,
    summary: analysis.conversation_summary,
    next_action: analysis.recommended_next_action,
    follow_up_date: existingLead?.follow_up_date ?? null,
    notes: mergedNotes,
    created_at: existingLead?.created_at ?? now,
    updated_at: now,
  };

  const saved = await saveLead(lead);
  void dispatchLeadCrmWebhook({
    lead: saved,
    extracted,
    conversationId: params.conversation.id,
    conversationStage: params.analysis.conversation_stage,
  }).catch((e) => console.error("[upsertLeadFromWorkflow] CRM webhook", e));
  return saved;
}

function deriveLeadStatus(
  category: Lead["lead_category"],
  pipeline: SalesPipelineSettings,
  previous?: LeadStatus
): LeadStatus {
  const enabled = new Set(
    pipeline.statuses.filter((s) => s.enabled).map((s) => s.key)
  );

  const pick = (status: LeadStatus): LeadStatus =>
    enabled.has(status) ? status : pipeline.default_status;

  if (category === "hot") return pick("qualified");
  if (category === "support") {
    return previous && enabled.has(previous) ? previous : pick("working");
  }
  if (category === "not_qualified") return pick("disqualified");
  if (category === "warm") {
    if (previous && previous !== "created") return pick(previous);
    return pick("working");
  }
  if (previous && enabled.has(previous)) return previous;
  return pipeline.default_status;
}
