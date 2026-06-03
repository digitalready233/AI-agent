import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "./json-store";
import { touchLeadFromCampaign } from "./campaign-crm";
import { isUnsubscribeMessage } from "./campaign-stop";
import { parseStopConditions } from "./campaign-types";
import { getCampaign, listCampaignLeads, saveCampaign, saveCampaignLead } from "./data";
import type { CampaignLead } from "./types";

async function listActiveCampaignLeadsForLead(
  organizationId: string,
  leadId: string
): Promise<Array<CampaignLead & { campaign_id: string }>> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaign_leads")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("lead_id", leadId)
      .eq("sequence_status", "active");
    return (data ?? []) as CampaignLead[];
  }
  return jsonStore.getActiveCampaignLeadsForLead(organizationId, leadId);
}

/** Pause sequences when a lead replies on any channel. */
export async function handleCampaignInboundReply(params: {
  organizationId: string;
  leadId: string;
  messageText: string;
}): Promise<{ paused: number; unsubscribed: boolean }> {
  const rows = await listActiveCampaignLeadsForLead(params.organizationId, params.leadId);
  if (!rows.length) return { paused: 0, unsubscribed: false };

  let unsubscribed = false;
  const now = new Date().toISOString();

  for (const cl of rows) {
    const campaign = await getCampaign(cl.campaign_id);
    const stopRules = parseStopConditions(campaign?.stop_conditions);

    if (
      stopRules.stop_on_unsubscribe &&
      isUnsubscribeMessage(params.messageText, stopRules.stop_keywords ?? [])
    ) {
      unsubscribed = true;
      await touchLeadFromCampaign({
        leadId: params.leadId,
        note: "Lead opted out via message keyword",
        unsubscribed: true,
        nextAction: "Do not contact — unsubscribed",
      });
    }

    await saveCampaignLead({
      ...cl,
      status: "replied",
      sequence_status: "paused",
      paused_reason: unsubscribed ? "unsubscribe" : "reply",
      replied_at: now,
      next_step_at: null,
    });

    if (campaign) {
      const rules = (campaign.follow_up_rules ?? {}) as Record<string, unknown>;
      const replied = typeof rules.replied_count === "number" ? rules.replied_count + 1 : 1;
      await saveCampaign({
        ...campaign,
        follow_up_rules: { ...rules, replied_count: replied },
        updated_at: now,
      });
    }
  }

  if (!unsubscribed) {
    await touchLeadFromCampaign({
      leadId: params.leadId,
      note: "Customer replied — campaign sequence paused",
      nextAction: "Continue conversation in inbox",
    });
  }

  return { paused: rows.length, unsubscribed };
}
