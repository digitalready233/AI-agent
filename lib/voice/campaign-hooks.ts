import {
  getCampaign,
  getLead,
  listCampaignLeads,
  saveCampaignLead,
  saveLead,
} from "@/lib/platform/data";
import { saveCampaignLog } from "@/lib/platform/campaign-automation-data";
import { touchLeadFromCampaign } from "@/lib/platform/campaign-crm";
import { getOutboundVoiceSettings } from "./campaign-voice-settings";
import {
  computeNextAttemptAt,
  isRetryableOutcome,
  mapTwilioToCallOutcome,
} from "./outbound-retry";
import {
  getQueueItemById,
  queueStatusFromOutcome,
  saveQueueItem,
} from "./outbound-queue-data";
import type { CallOutcome, CallRecord } from "./types";

/**
 * After an outbound campaign call ends, update campaign_lead, queue, log, and CRM.
 */
export async function syncCampaignFromCompletedCall(
  call: CallRecord
): Promise<void> {
  const campaignId =
    typeof call.metadata?.campaign_id === "string"
      ? call.metadata.campaign_id
      : null;
  const campaignLeadId =
    typeof call.metadata?.campaign_lead_id === "string"
      ? call.metadata.campaign_lead_id
      : null;
  const queueItemId =
    typeof call.metadata?.queue_item_id === "string"
      ? call.metadata.queue_item_id
      : null;

  if (!campaignId || !campaignLeadId) return;

  const campaign = await getCampaign(campaignId);
  if (!campaign) return;

  const settings = getOutboundVoiceSettings(campaign);
  const bookingId =
    typeof call.metadata?.booking_id === "string"
      ? call.metadata.booking_id
      : null;

  const outcome: CallOutcome =
    call.call_outcome ??
    mapTwilioToCallOutcome({
      callStatus: call.status,
      answeredBy:
        typeof call.metadata?.answered_by === "string"
          ? call.metadata.answered_by
          : null,
      durationSeconds: call.duration_seconds,
      handoffRequired: call.handoff_required,
      bookingId,
      leadCategory: call.lead_category,
      detectedIntent: call.detected_intent,
    });

  const rows = await listCampaignLeads(campaignId);
  const cl = rows.find((r) => r.id === campaignLeadId);
  if (!cl) return;

  const now = new Date().toISOString();
  const completed =
    outcome === "answered" ||
    outcome === "qualified" ||
    outcome === "booked" ||
    outcome === "human_transfer" ||
    call.status === "completed";
  const failed = isRetryableOutcome(outcome);
  const hot =
    call.lead_category === "hot" ||
    call.handoff_required ||
    outcome === "human_transfer";

  await saveCampaignLog({
    id: crypto.randomUUID(),
    organization_id: call.organization_id,
    campaign_id: campaignId,
    lead_id: call.lead_id ?? cl.lead_id,
    campaign_step_id:
      typeof call.metadata?.campaign_step_id === "string"
        ? call.metadata.campaign_step_id
        : null,
    channel: "voice",
    message_sent: call.summary ?? `Call outcome: ${outcome}`,
    status: completed ? "delivered" : failed ? "failed" : "sent",
    error_message: call.failure_reason,
    sent_at: call.ended_at ?? now,
    replied_at: completed && call.transcript ? now : null,
  });

  await saveCampaignLead({
    ...cl,
    status: completed ? "replied" : failed ? "failed" : cl.status,
    last_sent_at: call.started_at ?? cl.last_sent_at,
    last_error: call.failure_reason ?? cl.last_error,
    channels_sent: [...new Set([...(cl.channels_sent ?? []), "voice"])],
    sequence_status: hot || completed ? "completed" : cl.sequence_status,
    next_step_at: hot || completed ? null : cl.next_step_at,
    replied_at: completed ? now : cl.replied_at,
    attempts: (cl.attempts ?? 0) + 1,
  });

  if (queueItemId) {
    const queueItem = await getQueueItemById(queueItemId);
    if (queueItem) {
      const attemptCount = Math.max(
        queueItem.attempt_count,
        cl.attempts ?? 1
      );
      const shouldRetry =
        isRetryableOutcome(outcome) && attemptCount < queueItem.max_attempts;
      const nextStatus = shouldRetry
        ? "pending"
        : queueStatusFromOutcome(
            outcome,
            attemptCount,
            queueItem.max_attempts
          );

      await saveQueueItem({
        ...queueItem,
        status: nextStatus,
        call_outcome: outcome,
        attempt_count: attemptCount,
        last_attempt_at: call.ended_at ?? now,
        last_call_id: call.id,
        error_message: call.failure_reason,
        next_attempt_at: shouldRetry
          ? computeNextAttemptAt(now, settings.retry_delay_minutes)
          : null,
      });
    }
  }

  if (call.lead_id) {
    const lead = await getLead(call.lead_id);
    if (lead) {
      let leadStatus = lead.lead_status;
      if (outcome === "booked") leadStatus = "qualified";
      else if (hot && lead.lead_status !== "qualified") leadStatus = "qualified";
      else if (outcome === "not_interested") leadStatus = "disqualified";

      let leadCategory = lead.lead_category;
      if (call.lead_category) leadCategory = call.lead_category as typeof leadCategory;

      const patch: Parameters<typeof saveLead>[0] = {
        ...lead,
        last_contacted_at: now,
        lead_status: leadStatus,
        lead_category: leadCategory,
        summary: call.summary ?? lead.summary,
        next_action: call.recommended_next_action ?? lead.next_action,
        updated_at: now,
      };

      if (outcome === "do_not_call") {
        patch.do_not_call = true;
        patch.do_not_call_at = now;
        patch.marketing_opt_in = false;
      }

      await saveLead(patch);

      await touchLeadFromCampaign({
        leadId: lead.id,
        note: `Voice campaign — ${outcome}${call.summary ? `: ${call.summary.slice(0, 120)}` : ""}`,
        nextAction: call.recommended_next_action ?? lead.next_action,
        leadStatus,
      });

      if (outcome === "human_transfer") {
        const { saveNotification } = await import("@/lib/platform/data");
        await saveNotification({
          id: crypto.randomUUID(),
          organization_id: call.organization_id,
          type: "human_handoff",
          title: "Voice campaign — human transfer",
          message: `${lead.full_name ?? lead.phone ?? "Lead"} requested a human during outbound campaign call.`,
          status: "unread",
          metadata: { link: `/dashboard/calls/${call.id}`, call_id: call.id },
          created_at: now,
        });
      }
    }
  }
}
