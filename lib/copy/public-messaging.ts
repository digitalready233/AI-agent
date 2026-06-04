/** Public-facing copy — AI sales agent positioning (not support-chat wording). */

export const LIVE_AGENT_QUALIFICATION_WELCOME =
  "Welcome to DigiSales.ai. I can show you how an AI sales agent would work for your business. What should it handle first — website leads, WhatsApp enquiries, outbound calls, live demos, or follow-ups?";

export const LIVE_AGENT_DEFAULT_QUICK_PROMPTS = [
  "Qualify me as a prospect — budget and timeline",
  "Show me how demo + handoff works",
  "I want to book a strategy consultation",
  "Connect me with a human closer",
] as const;

export type FeatureAvailability = "available" | "beta" | "coming_soon";

export type PlatformFeature = {
  name: string;
  status: FeatureAvailability;
  note?: string;
};

export const PLATFORM_FEATURES: PlatformFeature[] = [
  { name: "AI qualification (website & embed)", status: "available" },
  { name: "Knowledge base & agent builder", status: "available" },
  { name: "Lead CRM & conversation inbox", status: "available" },
  { name: "AI demo room & presentation paths", status: "available" },
  { name: "Human closer handoff + notifications", status: "available" },
  { name: "Paystack billing & trials", status: "available" },
  { name: "Calendly & Google Calendar booking", status: "available" },
  { name: "WhatsApp inbound", status: "beta", note: "Configure in Integrations" },
  { name: "Voice calls (Twilio)", status: "beta", note: "Voice menu hidden until you enable" },
  { name: "Outbound voice campaigns", status: "beta" },
  { name: "Video avatar demos", status: "beta", note: "D-ID / Tavus when configured" },
  { name: "Native Zoom join", status: "coming_soon", note: "Scheduling links supported today" },
  { name: "HubSpot / Salesforce sync", status: "beta", note: "Webhooks & CRM fields" },
];

export const AI_WORKFLOW_STEPS = [
  { title: "Visitor asks a question", body: "Website, embed, or WhatsApp — no login required." },
  { title: "AI qualifies need, budget, timeline", body: "NBAT-style scoring and stage tracking in real time." },
  { title: "AI selects demo path", body: "Presentation flow matches service interest and intent." },
  { title: "AI answers from knowledge base", body: "Only approved FAQs, collateral, and brand rules." },
  { title: "AI books consultation", body: "Internal calendar, Google Calendar, or Calendly." },
  { title: "CRM & workspace update", body: "Lead draft, transcript, and recommended next action." },
  { title: "Human closer notified", body: "Dashboard alert with name, email, phone, and thread link." },
] as const;

export const WORKSPACE_SCREENSHOTS = [
  { title: "Agent builder", caption: "Role, tone, qualification, booking, and handoff rules." },
  { title: "Knowledge base", caption: "Collateral, FAQs, and brand guidelines per agent." },
  { title: "Lead CRM", caption: "Scores, stages, and conversation history." },
  { title: "AI demo room", caption: "Paths, presentation, objections, and handoff." },
  { title: "Campaigns", caption: "WhatsApp and voice outbound when enabled." },
  { title: "Analytics", caption: "Demos, bookings, handoffs, and pipeline signals." },
] as const;

export function featureStatusLabel(status: FeatureAvailability): string {
  if (status === "available") return "Available";
  if (status === "beta") return "Beta";
  return "Coming soon";
}
