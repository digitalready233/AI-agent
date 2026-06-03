import { z } from "zod";

const avatarProviderEnum = z.enum([
  "internal_card",
  "tavus",
  "did",
  "heygen",
  "custom_future",
]);

function normalizeOptionalUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return undefined;
  }
}

/** Validates agent create/update payloads from the dashboard form. */
export const agentFieldsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Agent name is required"),
  agent_type: z.enum(["sales", "support", "demo", "booking", "onboarding"]),
  operational_role: z
    .enum([
      "general_sales",
      "demo_presenter",
      "lead_qualification",
      "objection_handling",
      "booking",
      "crm_summary",
      "handoff",
      "follow_up",
    ])
    .optional(),
  nickname: z.string().optional(),
  company_product_name: z.string().optional(),
  position: z.string().optional(),
  language: z.string().min(1).optional(),
  tone: z.string().optional(),
  timezone: z.string().optional(),
  voice: z.string().optional(),
  voice_speed: z.coerce.number().min(0.25).max(4).optional(),
  welcome_message: z.string().optional(),
  system_prompt: z.string().optional(),
  qualification_prompt: z.string().optional(),
  objection_prompt: z.string().optional(),
  handoff_rules: z.string().optional(),
  booking_rules: z.string().optional(),
  crm_update_rules: z.string().optional(),
  lead_scoring_rules: z.string().optional(),
  fallback_response: z.string().optional(),
  status: z.enum(["active", "paused", "draft"]).optional(),
  channels: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  knowledge_base_ids: z.array(z.string()).optional(),
  avatar_provider: avatarProviderEnum.nullish(),
  avatar_id: z.string().nullable().optional(),
  avatar_replica_id: z.string().nullable().optional(),
  avatar_persona_id: z.string().nullable().optional(),
  avatar_voice_id: z.string().nullable().optional(),
  avatar_style: z.string().nullable().optional(),
  avatar_enabled: z.boolean().optional(),
  avatar_fallback_mode: z.string().optional(),
  avatar_provider_mode: z.enum(["org_default", "fixed", "smart_routing"]).optional(),
  avatar_preferred_provider: avatarProviderEnum.nullish(),
  avatar_allow_auto_switch: z.boolean().optional(),
  presenter_config: z
    .object({
      avatar_url: z.preprocess((val) => {
        const normalized = normalizeOptionalUrl(val);
        if (normalized === undefined) return null;
        return normalized;
      }, z.string().url().nullable().optional()),
      display_name: z.string().max(120).nullish(),
      role_title: z.string().max(120).nullish(),
      style: z.string().max(64).nullish(),
      welcome_phrase: z.string().max(500).nullish(),
      voice_sync_enabled: z.boolean().optional(),
      fallback_initials: z.string().max(8).nullish(),
    })
    .nullish(),
});

export function formatAgentApiValidationError(
  error: z.ZodError | { fieldErrors: Record<string, string[]>; formErrors: string[] }
): string {
  if (error instanceof z.ZodError) {
    const parts = error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "request";
      return `${path}: ${issue.message}`;
    });
    if (parts.length > 0) return parts.join(" · ");
  }

  const flat = error instanceof z.ZodError ? error.flatten() : error;
  const parts: string[] = [...(flat.formErrors ?? [])];
  for (const [field, messages] of Object.entries(flat.fieldErrors ?? {})) {
    for (const msg of messages ?? []) {
      parts.push(`${field}: ${msg}`);
    }
  }
  if (parts.length === 0) return "Please check required fields";
  return parts.join(" · ");
}
