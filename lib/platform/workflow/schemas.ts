import { z } from "zod";

export const WORKFLOW_INTENTS = [
  "sales_enquiry",
  "pricing_question",
  "support_request",
  "booking_request",
  "complaint",
  "general_enquiry",
  "human_request",
] as const;

export const WORKFLOW_STAGES = [
  "greeting",
  "discovery",
  "qualification",
  "recommendation",
  "objection_handling",
  "booking",
  "handoff",
  "close",
] as const;

export const workflowInputSchema = z.object({
  organizationId: z.string().min(1),
  agentId: z.string().min(1),
  conversationId: z.string().min(1),
  customerMessage: z.string().min(1).max(8000),
  channel: z.string().min(1).max(64),
  customerMetadata: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      businessName: z.string().optional(),
      serviceInterest: z.string().optional(),
      budget: z.string().optional(),
      timeline: z.string().optional(),
    })
    .optional(),
  /** External channel message id (e.g. WhatsApp wamid) for idempotency */
  externalMessageId: z.string().max(256).optional(),
});

export const workflowAnalysisSchema = z.object({
  detected_intent: z.enum(WORKFLOW_INTENTS),
  conversation_stage: z.enum(WORKFLOW_STAGES),
  ai_confidence: z.number().min(0).max(1),
  conversation_summary: z.string().max(600),
  recommended_next_action: z.string().max(300),
  lead_extraction: z.object({
    full_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    business_name: z.string().optional(),
    service_interest: z.string().optional(),
    budget: z.string().optional(),
    timeline: z.string().optional(),
    authority: z.string().optional(),
    objections: z.string().optional(),
    preferred_contact_method: z.string().optional(),
    /** ReadyBot / discovery pipeline */
    growth_milestone: z.string().optional(),
    current_stack: z.string().optional(),
    team_structure: z.string().optional(),
    budget_tier: z.string().optional(),
  }),
  /** Raw BANT scores 0–3 per dimension (scaled using org Lead Scoring settings). */
  lead_scores: z.object({
    need: z.number().int().min(0).max(3),
    budget: z.number().int().min(0).max(3),
    authority: z.number().int().min(0).max(3),
    timeline: z.number().int().min(0).max(3),
  }),
  flags: z.object({
    custom_pricing_requested: z.boolean(),
    ready_to_pay: z.boolean(),
    human_requested: z.boolean(),
    serious_objection: z.boolean(),
    complaint_detected: z.boolean(),
  }),
  suggest_booking: z.boolean(),
});

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type WorkflowAnalysis = z.infer<typeof workflowAnalysisSchema>;
export type WorkflowIntent = (typeof WORKFLOW_INTENTS)[number];
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
