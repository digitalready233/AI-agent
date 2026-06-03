import { z } from "zod";
import { WORKFLOW_INTENTS } from "@/lib/platform/workflow/schemas";
import type { WorkflowLeadScores } from "@/lib/platform/workflow/types";
import type { LeadCategory } from "@/lib/platform/types";
import { SALES_DEMO_STAGES, normalizeDemoStage } from "./demo-stages";

/** Groq/OpenAI often return explicit `null` for unknown fields — accept and strip. */
const demoOptionalString = z.string().nullish().transform((v) => v ?? undefined);

const demoStageSchema = z
  .string()
  .transform((s) => normalizeDemoStage(s))
  .pipe(z.enum(SALES_DEMO_STAGES));

export const demoWorkflowInputSchema = z.object({
  organizationId: z.string().min(1),
  demoSessionId: z.string().min(1),
  agentId: z.string().min(1),
  leadId: z.string().optional().nullable(),
  customerMessage: z.string().min(1).max(8000),
  inputType: z.enum(["text", "voice"]).default("text"),
  participantRole: z.enum(["prospect", "staff", "agent"]).default("prospect"),
  transcriptSegment: z.string().max(8000).optional(),
  currentDemoStep: z.string().optional(),
  currentDemoAssetId: z.string().uuid().optional().nullable(),
  channel: z.literal("demo_call").default("demo_call"),
  /** LiveKit room AI presenter — uses voice-optimized system prompt */
  livekitAiVoice: z.boolean().optional(),
  customerMetadata: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      businessName: z.string().optional(),
      industry: z.string().optional(),
    })
    .optional(),
  /** Pre-loaded context for scheduled demos with linked lead */
  scheduledLeadContext: z.string().optional(),
  /** Force multi-agent specialist pipeline for this turn */
  multiAgentMode: z.boolean().optional(),
});

const objectionsField = z
  .union([z.array(z.string()), z.string(), z.null()])
  .nullish()
  .transform((v) => {
    if (v == null) return [] as string[];
    if (Array.isArray(v)) return v.filter(Boolean);
    return v
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  });

export const demoLeadUpdatesSchema = z.object({
  full_name: demoOptionalString,
  phone: demoOptionalString,
  email: demoOptionalString,
  business_name: demoOptionalString,
  industry: demoOptionalString,
  service_interest: demoOptionalString,
  main_goal: demoOptionalString,
  budget: demoOptionalString,
  timeline: demoOptionalString,
  authority: demoOptionalString,
  objections: objectionsField,
});

