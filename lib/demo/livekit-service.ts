import { RoomServiceClient } from "livekit-server-sdk";
import { getSessionContext } from "@/lib/platform/auth";
import type { SessionContext } from "@/lib/platform/types";
import { canJoinLiveDemo } from "./demo-takeover-permissions";
import {
  createDemoLiveKitToken,
  demoLiveKitRoomName,
  type DemoLiveKitRole,
} from "./livekit-token";
import { getDemoSession, saveDemoSession } from "./demo-data";
import { recordDemoRoomEvent } from "./demo-room-events-data";
import {
  effectiveDemoProvider,
  getDemoProviderSettings,
  isDemoSessionExpired,
  isLiveKitEnvConfigured,
} from "./demo-provider";
import { isDemoRoomAiEnabled } from "./config";
import type { DemoSession, LiveKitRoomStatus, VideoProvider } from "./types";
import { listDemoParticipants } from "./demo-data";

function liveKitClient(): RoomServiceClient | null {
  if (!isLiveKitEnvConfigured()) return null;
  const host = process.env.LIVEKIT_URL!.trim().replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return new RoomServiceClient(host, process.env.LIVEKIT_API_KEY!.trim(), process.env.LIVEKIT_API_SECRET!.trim());
}

export function resolveSessionVideoProvider(session: DemoSession): VideoProvider {
  if (session.video_provider === "livekit") return "livekit";
  if (isLiveKitEnvConfigured() && (session.video_enabled || session.livekit_room_name)) {
    return "livekit";
  }
  return "internal";
}

export function shouldUseLiveKitVideo(session: DemoSession): boolean {
  if (!isLiveKitEnvConfigured()) return false;
  if (session.video_provider === "livekit") return true;
  if (session.video_enabled && session.livekit_room_name) return true;
  if (session.livekit_room_status && session.livekit_room_status !== "not_created") {
    return true;
  }
  return resolveSessionVideoProvider(session) === "livekit";
}

export async function ensureLiveKitRoomForSession(
  sessionId: string,
  opts?: { createdBy?: string }
): Promise<{ session: DemoSession; roomName: string; created: boolean }> {
  const session = await getDemoSession(sessionId);
  if (!session) throw new Error("Demo session not found");
  if (!isLiveKitEnvConfigured()) throw new Error("LiveKit is not configured");

  const roomName = session.livekit_room_name ?? demoLiveKitRoomName(sessionId);
  const now = new Date().toISOString();
  let created = false;

  if (!session.livekit_room_name || session.livekit_room_status === "not_created") {
    const client = liveKitClient();
    if (client) {
      try {
        await client.createRoom({
          name: roomName,
          emptyTimeout: 60 * 15,
          maxParticipants: 12,
          metadata: JSON.stringify({
            demo_session_id: sessionId,
            organization_id: session.organization_id,
          }),
        });
        created = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes("already exists")) {
          await saveDemoSession({
            ...session,
            livekit_room_status: "failed",
            video_provider: "livekit",
          });
          throw new Error(`LiveKit room creation failed: ${msg}`);
        }
      }
    }

    await recordDemoRoomEvent({
      demoSessionId: sessionId,
      organizationId: session.organization_id,
      eventType: "room_created",
      metadata: { room_name: roomName, created_by: opts?.createdBy },
    });
  }

  const updated = await saveDemoSession({
    ...(await getDemoSession(sessionId))!,
    livekit_room_name: roomName,
    livekit_room_status: "created" as LiveKitRoomStatus,
    video_provider: "livekit",
    video_enabled: true,
    audio_enabled: session.audio_enabled ?? true,
    screen_share_enabled: session.screen_share_enabled ?? false,
    recording_enabled: session.recording_enabled ?? false,
    metadata: {
      ...(session.metadata ?? {}),
      livekit_configured: true,
    },
  });

  return { session: updated, roomName, created };
}

