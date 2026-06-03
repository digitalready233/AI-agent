import {
  getCampaign,
  getLead,
  listCampaignLeads,
} from "@/lib/platform/data";
import { isOutboundVoiceCampaign } from "@/lib/platform/campaign-types";
import type { Campaign, Lead } from "@/lib/platform/types";
import { getOutboundVoiceSettings, isWithinCallWindow } from "./campaign-voice-settings";
import { dialCampaignLead } from "./outbound-dial";
import {
  deleteQueueForCampaign,
  getQueueItemById,
  listDueQueueItems,
  listQueueForCampaign,
  saveQueueItem,
} from "./outbound-queue-data";
import type { OutboundCallQueueItem } from "./types";

function normalizeE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function leadBlockedForDial(lead: Lead): string | null {
  if (lead.do_not_call) return "Lead is on do-not-call list";
  if (lead.marketing_opt_in === false || lead.unsubscribed_at) {
    return "Lead has opted out";
  }
  const phone = normalizeE164(lead.phone ?? "");
  if (!phone) return "Lead has no valid phone number";
  return null;
}

/** Build or refresh queue rows from campaign_leads. */
export async function syncOutboundQueueForCampaign(
  campaignId: string
): Promise<{ enqueued: number; skipped: number }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || !isOutboundVoiceCampaign(campaign)) {
    return { enqueued: 0, skipped: 0 };
  }

  const settings = getOutboundVoiceSettings(campaign);
  const rows = await listCampaignLeads(campaignId);
  const existing = await listQueueForCampaign(campaignId);
  const byLead = new Map(existing.map((q) => [q.lead_id, q]));

  let enqueued = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const cl of rows) {
    const lead = await getLead(cl.lead_id);
    if (!lead) {
      skipped += 1;
      continue;
    }
    const block = leadBlockedForDial(lead);
    const phone = normalizeE164(lead.phone ?? "");
    if (block || !phone) {
      skipped += 1;
      const prev = byLead.get(lead.id);
      if (prev) {
        await saveQueueItem({
          ...prev,
          status: "skipped",
          error_message: block ?? "No phone",
          call_outcome: lead.do_not_call ? "do_not_call" : null,
        });
      }
      continue;
    }

    if (byLead.has(lead.id)) {
      enqueued += 1;
      continue;
    }

    const item: OutboundCallQueueItem = {
      id: crypto.randomUUID(),
      organization_id: campaign.organization_id,
      campaign_id: campaignId,
      campaign_lead_id: cl.id,
      lead_id: lead.id,
      phone_number: phone,
      attempt_count: 0,
      max_attempts: settings.max_attempts,
      scheduled_at: campaign.scheduled_at && campaign.scheduled_at > now
        ? campaign.scheduled_at
        : now,
      status: "pending",
      last_attempt_at: null,
      next_attempt_at: null,
      call_outcome: null,
      error_message: null,
      last_call_id: null,
      created_at: now,
      updated_at: now,
    };
    await saveQueueItem(item);
    enqueued += 1;
  }

  return { enqueued, skipped };
}

export type ProcessQueueResult = {
  dialed: number;
  failed: number;
  skipped: number;
  errors: string[];
};

/** Dial due queue items for one org (respects concurrency via dialCampaignLead). */
export async function processOutboundCallQueue(
  organizationId: string,
  options?: { campaignId?: string; limit?: number }
): Promise<ProcessQueueResult> {
  const result: ProcessQueueResult = {
    dialed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const appOrigin =
    process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  let due = await listDueQueueItems(organizationId, options?.limit ?? 8);
  if (options?.campaignId) {
    due = due.filter((d) => d.campaign_id === options.campaignId);
  }

  for (const item of due) {
    const campaign = await getCampaign(item.campaign_id);
    if (!campaign || campaign.status !== "live") {
      result.skipped += 1;
      continue;
    }
    if (!campaign.agent_id) {
      result.skipped += 1;
      continue;
    }

    const settings = getOutboundVoiceSettings(campaign);
    const window = settings.call_window;
    if (window && !isWithinCallWindow(window)) {
      result.skipped += 1;
      continue;
    }

    if (item.attempt_count >= item.max_attempts) {
      await saveQueueItem({
        ...item,
        status: "exhausted",
        error_message: "Max attempts reached",
      });
      result.skipped += 1;
      continue;
    }

    const lead = await getLead(item.lead_id);
    if (!lead) {
      result.skipped += 1;
      continue;
    }

    const block = leadBlockedForDial(lead);
    if (block) {
      await saveQueueItem({
        ...item,
        status: "skipped",
        error_message: block,
        call_outcome: lead.do_not_call ? "do_not_call" : null,
      });
      result.skipped += 1;
      continue;
    }

    const opening =
      (campaign.follow_up_rules as { message_template?: string })
        ?.message_template ?? null;

    await saveQueueItem({ ...item, status: "dialing" });

    const dial = await dialCampaignLead({
      organizationId,
      campaignId: item.campaign_id,
      campaignLeadId: item.campaign_lead_id ?? item.id,
      agentId: campaign.agent_id,
      lead,
      appOrigin,
      openingScript: typeof opening === "string" ? opening : null,
      maxConcurrent: settings.max_concurrent_calls,
      queueItemId: item.id,
      humanTransferPhone: settings.human_transfer_phone,
    });

    const now = new Date().toISOString();
    const attempts = item.attempt_count + 1;

    if (dial.ok) {
      result.dialed += 1;
      await saveQueueItem({
        ...item,
        status: "pending",
        attempt_count: attempts,
        last_attempt_at: now,
        last_call_id: dial.callId ?? null,
        error_message: null,
      });
    } else {
      result.failed += 1;
      result.errors.push(dial.error ?? "Dial failed");
      const exhausted = attempts >= item.max_attempts;
      await saveQueueItem({
        ...item,
        status: exhausted ? "exhausted" : "pending",
        attempt_count: attempts,
        last_attempt_at: now,
        call_outcome: "failed",
        error_message: dial.error ?? "Dial failed",
        next_attempt_at: exhausted
          ? null
          : new Date(
              new Date(now).getTime() +
                (settings.retry_delay_minutes ?? 240) * 60 * 1000
            ).toISOString(),
      });
    }
  }

  return result;
}

export async function rebuildOutboundQueue(campaignId: string): Promise<void> {
  await deleteQueueForCampaign(campaignId);
  await syncOutboundQueueForCampaign(campaignId);
}

export async function getQueueItemForCall(
  queueItemId: string | undefined
): Promise<OutboundCallQueueItem | null> {
  if (!queueItemId) return null;
  return getQueueItemById(queueItemId);
}
