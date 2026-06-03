import { WebhookReceiver } from "livekit-server-sdk";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import { recordDemoRoomEvent } from "@/lib/demo/demo-room-events-data";
import { demoLiveKitRoomName } from "@/lib/demo/livekit-token";
import { isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";
import type { DemoRoomEventType } from "@/lib/demo/types";

function sessionIdFromRoomName(roomName: string): string | null {
  if (roomName.startsWith("demo-")) {
    const id = roomName.slice(5);
    if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  }
  return null;
}

function mapWebhookEvent(event: string): DemoRoomEventType | null {
  switch (event) {
    case "participant_joined":
      return "participant_joined";
    case "participant_left":
      return "participant_left";
    case "track_published":
      return "track_published";
    case "track_unpublished":
      return "track_unpublished";
    case "room_finished":
      return "room_ended";
    default:
      return null;
  }
}

export async function POST(req: Request) {
  if (!isLiveKitEnvConfigured()) {
    return Response.json({ error: "LiveKit not configured" }, { status: 503 });
  }

  const body = await req.text();
  const auth = req.headers.get("authorization") ?? "";

  const receiver = new WebhookReceiver(
    process.env.LIVEKIT_API_KEY!.trim(),
    process.env.LIVEKIT_API_SECRET!.trim()
  );

  let event;
  try {
    event = await receiver.receive(body, auth);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid webhook" },
      { status: 401 }
    );
  }

  const roomName = event.room?.name ?? "";
  const sessionId = sessionIdFromRoomName(roomName);
  if (!sessionId) {
    return Response.json({ ok: true, ignored: true });
  }

  const session = await getDemoSession(sessionId);
  if (!session) {
    return Response.json({ ok: true, ignored: true });
  }

  const mapped = mapWebhookEvent(event.event);
  if (mapped) {
    const meta = event.participant?.metadata
      ? (() => {
          try {
            return JSON.parse(event.participant.metadata) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : {};

    await recordDemoRoomEvent({
      demoSessionId: sessionId,
      organizationId: session.organization_id,
      eventType: mapped,
      participantIdentity: event.participant?.identity ?? null,
      participantRole:
        (meta.role as "prospect" | "staff" | "ai_observer") ?? null,
      metadata: {
        livekit_event: event.event,
        room: roomName,
      },
    });

    if (event.event === "participant_joined") {
      await saveDemoSession({
        ...session,
        livekit_room_status: "active",
        livekit_room_name: session.livekit_room_name ?? demoLiveKitRoomName(sessionId),
        room_started_at: session.room_started_at ?? new Date().toISOString(),
      });
    }

    if (event.event === "room_finished") {
      await saveDemoSession({
        ...(await getDemoSession(sessionId))!,
        livekit_room_status: "ended",
        room_ended_at: new Date().toISOString(),
      });
    }
  }

  return Response.json({ ok: true });
}