export async function issueLiveKitParticipantToken(params: {
  sessionId: string;
  identity: string;
  name: string;
  role: DemoLiveKitRole | "ai_observer";
  ensureRoom?: boolean;
}): Promise<{
  url: string;
  token: string;
  roomName: string;
  identity: string;
  role: string;
  livekit_room_status: string;
}> {
  if (!isLiveKitEnvConfigured()) {
    throw new Error("LiveKit is not configured");
  }

  let session = await getDemoSession(params.sessionId);
  if (!session) throw new Error("Demo session not found");

  if (isDemoSessionExpired({
    startedAt: session.started_at,
    createdAt: session.created_at,
    timeoutMinutes: (await getDemoProviderSettings(session.organization_id))
      .demo_session_timeout_minutes,
  })) {
    throw new Error("Demo session has expired");
  }

  if (params.ensureRoom !== false) {
    const ensured = await ensureLiveKitRoomForSession(params.sessionId);
    session = ensured.session;
  }

  const tokenResult = await createDemoLiveKitToken({
    sessionId: params.sessionId,
    identity: params.identity,
    name: params.name,
    role: params.role as DemoLiveKitRole,
    ttlSeconds: 3600,
  });

  if (!tokenResult) throw new Error("Failed to generate LiveKit token");

  const eventType =
    params.role === "staff"
      ? "staff_joined"
      : params.role === "ai_observer"
        ? "ai_joined"
        : "participant_joined";

  await recordDemoRoomEvent({
    demoSessionId: params.sessionId,
    organizationId: session.organization_id,
    eventType,
    participantIdentity: params.identity,
    participantRole: params.role === "agent" ? "agent" : params.role,
    metadata: { name: params.name },
  });

  if (session.livekit_room_status === "created") {
    await saveDemoSession({
      ...session,
      livekit_room_status: "active",
      room_started_at: session.room_started_at ?? new Date().toISOString(),
      status:
        session.status === "scheduled" || session.status === "waiting"
          ? "in_progress"
          : session.status,
      started_at: session.started_at ?? new Date().toISOString(),
    });
    session = (await getDemoSession(params.sessionId))!;
  }

  return {
    url: tokenResult.url,
    token: tokenResult.token,
    roomName: tokenResult.roomName,
    identity: params.identity,
    role: params.role,
    livekit_room_status: session.livekit_room_status ?? "active",
  };
}

export async function endLiveKitRoomForSession(
  sessionId: string,
  opts?: { endedBy?: string }
): Promise<DemoSession> {
  const session = await getDemoSession(sessionId);
  if (!session) throw new Error("Demo session not found");

  const roomName = session.livekit_room_name ?? demoLiveKitRoomName(sessionId);
  const client = liveKitClient();
  if (client && session.livekit_room_status !== "ended") {
    try {
      await client.deleteRoom(roomName);
    } catch {
      /* room may already be gone */
    }
  }

  const now = new Date().toISOString();
  await recordDemoRoomEvent({
    demoSessionId: sessionId,
    organizationId: session.organization_id,
    eventType: "room_ended",
    metadata: { ended_by: opts?.endedBy, room_name: roomName },
  });

  return saveDemoSession({
    ...session,
    livekit_room_status: "ended",
    room_ended_at: now,
  });
}

export async function getLiveKitRoomStatusPayload(sessionId: string) {
  const session = await getDemoSession(sessionId);
  if (!session) return null;

  const participants = await listDemoParticipants(sessionId);
  const providerSettings = await getDemoProviderSettings(session.organization_id);

  return {
    session_id: session.id,
    status: session.status,
    video_provider: resolveSessionVideoProvider(session),
    livekit_configured: isLiveKitEnvConfigured(),
    livekit_room_name: session.livekit_room_name,
    livekit_room_status: session.livekit_room_status ?? "not_created",
    video_enabled: session.video_enabled ?? false,
    audio_enabled: session.audio_enabled ?? true,
    screen_share_enabled: session.screen_share_enabled ?? false,
    recording_enabled: session.recording_enabled ?? false,
    recording_url: session.recording_url,
    room_started_at: session.room_started_at,
    room_ended_at: session.room_ended_at,
    handoff_required: session.handoff_required,
    handoff_status: session.handoff_status,
    ai_paused: session.ai_paused,
    participants: participants.map((p) => ({
      id: p.id,
      role: p.role,
      display_name: p.display_name,
      joined_at: p.joined_at,
      left_at: p.left_at,
    })),
    ai_enabled: isDemoRoomAiEnabled(),
    internal_fallback: !shouldUseLiveKitVideo(session),
  };
}

export async function assertStaffCanManageLiveKit(
  ctx: SessionContext,
  session: DemoSession
): Promise<void> {
  if (!canJoinLiveDemo(ctx.profile.role, session)) {
    throw new Error("You do not have permission to manage this live demo room");
  }
  if (session.organization_id !== ctx.organization.id) {
    throw new Error("Demo not found");
  }
}

export async function assertProspectCanJoin(sessionId: string): Promise<DemoSession> {
  const session = await getDemoSession(sessionId);
  if (!session) throw new Error("Demo not found");
  if (["completed", "cancelled", "missed"].includes(session.status)) {
    throw new Error("Demo has ended");
  }
  return session;
}
