import { brand } from "@/lib/config";

export type CampaignEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type CampaignEmailResult = { ok: boolean; error?: string; provider?: string };

/** Send campaign email via Resend (preferred) or generic webhook. */
export async function sendCampaignEmail(
  payload: CampaignEmailPayload
): Promise<CampaignEmailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.CAMPAIGN_EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    `${brand.name} <onboarding@resend.dev>`;

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err, provider: "resend" };
    }
    return { ok: true, provider: "resend" };
  }

  const webhook =
    process.env.CAMPAIGN_EMAIL_WEBHOOK?.trim() ||
    process.env.ESCALATION_EMAIL_WEBHOOK?.trim();

  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "campaign_email",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: await res.text(), provider: "webhook" };
    }
    return { ok: true, provider: "webhook" };
  }

  return {
    ok: false,
    error:
      "Email not configured. Set RESEND_API_KEY + CAMPAIGN_EMAIL_FROM, or CAMPAIGN_EMAIL_WEBHOOK.",
    provider: "none",
  };
}

export function campaignEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() ||
      process.env.CAMPAIGN_EMAIL_WEBHOOK?.trim() ||
      process.env.ESCALATION_EMAIL_WEBHOOK?.trim()
  );
}
