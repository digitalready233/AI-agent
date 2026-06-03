import { followUp } from "../config";

export async function scheduleFollowUpWebhook(data: {
  email: string;
  fullName?: string;
  summary: string;
  preferredContact?: string;
  followUpAt?: string;
}): Promise<void> {
  if (!followUp.webhookUrl) return;

  await fetch(followUp.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "follow_up.scheduled",
      ...data,
    }),
  });
}
