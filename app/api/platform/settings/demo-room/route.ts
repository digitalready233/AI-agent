import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import {
  getOrganizationSettings,
  patchOrganizationSettingsSection,
} from "@/lib/platform/settings-data";
import {
  getDemoProviderSettings,
  resolveDemoConnectionStatus,
} from "@/lib/demo/demo-provider";
import { isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";
import { isLiveKitEgressConfigured } from "@/lib/demo/demo-recording-settings";
import type { DemoProviderSettings } from "@/lib/platform/settings-types";
import { DEFAULT_MULTI_AGENT_DEMO_SETTINGS } from "@/lib/demo/multi-agent/types";

const patchSchema = z.object({
  provider: z.enum(["internal", "livekit_future", "daily_future", "zoom_future"]).optional(),
  default_demo_provider: z
    .enum(["internal", "livekit_future", "daily_future", "zoom_future"])
    .optional(),
  enable_voice_demo: z.boolean().optional(),
  enable_human_takeover: z.boolean().optional(),
  enable_recording_placeholder: z.boolean().optional(),
  enable_recording: z.boolean().optional(),
  auto_record_demos: z.boolean().optional(),
  record_only_with_consent: z.boolean().optional(),
  recording_provider: z.enum(["livekit_egress", "none"]).optional(),
  recording_storage_location: z.string().max(200).optional(),
  recording_retention_days: z.number().int().min(1).max(3650).optional(),
  recording_consent_message: z.string().max(500).optional(),
  auto_send_follow_up: z.boolean().optional(),
  enable_transcript: z.boolean().optional(),
  default_demo_agent_id: z.string().uuid().nullable().optional(),
  demo_session_timeout_minutes: z.number().int().min(15).max(480).optional(),
  demo_room_branding: z
    .object({
      primary_color: z.string().max(32).optional(),
      logo_url: z.string().url().optional().or(z.literal("")),
      welcome_title: z.string().max(120).optional(),
    })
    .optional(),
  ai_presenter: z
    .object({
      enable_ai_presenter: z.boolean().optional(),
      presenter_ui_mode: z
        .enum(["static_card", "animated_card", "avatar_future"])
        .optional(),
      default_avatar_url: z.string().url().optional().or(z.literal("")).nullable().optional(),
      show_waveform: z.boolean().optional(),
      show_demo_stage: z.boolean().optional(),
      show_demo_path: z.boolean().optional(),
      show_booking_badge: z.boolean().optional(),
      show_handoff_badge: z.boolean().optional(),
      brand_color: z.string().max(32).optional(),
      compact_mode: z.boolean().optional(),
    })
    .optional(),
  multi_agent: z
    .object({
      enabled: z.boolean().optional(),
      execution_mode: z.enum(["sequential", "parallel_future"]).optional(),
      save_internal_reasoning: z.boolean().optional(),
      show_team_analysis_to_admins: z.boolean().optional(),
      default_team: z.record(z.string().uuid().nullable()).optional(),
    })
    .optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");
  const settings = await getDemoProviderSettings(session.organization.id);
  return Response.json({
    settings,
    env: {
      livekit_configured: isLiveKitEnvConfigured(),
      livekit_egress_configured: isLiveKitEgressConfigured(),
      openai_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const org = await getOrganizationSettings(session.organization.id);
  const current = org.api_settings.demo_room ?? (await getDemoProviderSettings(session.organization.id));
  const next: DemoProviderSettings = {
    ...current,
    ...parsed.data,
    demo_room_branding: {
      ...current.demo_room_branding,
      ...(parsed.data.demo_room_branding ?? {}),
    },
    ai_presenter: parsed.data.ai_presenter
      ? { ...current.ai_presenter, ...parsed.data.ai_presenter }
      : current.ai_presenter,
    multi_agent: parsed.data.multi_agent
      ? {
          ...DEFAULT_MULTI_AGENT_DEMO_SETTINGS,
          ...(current.multi_agent ?? {}),
          ...parsed.data.multi_agent,
          default_team: {
            ...(current.multi_agent?.default_team ?? {}),
            ...(parsed.data.multi_agent.default_team ?? {}),
          },
        }
      : current.multi_agent,
    connection_status: "not_configured",
  };
  next.connection_status = resolveDemoConnectionStatus(next);

  const updated = await patchOrganizationSettingsSection(session.organization.id, "api_settings", {
    ...org.api_settings,
    demo_room: next,
  });

  return Response.json({
    settings: updated.api_settings.demo_room,
    env: {
      livekit_configured: isLiveKitEnvConfigured(),
      livekit_egress_configured: isLiveKitEgressConfigured(),
      openai_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
  });
}
