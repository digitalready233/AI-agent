import { escalation } from "../config";
import type { EscalationPayload, LeadRecord } from "../types";

export async function notifyEscalation(
  payload: EscalationPayload
): Promise<void> {
  if (escalation.slackWebhook) {
    await fetch(escalation.slackWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 Escalation [${payload.urgency}] — ${payload.reason}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${payload.reason}*\n${payload.summary}\n\n*Contact:* ${payload.customerName ?? "—"} | ${payload.email ?? "—"} | ${payload.phone ?? "—"}\n*Lead status:* ${payload.leadStatus ?? "—"}\n*Next:* ${payload.recommendedNextAction}`,
            },
          },
        ],
      }),
    }).catch(() => undefined);
  }

  // Email via webhook (Resend, SendGrid, etc.) — set ESCALATION_EMAIL_WEBHOOK
  const emailWebhook = process.env.ESCALATION_EMAIL_WEBHOOK;
  if (emailWebhook) {
    await fetch(emailWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: escalation.email,
        subject: `[DigiSales] Escalation — ${payload.urgency}: ${payload.reason}`,
        payload,
      }),
    }).catch(() => undefined);
  }
}

/** Slack / email ping when NBAT scores a Hot Lead (SalesCloser-style). */
export async function notifyHumanAttention(params: {
  reason: string;
  sessionId: string;
  channel: string;
  summary: string;
  urgency: string;
}): Promise<void> {
  if (!escalation.slackWebhook) return;
  await fetch(escalation.slackWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `👤 Human attention [${params.urgency}] — ${params.reason}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${params.reason}*\n${params.summary}\n\nSession: \`${params.sessionId}\` · Channel: ${params.channel}`,
          },
        },
      ],
    }),
  }).catch(() => undefined);
}

export async function notifyHotLead(lead: LeadRecord): Promise<void> {
  if (escalation.slackWebhook) {
    await fetch(escalation.slackWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔥 Hot lead — ${lead.leadCategory ?? "Hot"} (${lead.leadScore ?? "—"} pts)`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Hot lead scored*\n${lead.businessName ?? lead.fullName ?? "Prospect"} — *${lead.serviceNeeded ?? "service TBD"}*\n${lead.email ?? "—"} · ${lead.phone ?? "—"}\nBudget: ${lead.budgetRange ?? "—"} · Timeline: ${lead.timeline ?? "—"}\nSession: \`${lead.sessionId}\``,
            },
          },
        ],
      }),
    }).catch(() => undefined);
  }

  const emailWebhook = process.env.ESCALATION_EMAIL_WEBHOOK;
  if (emailWebhook) {
    await fetch(emailWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: escalation.email,
        subject: `[DigiSales] Hot lead — ${lead.businessName ?? lead.fullName ?? "New prospect"}`,
        payload: { type: "hot_lead", lead },
      }),
    }).catch(() => undefined);
  }
}
