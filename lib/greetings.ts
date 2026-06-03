import { brand, type Channel } from "./config";

export type GreetingVariant = "standard" | "sales";

export function getFirstMessage(
  channel: Channel = "website",
  variant: GreetingVariant = "sales"
): string {
  const company = brand.name;

  if (variant === "standard") {
    return `Hello, welcome to ${company}. I'm here to help you quickly. Are you looking for a service, making an enquiry, requesting support, or would you like to speak with our team?`;
  }

  const salesGreeting = `Hello, welcome to ${company}. I can help you find the right solution, answer your questions, and connect you with our team. What would you like help with today?`;

  if (channel === "whatsapp") {
    return `${salesGreeting}\n\nReply anytime — I'll guide you step by step.`;
  }

  if (channel === "voice") {
    return `Hello, welcome to ${company}. I can help with services, enquiries, or support. What would you like help with today?`;
  }

  return salesGreeting;
}