export const demoLeadScoreSchema = z.object({
  need: z.number().int().min(0),
  budget: z.number().int().min(0),
  authority: z.number().int().min(0),
  timeline: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const DEMO_LEAD_CATEGORY_LABELS = {
  hot: "Hot Lead",
  warm: "Warm Lead",
  cold: "Cold Lead",
  support: "Support Request",
  not_qualified: "Not Qualified",
} as const satisfies Record<LeadCategory, string>;

/** Structured sales demo output */
export const demoWorkflowResponseSchema = z.object({
  aiResponse: z.string(),
  aiVoiceText: z.string().optional(),
  demoStage: demoStageSchema,
  selectedDemoPathId: z.string().uuid().nullable(),
  currentDemoAssetId: z.string().uuid().nullable(),
  nextDemoAssetId: z.string().uuid().nullable(),
  detectedIntent: z.string(),
  leadUpdates: demoLeadUpdatesSchema,
  leadScore: demoLeadScoreSchema,
  leadCategory: z.enum([
    "Hot Lead",
    "Warm Lead",
    "Cold Lead",
    "Support Request",
    "Not Qualified",
  ]),
  bookingRecommended: z.boolean(),
  handoffRequired: z.boolean(),
  recommendedNextAction: z.string(),
  demoSummaryUpdate: z.string(),
  presentationAction: z
    .object({
      type: z.enum([
        "select_path",
        "show_asset",
        "next_asset",
        "previous_asset",
        "highlight_cta",
        "none",
      ]),
      demoPathId: z.string().uuid().nullable().optional(),
      demoAssetId: z.string().uuid().nullable().optional(),
      reason: z.string().optional(),
    })
    .optional(),
  pendingPresentationAction: z
    .object({
      type: z.string(),
      demoPathId: z.string().uuid().nullable().optional(),
      demoAssetId: z.string().uuid().nullable().optional(),
      reason: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export type DemoWorkflowResponse = z.infer<typeof demoWorkflowResponseSchema>;

export const demoAnalysisSchema = z.object({
  detected_intent: z.string().max(64),
  current_demo_stage: demoStageSchema,
  selected_demo_path_id: z.string().uuid().nullable().optional(),
  conversation_summary: z.string().max(600),
  recommended_next_action: z.string().max(300),
  next_asset_id: z.string().uuid().nullable().optional(),
  detected_objection_tags: z.array(z.string()).optional().default([]),
  lead_extraction: z.object({
    full_name: demoOptionalString,
    phone: demoOptionalString,
    email: demoOptionalString,
    business_name: demoOptionalString,
    industry: demoOptionalString,
    service_interest: demoOptionalString,
    main_goal: demoOptionalString,
    budget: demoOptionalString,
    timeline: demoOptionalString,
    authority: demoOptionalString,
    objections: demoOptionalString,
    preferred_contact_method: demoOptionalString,
  }),
  lead_scores: z.object({
    need: z.number().int().min(0).max(3),
    budget: z.number().int().min(0).max(3),
    authority: z.number().int().min(0).max(3),
    timeline: z.number().int().min(0).max(3),
  }),
  flags: z.object({
    human_requested: z.boolean(),
    serious_objection: z.boolean(),
    ready_to_book: z.boolean(),
    custom_pricing_requested: z.boolean().optional().default(false),
    complaint_detected: z.boolean().optional().default(false),
    outside_knowledge: z.boolean().optional().default(false),
    low_confidence: z.boolean().optional().default(false),
    asks_next_step: z.boolean().optional().default(false),
    requests_consultation: z.boolean().optional().default(false),
    ready_to_pay: z.boolean().optional().default(false),
    wants_final_confirmation: z.boolean().optional().default(false),
    wants_negotiation: z.boolean().optional().default(false),
  }),
  suggest_booking: z.boolean(),
  handoff_required: z.boolean(),
});

export type DemoAnalysis = z.infer<typeof demoAnalysisSchema>;
export type DemoWorkflowInput = z.infer<typeof demoWorkflowInputSchema>;

export function leadCategoryToDemoLabel(
  category: LeadCategory | string | null
): DemoWorkflowResponse["leadCategory"] {
  if (category === "hot") return "Hot Lead";
  if (category === "warm") return "Warm Lead";
  if (category === "cold") return "Cold Lead";
  if (category === "support") return "Support Request";
  if (category === "not_qualified") return "Not Qualified";
  return "Cold Lead";
}

export function parseObjectionsFromExtraction(
  objections: string | null | undefined
): string[] {
  if (!objections?.trim()) return [];
  return objections
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildDemoWorkflowResponse(params: {
  aiResponse: string;
  aiVoiceText?: string;
  analysis: DemoAnalysis;
  leadScore: WorkflowLeadScores;
  leadCategory: LeadCategory;
  bookingRecommended: boolean;
  handoffRequired: boolean;
  selectedDemoPathId: string | null;
  currentDemoAssetId: string | null;
  nextAssetId: string | null;
  presentationAction?: DemoWorkflowResponse["presentationAction"];
  pendingPresentationAction?: DemoWorkflowResponse["pendingPresentationAction"];
}): DemoWorkflowResponse {
  const { analysis, leadScore, leadCategory } = params;
  const ext = analysis.lead_extraction;
  return demoWorkflowResponseSchema.parse({
    aiResponse: params.aiResponse,
    aiVoiceText: params.aiVoiceText,
    demoStage: analysis.current_demo_stage,
    selectedDemoPathId: params.selectedDemoPathId,
    currentDemoAssetId: params.currentDemoAssetId,
    nextDemoAssetId: params.nextAssetId,
    detectedIntent: analysis.detected_intent,
    leadUpdates: {
      full_name: ext.full_name ?? null,
      phone: ext.phone ?? null,
      email: ext.email ?? null,
      business_name: ext.business_name ?? null,
      industry: ext.industry ?? null,
      service_interest: ext.service_interest ?? null,
      main_goal: ext.main_goal ?? null,
      budget: ext.budget ?? null,
      timeline: ext.timeline ?? null,
      authority: ext.authority ?? null,
      objections: parseObjectionsFromExtraction(ext.objections),
    },
    leadScore,
    leadCategory: leadCategoryToDemoLabel(leadCategory),
    bookingRecommended: params.bookingRecommended,
    handoffRequired: params.handoffRequired,
    recommendedNextAction: analysis.recommended_next_action,
    demoSummaryUpdate: analysis.conversation_summary,
    presentationAction: params.presentationAction,
    pendingPresentationAction: params.pendingPresentationAction ?? null,
  });
}

export function hasEnoughLeadInfoForCreate(
  extraction: DemoAnalysis["lead_extraction"],
  customerMetadata?: DemoWorkflowInput["customerMetadata"]
): boolean {
  const name = extraction.full_name?.trim() || customerMetadata?.name?.trim();
  const contact =
    extraction.email?.trim() ||
    customerMetadata?.email?.trim() ||
    extraction.phone?.trim() ||
    customerMetadata?.phone?.trim();
  return Boolean(name && contact);
}

export function hasDemoLeadSignalForSync(
  extraction: DemoAnalysis["lead_extraction"],
  customerMetadata?: DemoWorkflowInput["customerMetadata"]
): boolean {
  return Boolean(
    extraction.service_interest?.trim() ||
    extraction.business_name?.trim() ||
    extraction.industry?.trim() ||
    customerMetadata?.businessName?.trim()
  );
}

export function mapDemoIntentToWorkflow(
  intent: string
): (typeof WORKFLOW_INTENTS)[number] | "general_enquiry" {
  const n = intent.toLowerCase();
  if (n.includes("pric")) return "pricing_question";
  if (n.includes("book")) return "booking_request";
  if (n.includes("support")) return "support_request";
  if (n.includes("complaint")) return "complaint";
  if (n.includes("human")) return "human_request";
  if (n.includes("sales")) return "sales_enquiry";
  return "general_enquiry";
}
