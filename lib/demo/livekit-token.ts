import { AccessToken } from "livekit-server-sdk";
import { isLiveKitEnvConfigured } from "./demo-provider";

export type DemoLiveKitRole = "prospect" | "staff" | "agent" | "ai_observer" | "ai_agent";

export function demoLiveKitRoomName(sessionId: string): string {
  return `demo-${sessionId}`;
}

export async function createDemoLiveKitToken(params: {
  sessionId: string;
  identity: string;
  name: string;
  role: DemoLiveKitRole;
  ttlSeconds?: number;
}): Promise<{ token: string; roomName: string; url: string } | null> {
  if (!isLiveKitEnvConfigured()) return null;

  const apiKey = process.env.LIVEKIT_API_KEY!.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET!.trim();
  const url = process.env.LIVEKIT_URL!.trim();
  const roomName = demoLiveKitRoomName(params.sessionId);

  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name,
    ttl: params.ttlSeconds ?? 3600,
    metadata: JSON.stringify({ role: params.role, demo_session_id: params.sessionId }),
  });

  const isObserver = params.role === "agent" || params.role === "ai_observer";
  const isAiAgent = params.role === "ai_agent";

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: isAiAgent || !isObserver,
    canSubscribe: true,
    canPublishData: isAiAgent || !isObserver,
  });

  if (params.role === "staff") {
    at.addGrant({ roomAdmin: true, canPublish: true });
  }

  return {
    token: await at.toJwt(),
    roomName,
    url,
  };
}
