import { generateObject } from "ai";
import { z } from "zod";
import { getChatModel } from "../agent/llm-model";
import type {
  CustomerIntent,
  IntentClassification,
  LeadStageHint,
} from "./types";
import { CUSTOMER_INTENTS, LEAD_STAGES } from "./types";

const intentSchema = z.object({
  intent: z.enum(CUSTOMER_INTENTS as unknown as [string, ...string[]]),
  inferred_service: z
    .string()
    .optional()
    .describe(
      "If applicable, the product/service they mean, e.g. social media management."
    ),
  lead_stage: z.enum(LEAD_STAGES as unknown as [string, ...string[]]),
  brief_reason: z
    .string()
    .max(200)
    .describe("One short phrase why this intent was chosen."),
});

function formatHistory(
  messages: { role: string; content: string }[],
  maxTurns: number
): string {
  return messages
    .slice(-maxTurns)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

export async function classifyCustomerIntent(params: {
  latestUserMessage: string;
  recentMessages: { role: "user" | "assistant" | "system"; content: string }[];
}): Promise<IntentClassification> {
  const ctx = formatHistory(params.recentMessages, 8);

  const { object } = await generateObject({
    model: getChatModel(),
    schema: intentSchema,
    temperature: 0.1,
    system: `You classify the CUSTOMER's latest message for a B2B agency (${process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Digital Ready Ghana"}).
Choose exactly one intent. Prefer "sales_enquiry" when they want services or growth. "pricing_question" only when asking cost/pricing directly.
"booking_request" when they want to schedule. "complaint" for frustration or disputes.`,
    prompt: `Conversation so far:\n${ctx}\n\nLatest customer message:\n${params.latestUserMessage}`,
  });

  return {
    intent: object.intent as CustomerIntent,
    inferred_service: object.inferred_service,
    lead_stage: object.lead_stage as LeadStageHint,
    brief_reason: object.brief_reason,
  };
}
