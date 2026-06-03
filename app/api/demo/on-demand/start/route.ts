import { headers } from "next/headers";
import { z } from "zod";
import { getAgent } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { saveDemoSession } from "@/lib/demo/demo-data";
import { ensureDemoExperienceForAgent } from "@/lib/demo/ensure-demo-setup";
import {
  getDemoProviderSettings,
  isLiveKitEnvConfigured,
  orgLiveKitVideoEnabled,
} from "@/lib/demo/demo-provider";
import { demoLiveKitRoomName } from "@/lib/demo/livekit-token";
import type { DemoSession } from "@/lib/demo/types";

const bodySchema = z.object({
  agent_id: z.string().uuid(),
  organization_id: z.string().uuid().optional(),
  visitor_name: z.string().max(120).optional(),
  visitor_email: z.string().email().optional(),
});

/**
 * On-demand demo entry: website visitor starts an AI demo immediately.
 */
export async function POST(req: Request) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return withPlatformAdmin(async () => {
    const agent = await getAgent(parsed.data.agent_id);
    if (!agent?.enabled) {
      return Response.json({ error: "Demo agent not available" }, { status: 404 });
    }
    if (
      parsed.data.organization_id &&
      parsed.data.organization_id !== agent.organization_id
    ) {
      return Response.json({ error: "Organization mismatch" }, { status: 400 });
    }

    await ensureDemoExperienceForAgent({
      organizationId: agent.organization_id,
      agentId: agent.id,
    });

    const providerSettings = await getDemoProviderSettings(agent.organization_id);
    const useLiveKit = orgLiveKitVideoEnabled(providerSettings);

    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const session: DemoSession = {
      id: sessionId,
      organization_id: agent.organization_id,
      agent_id: agent.id,
      lead_id: null,
      conversation_id: null,
      booking_id: null,
      title: "Live AI Demo",
      demo_type: "on_demand",
      status: "waiting",
      current_demo_stage: "welcome",
      entry_mode: "on_demand",
      demo_path_id: null,
      current_demo_asset_id: null,
      objections: [],
      qualification_progress: { need: false, budget: false, authority: false, timeline: false },
      started_at: null,
      ended_at: null,
      duration_seconds: null,
      summary: null,
      transcript: null,
      detected_intent: null,
      lead_score: null,
      lead_category: null,
      handoff_required: false,
      booking_recommended: false,
      recommended_next_action: null,
      recording_url: null,
      livekit_room_name: useLiveKit ? demoLiveKitRoomName(sessionId) : null,
      livekit_room_status: useLiveKit ? "not_created" : "not_created",
      video_provider: useLiveKit ? "livekit" : "internal",
      video_enabled: useLiveKit,
      audio_enabled: true,
      screen_share_enabled: false,
      recording_enabled: false,
      room_started_at: null,
      room_ended_at: null,
      metadata: {
        visitor_name: parsed.data.visitor_name,
        visitor_email: parsed.data.visitor_email,
        room_url: "",
        video_providers: ["livekit", "daily", "zoom", "agora"],
        livekit_configured: isLiveKitEnvConfigured(),
      },
      created_at: now,
      updated_at: now,
    };

    const roomPath = `/demo-room/${session.id}`;
    session.metadata = { ...session.metadata, room_url: roomPath };
    let saved = await saveDemoSession(session);
    const { getMultiAgentDemoSettings } = await import(
      "@/lib/demo/multi-agent/settings"
    );
    const { setupMultiAgentDemoSession } = await import(
      "@/lib/demo/multi-agent/session-setup"
    );
    const { applyAvatarProviderToDemoSession } = await import(
      "@/lib/avatar/apply-demo-avatar-selection"
    );
    const multiSettings = await getMultiAgentDemoSettings(agent.organization_id);
    if (multiSettings.enabled) {
      saved = await setupMultiAgentDemoSession(saved);
    }
    saved = await applyAvatarProviderToDemoSession(saved);

    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    const shareUrl = host ? `${proto}://${host}${roomPath}` : roomPath;

    return Response.json({
      session: saved,
      room_url: roomPath,
      share_url: shareUrl,
      entry_mode: "on_demand",
    });
  });
}
