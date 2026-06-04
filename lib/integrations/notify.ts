import { brand, escalation } from "../config";
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

/** Email/Slack when platform chat or WhatsApp workflow requests a human. */
export async function notifyPlatformHumanHandoff(params: {
  customerName: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  channel: string;
  intent: string;
  summary: string;
  conversationId: string;
  leadId: string;
  leadCategory: string;
  conversationUrl: string;
}): Promise<void> {
  const contact = [
    params.customerName,
    params.businessName ? `(${params.businessName})` : null,
    params.email,
    params.phone,
  ]
    .filter(Boolean)
    .join(" · ");

  const text = [
    `*Human handoff* — ${params.intent.replace(/_/g, " ")}`,
    contact || "No contact captured yet",
    params.summary,
    `Channel: ${params.channel} · Score band: ${params.leadCategory}`,
    `<${params.conversationUrl}|Open conversation>`,
  ].join("\n");

  if (escalation.slackWebhook) {
    await fetch(escalation.slackWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Human handoff — ${params.customerName ?? "Visitor"}`,
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text },
          },
        ],
      }),
    }).catch(() => undefined);
  }

  const emailWebhook = process.env.ESCALATION_EMAIL_WEBHOOK?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const subject = `[DigiSales] Human handoff — ${params.customerName ?? "Visitor"}`;

  const html = `<p><strong>AI escalated to your team</strong></p>
<p>${params.summary}</p>
<ul>
<li><strong>Name:</strong> ${params.customerName ?? "—"}</li>
<li><strong>Business:</strong> ${params.businessName ?? "—"}</li>
<li><strong>Email:</strong> ${params.email ?? "—"}</li>
<li><strong>Phone:</strong> ${params.phone ?? "—"}</li>
<li><strong>Channel:</strong> ${params.channel}</li>
<li><strong>Intent:</strong> ${params.intent.replace(/_/g, " ")}</li>
</ul>
<p><a href="${params.conversationUrl}">Open conversation in dashboard</a></p>`;

  if (resendKey) {
    const from =
      process.env.RESEND_FROM?.trim() ||
      process.env.CAMPAIGN_EMAIL_FROM?.trim() ||
      `${brand.name} <onboarding@resend.dev>`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [escalation.email],
        subject,
        html,
        text: `${params.summary}\n\nContact: ${contact}\n\n${params.conversationUrl}`,
      }),
    }).catch(() => undefined);
  } else if (emailWebhook) {
    await fetch(emailWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: escalation.email,
        subject,
        html,
        payload: params,
      }),
    }).catch(() => undefined);
  }
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
