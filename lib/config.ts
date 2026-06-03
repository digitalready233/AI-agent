export const brand = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Digital Ready Ghana",
  tagline:
    process.env.NEXT_PUBLIC_COMPANY_TAGLINE ??
    "Digital marketing, branding & business growth",
  assistantName:
    process.env.NEXT_PUBLIC_ASSISTANT_NAME ?? "Digital Ready Assistant",
} as const;

export type AgentRole = "unified" | "support" | "sales" | "appointment" | "crm";

export type Channel = "website" | "whatsapp" | "voice" | "sms";

export const escalation = {
  email: process.env.ESCALATION_EMAIL ?? "team@digitalreadyghana.com",
  slackWebhook: process.env.ESCALATION_SLACK_WEBHOOK,
} as const;

export const booking = {
  url: process.env.NEXT_PUBLIC_BOOKING_URL ?? "",
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
} as const;

export const crm = {
  webhookUrl: process.env.CRM_WEBHOOK_URL,
  hubspotToken: process.env.HUBSPOT_ACCESS_TOKEN,
} as const;

export const followUp = {
  webhookUrl: process.env.FOLLOWUP_WEBHOOK_URL,
} as const;

export const whatsapp = {
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  appSecret: process.env.WHATSAPP_APP_SECRET,
} as const;

export const twilio = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
} as const;

/** Browser / Zoom-style meetings — optional embeds and deep links */
export const meetings = {
  zoomSchedulingUrl: process.env.NEXT_PUBLIC_ZOOM_SCHEDULING_URL ?? "",
  browserCallEmbedUrl: process.env.NEXT_PUBLIC_BROWSER_CALL_EMBED_URL ?? "",
} as const;

/** Video avatar (HeyGen, Tavus, D-ID, etc.) — iframe session URL */
export const avatar = {
  embedUrl: process.env.NEXT_PUBLIC_AVATAR_EMBED_URL ?? "",
} as const;

export const humanHours =
  process.env.HUMAN_SUPPORT_HOURS ??
  "Monday–Friday, 9:00 AM – 6:00 PM (GMT)";

/** OpenAI Dashboard → Prompts (pmpt_…). When set, chat uses that hosted knowledge. */
export const openaiPrompt = {
  id: process.env.OPENAI_PROMPT_ID?.trim() || undefined,
  version: process.env.OPENAI_PROMPT_VERSION ?? "1",
  /** Also merge local knowledge/company-knowledge.md (optional) */
  mergeLocalKnowledge:
    process.env.OPENAI_PROMPT_MERGE_LOCAL_KB !== "false",
} as const;
