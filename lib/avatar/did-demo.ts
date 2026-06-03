import { getAgent } from "@/lib/platform/data";
import {
  getOrganizationSecret,
  setOrganizationSecret,
} from "@/lib/platform/settings-data";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import type { DemoSession } from "@/lib/demo/types";
import { syncAiPresenterState } from "@/lib/demo/sync-ai-presenter";
import { buildAvatarContext, activateAvatarFallback } from "./avatar-session-service";
import { saveAvatarEvent } from "./avatar-events-data";
import { isAvatarProviderError } from "./errors";
import {
  createDidAgentStream,
  createDidClientKey,
  resolveDidAgentId,
} from "./did-api";
import { avatarSecretKey } from "./avatar-credentials";
import type { AvatarSessionStatus } from "./types";

function maskClientKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

async function ensureDidClientKey(
  ctx: Awaited<ReturnType<typeof buildAvatarContext>>
): Promise<string> {
  const secretKey = avatarSecretKey("did", "client_key");
  const existing = await getOrganizationSecret(ctx.organizationId, secretKey);
  if (existing?.trim()) return existing.trim();

  const created = await createDidClientKey(ctx);
  await setOrganizationSecret(ctx.organizationId, secretKey, created.client_key);
  return created.client_key;
}

export type StartDidSessionForDemoResult = {
  session: DemoSession;
  agent_id: string;
  client_key: string;
  stream_id: string | null;
  mode: "sdk" | "stream";
};

export async function startDidSessionForDemo(params: {
  demoSessionId: string;
  organizationId: string;
  agentId?: string | null;
  useServerStream?: boolean;
}): Promise<StartDidSessionForDemoResult> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.organizationId) {
    throw new Error("Demo session not found");
  }

  const agent = params.agentId
    ? await getAgent(params.agentId)
    : session.agent_id
      ? await getAgent(session.agent_id)
      : null;
  if (!agent) throw new Error("Agent not found");

  const ctx = await buildAvatarContext(session, agent);
  const didAgentId = resolveDidAgentId(ctx);
  const now = new Date().toISOString();

  let updated = await saveDemoSession({
    ...session,
    avatar_provider: "did",
    avatar_status: "starting" as AvatarSessionStatus,
    avatar_error: null,
    avatar_started_at: session.avatar_started_at ?? now,
    did_agent_id: didAgentId,
    metadata: {
      ...(session.metadata ?? {}),
      avatar_last_event: "did_session_started",
    },
  });

  await saveAvatarEvent({
    organization_id: updated.organization_id,
    demo_session_id: updated.id,
    provider: "did",
    event_type: "did_session_started",
    payload: { agent_id: didAgentId },
  });

  try {
    const clientKey = await ensureDidClientKey(ctx);
    let streamId: string | null = null;
    let chatId: string | null = null;
    let mode: "sdk" | "stream" = "sdk";

    if (params.useServerStream) {
      const stream = await createDidAgentStream(ctx);
      streamId = stream.streamId;
      chatId = stream.sessionId;
      mode = "stream";
    }

    updated = await saveDemoSession({
      ...updated,
      avatar_session_id: streamId ?? `did-sdk-${updated.id}`,
      avatar_provider: "did",
      avatar_status: "starting",
      avatar_error: null,
      did_agent_id: didAgentId,
      did_stream_id: streamId,
      did_session_id: chatId ?? streamId,
      metadata: {
        ...(updated.metadata ?? {}),
        did_client_key_masked: maskClientKey(clientKey),
        did_mode: mode,
        avatar_last_event: "did_session_started",
      },
    });

    return {
      session: updated,
      agent_id: didAgentId,
      client_key: clientKey,
      stream_id: streamId,
      mode,
    };
  } catch (err) {
    const message = isAvatarProviderError(err)
      ? err.message
      : err instanceof Error
        ? err.message
        : "D-ID session failed";
    const failed = await activateAvatarFallback(updated, message);
    await saveAvatarEvent({
      organization_id: failed.organization_id,
      demo_session_id: failed.id,
      provider: "did",
      event_type: "did_session_failed",
      payload: { error: message },
    });
    throw new Error(message);
  }
}

export async function getDidSessionCredentialsForDemo(params: {
  demoSessionId: string;
  organizationId: string;
  agent: NonNullable<Awaited<ReturnType<typeof getAgent>>>;
}): Promise<{ agent_id: string; client_key: string }> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.organizationId) {
    throw new Error("Demo session not found");
  }

  const ctx = await buildAvatarContext(session, params.agent);
  const clientKey = await ensureDidClientKey(ctx);
  const agentId = session.did_agent_id ?? resolveDidAgentId(ctx);
  return { agent_id: agentId, client_key: clientKey };
}

export async function markDidAvatarConnected(params: {
  demoSessionId: string;
  organizationId: string;
  streamId?: string | null;
  chatId?: string | null;
}): Promise<DemoSession> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.organizationId) {
    throw new Error("Demo session not found");
  }

  const streamId = params.streamId ?? session.did_stream_id ?? session.avatar_session_id;
  const updated = await saveDemoSession({
    ...session,
    avatar_status: "active",
    avatar_session_id: streamId ?? session.avatar_session_id,
    did_stream_id: params.streamId ?? session.did_stream_id,
    did_session_id: params.chatId ?? params.streamId ?? session.did_session_id,
    avatar_error: null,
    metadata: {
      ...(session.metadata ?? {}),
      avatar_last_event: "did_avatar_connected",
    },
  });

  await saveAvatarEvent({
    organization_id: updated.organization_id,
    demo_session_id: updated.id,
    provider: "did",
    event_type: "did_avatar_connected",
    payload: {
      stream_id: params.streamId,
      chat_id: params.chatId,
    },
  });

  await syncAiPresenterState({
    session: updated,
    state: "listening",
    recordEvent: false,
  });

  return updated;
}

export async function sendDidMessageForDemo(params: {
  demoSessionId: string;
  organizationId: string;
  text: string;
}): Promise<DemoSession> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.organizationId) {
    throw new Error("Demo session not found");
  }
  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent) throw new Error("Agent not found");

  const ctx = await buildAvatarContext(session, agent);
  const streamId = session.did_stream_id ?? session.avatar_session_id;
  if (!streamId || streamId.startsWith("did-sdk-")) {
    await saveAvatarEvent({
      organization_id: session.organization_id,
      demo_session_id: session.id,
      provider: "did",
      event_type: "did_message_sent",
      payload: { textLength: params.text.length, mode: "sdk_pending" },
    });
    return saveDemoSession({
      ...session,
      avatar_status: "speaking",
      metadata: {
        ...(session.metadata ?? {}),
        did_pending_speech: params.text,
      },
    });
  }

  const { sendDidAgentChatMessage, sendDidStreamScript } = await import("./did-api");
  try {
    await sendDidAgentChatMessage(ctx, streamId, params.text, "assistant");
  } catch {
    await sendDidStreamScript(ctx, streamId, params.text);
  }

  const updated = await saveDemoSession({
    ...session,
    avatar_status: "speaking",
    metadata: { ...(session.metadata ?? {}), avatar_last_event: "did_message_sent" },
  });

  await saveAvatarEvent({
    organization_id: updated.organization_id,
    demo_session_id: updated.id,
    provider: "did",
    event_type: "did_message_sent",
    payload: { textLength: params.text.length },
  });

  await saveAvatarEvent({
    organization_id: updated.organization_id,
    demo_session_id: updated.id,
    provider: "did",
    event_type: "did_avatar_speaking",
    payload: {},
  });

  return updated;
}
