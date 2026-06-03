import type { Lead } from "@/lib/platform/types";
import type { WorkflowAnalysis } from "@/lib/platform/workflow/schemas";
import { leadToHubSpotWebhookPayload } from "@/lib/integrations/hubspot/transform-lead";

export type CrmWebhookFormat = "generic" | "hubspot";

export function resolveCrmWebhookFormat(): CrmWebhookFormat {
  const raw = process.env.CRM_WEBHOOK_FORMAT?.trim().toLowerCase();
  if (raw === "hubspot") return "hubspot";
  return "generic";
}

export function buildCrmWebhookBody(params: {
  lead: Lead;
  extracted: WorkflowAnalysis["lead_extraction"];
  conversationId?: string | null;
  conversationStage?: string | null;
}): unknown {
  const { lead, extracted, conversationId, conversationStage } = params;

  if (resolveCrmWebhookFormat() === "hubspot") {
    return leadToHubSpotWebhookPayload({
      lead,
      extracted,
      conversationId,
      conversationStage,
    });
  }

  return {
    event: "lead.upsert",
    syncedAt: new Date().toISOString(),
    lead,
    conversationId: conversationId ?? null,
    conversationStage: conversationStage ?? null,
    customFields: {
      leadIntent: extracted.growth_milestone ?? lead.service_interest,
      currentStack: extracted.current_stack,
      budgetTier: extracted.budget_tier ?? lead.budget,
      timeline: lead.timeline ?? extracted.timeline,
      teamStructure: extracted.team_structure,
      authority: extracted.authority,
      serviceInterest: lead.service_interest,
      leadScore: lead.lead_score,
      leadCategory: lead.lead_category,
      leadStatus: lead.lead_status,
      conversationSummary: lead.summary,
      nextAction: lead.next_action,
      sourceChannel: lead.source,
    },
  };
}

export async function dispatchLeadCrmWebhook(params: {
  lead: Lead;
  extracted: WorkflowAnalysis["lead_extraction"];
  conversationId?: string | null;
  conversationStage?: string | null;
}): Promise<void> {
  const url = process.env.CRM_WEBHOOK_URL?.trim();
  if (!url) return;

  const body = buildCrmWebhookBody(params);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const hubspotSecret = process.env.HUBSPOT_WEBHOOK_SECRET?.trim();
  if (hubspotSecret && resolveCrmWebhookFormat() === "hubspot") {
    headers["X-Webhook-Secret"] = hubspotSecret;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CRM webhook HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}
