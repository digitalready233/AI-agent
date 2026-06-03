export type PaystackPlan = {
  id: string;
  name: string;
  amountGhs: number;
  agentsAllowed: number;
  description: string;
};

export const PAYSTACK_PLANS: PaystackPlan[] = [
  {
    id: "starter",
    name: "Starter",
    amountGhs: 499,
    agentsAllowed: 2,
    description: "1–2 agents, website chat, knowledge base, 14-day trial then pay.",
  },
  {
    id: "growth",
    name: "Growth",
    amountGhs: 1499,
    agentsAllowed: 10,
    description: "Voice + demos, CRM webhooks, multilingual, priority support.",
  },
  {
    id: "scale",
    name: "Scale",
    amountGhs: 3999,
    agentsAllowed: 50,
    description: "High-volume outbound, team seats, custom integrations.",
  },
];
