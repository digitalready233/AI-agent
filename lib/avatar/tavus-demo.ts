import { getAgent } from "@/lib/platform/data";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import type { DemoSession } from "@/lib/demo/types";
import { syncAiPresenterState } from "@/lib/demo/sync-ai-presenter";
import { buildAvatarContext, activateAvatarFallback } from "./avatar-session-service";
import { saveAvatarEvent } from "./avatar-events-data";
import { isAvatarProviderError } from "./errors";
import { createTavusConversation } from "./tavus-cvi";
import type { AvatarSessionStatus } from "./types";

export type CreateTavusConversationForDemoResult = {
  session: DemoSession;
  conversation_id: string;
  conversation_url: string;
  replica_id: string;
  persona_id: string;
};

export async function createTavusConversationForDemo(params: {
  demoSessionId: string;
  organizationId: string;
  agentId?: string | null;
  conversationalContext?: string;
  customGreeting?: string;
}): Promise<CreateTavusConversationForDemoResult> {
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
  const now = new Date().toISOString();

  let updated = await saveDemoSession({
    ...session,
    avatar_provider: "tavus",
    avatar_status: "starting" as AvatarSessionStatus,
    avatar_error: null,
    avatar_started_at: session.avatar_started_at ?? now,
    metadata: {
      ...(session.metadata ?? {}),
      avatar_last_event: "tavus_avatar_starting",
    },
  });

  await saveAvatarEvent({
    organization_id: updated.organization_id,
    demo_session_id: updated.id,
    provider: "tavus",
    event_type: "tavus_avatar_starting",
    payload: {},
  });

  try {
    const created = await createTavusConversation({
      ctx,
      conversationalContext: params.conversationalContext,
      customGreeting: params.customGreeting,
    });

    updated = await saveDemoSession({
      ...updated,
      avatar_session_id: created.conversationId,
      avatar_provider: "tavus",
      avatar_status: "active",
      avatar_stream_url: created.conversationUrl,
      avatar_join_url: created.conversationUrl,
      avatar_error: null,
      tavus_conversation_id: created.conversationId,
      tavus_conversation_url: created.conversationUrl,
      tavus_replica_id: created.replicaId ?? ctx.agent.avatar_replica_id ?? null,
      tavus_persona_id: created.personaId ?? ctx.agent.avatar_persona_id ?? null,
      metadata: {
        ...(updated.metadata ?? {}),
        avatar_last_event: "tavus_conversation_created",
      },
    });

    await saveAvatarEvent({
      organization_id: updated.organization_id,
      demo_session_id: updated.id,
      provider: "tavus",
      event_type: "tavus_conversation_created",
      payload: {
        conversation_id: created.conversationId,
        conversation_url: created.conversationUrl,
        replica_id: created.replicaId,
        persona_id: created.personaId,
      },
    });

    await saveAvatarEvent({
      organization_id: updated.organization_id,
      demo_session_id: updated.id,
      provider: "tavus",
      event_type: "tavus_avatar_active",
      payload: { conversation_id: created.conversationId },
    });

    await syncAiPresenterState({
      session: updated,
      state: "listening",
      recordEvent: false,
    });

    const replicaId =
      created.replicaId ??
      ctx.agent.avatar_replica_id ??
      ctx.agent.avatar_id ??
      "";
    const personaId = created.personaId ?? ctx.agent.avatar_persona_id ?? "";

    return {
      session: updated,
      conversation_id: created.conversationId,
      conversation_url: created.conversationUrl!,
      replica_id: replicaId,
      persona_id: personaId,
    };
  } catch (err) {
    const message = isAvatarProviderError(err)
      ? err.message
      : err instanceof Error
        ? err.message
        : "Tavus conversation failed";
    const failed = await activateAvatarFallback(updated, message);
    await saveAvatarEvent({
      organization_id: failed.organization_id,
      demo_session_id: failed.id,
      provider: "tavus",
      event_type: "tavus_avatar_failed",
      payload: { error: message },
    });
    throw new Error(message);
  }
}
