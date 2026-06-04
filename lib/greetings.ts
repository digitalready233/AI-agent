import { brand, type Channel } from "./config";
import { LIVE_AGENT_QUALIFICATION_WELCOME } from "./copy/public-messaging";

export type GreetingVariant = "standard" | "sales";

export function getFirstMessage(
  channel: Channel = "website",
  variant: GreetingVariant = "sales"
): string {
  const company = brand.name;

  if (variant === "standard") {
    return `Hello, welcome to ${company}. I'm here to help you quickly. Are you looking for a service, making an enquiry, requesting support, or would you like to speak with our team?`;
  }

  const salesGreeting = LIVE_AGENT_QUALIFICATION_WELCOME.replace(
    "DigiSales.ai",
    company.includes("DigiSales") ? "DigiSales.ai" : company
  );

  if (channel === "whatsapp") {
    return `${salesGreeting}\n\nReply anytime — I'll qualify step by step and book or hand off when needed.`;
  }

  if (channel === "voice") {
    return `Welcome to ${company}. I'm your AI sales agent — I can qualify your need, answer from our knowledge base, and route you to a human closer when appropriate. What are you looking to solve today?`;
  }

  return salesGreeting;
}
