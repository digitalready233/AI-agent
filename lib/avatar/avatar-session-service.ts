import type { Agent } from "@/lib/platform/types";
import { getAgent } from "@/lib/platform/data";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import { isDemoAiPaused } from "@/lib/demo/demo-live-handoff";
import type { DemoSession } from "@/lib/demo/types";
import { syncAiPresenterState } from "@/lib/demo/sync-ai-presenter";
import { loadAvatarProviderCredentials } from "./avatar-credentials";
import { getAvatarIntegration } from "./avatar-integrations-data";
import { saveAvatarEvent } from "./avatar-events-data";
import { isAvatarProviderError } from "./errors";
import { getAvatarProvider, isExternalAvatarProvider } from "./registry";
import { selectAvatarProvider } from "./select-avatar-provider";
import { activateSmartAvatarFallback } from "./smart-fallback";
import { recordAvatarProviderMetric } from "./provider-metrics-data";
import type {
  AvatarAgentConfig,
  AvatarProviderId,
  AvatarSessionContext,
  AvatarSessionStatus,
} from "./types";

export async function resolveAgentProvider(
  agent: Agent,
  session?: DemoSession | null
): Promise<AvatarProviderId> {
  if (!agent.avatar_enabled) return "internal_card";
  if (session?.avatar_provider) {
    return session.avatar_provider as AvatarProviderId;
  }
  const selection = await selectAvatarProvider({
    organizationId: agent.organization_id,
    agentId: agent.id,
    demoSessionId: session?.id,
    demoPathId: session?.demo_path_id,
    leadId: session?.lead_id,
    demoType: session?.demo_type,
    agent,
  });
  return selection.provider;
}

export async function buildAvatarContext(
  session: DemoSession,
  agent: Agent
): Promise<AvatarSessionContext> {
  const provider = await resolveAgentProvider(agent, session);
  const integration =
    provider !== "internal_card"
      ? await getAvatarIntegration(session.organization_id, provider)
      : null;
  const credentials = await loadAvatarProviderCredentials(
    session.organization_id,
    provider,
    integration ?? undefined
  );
  return {
    organizationId: session.organization_id,
    demoSessionId: session.id,
    agent: {
      id: agent.id,
      name: agent.name,
      avatar_provider: agent.avatar_provider,
      avatar_id: agent.avatar_id,
      avatar_replica_id: agent.avatar_replica_id,
      avatar_persona_id: agent.avatar_persona_id,
      avatar_voice_id: agent.avatar_voice_id,
      avatar_style: agent.avatar_style,
      avatar_enabled: agent.avatar_enabled,
      avatar_fallback_mode: agent.avatar_fallback_mode,
    },
    integration,
    credentials,
    config: integration?.config ?? {},
  };
}

async function persistAvatarSession(
  session: DemoSession,
  patch: Partial<DemoSession> & {
    avatar_status?: AvatarSessionStatus;
    eventType?: string;
    eventPayload?: Record<string, unknown>;
  }
): Promise<DemoSession> {
  const now = new Date().toISOString();
  const updated = await saveDemoSession({
    ...session,
    ...patch,
    avatar_status: patch.avatar_status ?? session.avatar_status,
    avatar_provider: patch.avatar_provider ?? session.avatar_provider,
    metadata: {
      ...(session.metadata ?? {}),
      avatar_last_event: patch.eventType ?? null,
    },
  });

  if (patch.eventType) {
    await saveAvatarEvent({
      organization_id: updated.organization_id,
      demo_session_id: updated.id,
      provider: updated.avatar_provider ?? "internal_card",
      event_type: patch.eventType,
      payload: patch.eventPayload ?? {},
    });
  }

  return updated;
}

export async function activateAvatarFallback(
  session: DemoSession,
  reason: string
): Promise<DemoSession> {
  return activateSmartAvatarFallback(session, reason);
}

export async function startAvatarSessionForDemo(params: {
  demoSessionId: string;
  organizationId: string;
  agentId?: string | null;
}): Promise<DemoSession> {
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

  const selection = await selectAvatarProvider({
    organizationId: params.organizationId,
    agentId: agent.id,
    demoSessionId: session.id,
    demoPathId: session.demo_path_id,
    leadId: session.lead_id,
    demoType: session.demo_type,
    agent,
  });
  const provider = selection.provider;
  const startMs = Date.now();

  let working = await persistAvatarSession(session, {
    avatar_provider: provider,
    avatar_fallback_provider: selection.fallbackProvider,
    avatar_routing_rule_id: selection.routingRuleId ?? null,
    avatar_status: "starting",
    eventType: "avatar_provider_selected",
    eventPayload: {
      source: selection.source,
      fallback: selection.fallbackProvider,
    },
  });

  if (!isExternalAvatarProvider(provider)) {
    const done = await persistAvatarSession(working, {
      avatar_provider: "internal_card",
      avatar_status: "active",
      eventType: "internal_presenter_active",
    });
    await recordAvatarProviderMetric({
      organization_id: done.organization_id,
      provider: "internal_card",
      demo_session_id: done.id,
      status: "session_started",
      start_time_ms: Date.now() - startMs,
      lead_category: done.lead_category ?? null,
      human_handoff: done.handoff_required ?? false,
      booking_created: Boolean(done.booking_id),
    });
    return done;
  }

  if (provider === "tavus") {
    const { createTavusConversationForDemo } = await import("./tavus-demo");
    try {
      const result = await createTavusConversationForDemo({
        demoSessionId: params.demoSessionId,
        organizationId: params.organizationId,
        agentId: agent.id,
      });
      await recordAvatarProviderMetric({
        organization_id: result.session.organization_id,
        provider: "tavus",
        demo_session_id: result.session.id,
        status: "session_started",
        start_time_ms: Date.now() - startMs,
        lead_category: result.session.lead_category ?? null,
        human_handoff: result.session.handoff_required ?? false,
        booking_created: Boolean(result.session.booking_id),
      });
      await persistAvatarSession(result.session, {
        avatar_status: (result.session.avatar_status as AvatarSessionStatus) ?? "active",
        eventType: "avatar_provider_started",
        eventPayload: { provider: "tavus" },
      });
      return result.session;
    } catch (err) {
      const failed = (await getDemoSession(params.demoSessionId)) ?? working;
      return activateSmartAvatarFallback(
        failed,
        err instanceof Error ? err.message : "Tavus start failed"
      );
    }
  }

  if (provider === "did") {
    const { startDidSessionForDemo } = await import("./did-demo");
    try {
      const result = await startDidSessionForDemo({
        demoSessionId: params.demoSessionId,
        organizationId: params.organizationId,
        agentId: agent.id,
      });
      await recordAvatarProviderMetric({
        organization_id: result.session.organization_id,
        provider: "did",
        demo_session_id: result.session.id,
        status: "session_started",
        start_time_ms: Date.now() - startMs,
        lead_category: result.session.lead_category ?? null,
        human_handoff: result.session.handoff_required ?? false,
        booking_created: Boolean(result.session.booking_id),
      });
      await persistAvatarSession(result.session, {
        avatar_status: (result.session.avatar_status as AvatarSessionStatus) ?? "active",
        eventType: "avatar_provider_started",
        eventPayload: { provider: "did" },
      });
      return result.session;
    } catch (err) {
      const failed = (await getDemoSession(params.demoSessionId)) ?? working;
      return activateSmartAvatarFallback(
        failed,
        err instanceof Error ? err.message : "D-ID start failed"
      );
    }
  }

  const ctx = await buildAvatarContext(working, agent);
  const adapter = getAvatarProvider(provider);

  let updated = await persistAvatarSession(working, {
    avatar_status: "starting",
    avatar_error: null,
    avatar_started_at: new Date().toISOString(),
    eventType: "avatar_starting",
  });

  try {
    const created = await adapter.createAvatarSession(ctx);
    const started = await adapter.startAvatarSession(ctx, created);
    updated = await persistAvatarSession(updated, {
      avatar_session_id: started.sessionId,
      avatar_status: started.status,
      avatar_stream_url: started.streamUrl ?? null,
      avatar_join_url: started.joinUrl ?? null,
      avatar_error: started.error ?? null,
      eventType: "avatar_session_started",
      eventPayload: { sessionId: started.sessionId },
    });
    await syncAiPresenterState({
      session: updated,
      state: "listening",
      recordEvent: false,
    });
    return updated;
  } catch (err) {
    const message = isAvatarProviderError(err)
      ? err.message
      : err instanceof Error
        ? err.message
        : "Avatar session failed";
    return activateAvatarFallback(updated, message);
  }
}

export async function speakAvatarSession(params: {
  demoSessionId: string;
  text: string;
  organizationId?: string;
}): Promise<DemoSession | null> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session) return null;
  if (params.organizationId && session.organization_id !== params.organizationId) {
    return null;
  }
  if (isDemoAiPaused(session)) return session;

  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent?.avatar_enabled) return session;

  const provider = await resolveAgentProvider(agent, session);
  if (!isExternalAvatarProvider(provider)) return session;

  if (
    session.avatar_status === "failed" ||
    session.avatar_status === "fallback_active"
  ) {
    return session;
  }

  const ctx = await buildAvatarContext(session, agent);
  const adapter = getAvatarProvider(provider);
  const sessionId = session.avatar_session_id;
  if (!sessionId) {
    const started = await startAvatarSessionForDemo({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      agentId: agent.id,
    });
    if (started.avatar_status === "fallback_active" || started.avatar_status === "failed") {
      return started;
    }
    return speakAvatarSession({ demoSessionId: started.id, text: params.text });
  }

  try {
    const speak = await adapter.sendTextToAvatar(ctx, sessionId, params.text);
    const updated = await persistAvatarSession(session, {
      avatar_status: speak.status ?? "speaking",
      eventType:
        provider === "tavus" ? "tavus_avatar_speaking" : "avatar_speaking",
      eventPayload: { textLength: params.text.length },
    });
    await syncAiPresenterState({
      session: updated,
      state: "speaking",
      recordEvent: false,
    });
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Avatar speech failed";
    await persistAvatarSession(session, {
      avatar_status: "speaking",
      eventType: "avatar_speech_failed",
      eventPayload: { error: message },
    });
    return session;
  }
}

export async function stopAvatarSessionForDemo(params: {
  demoSessionId: string;
  organizationId: string;
}): Promise<DemoSession | null> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.organizationId) return null;

  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent || !session.avatar_session_id) {
    return persistAvatarSession(session, {
      avatar_status: "stopped",
      avatar_stopped_at: new Date().toISOString(),
      eventType: "avatar_stopped",
    });
  }

  const provider = session.avatar_provider ?? agent.avatar_provider ?? "internal_card";
  if (!isExternalAvatarProvider(provider)) {
    return persistAvatarSession(session, {
      avatar_status: "stopped",
      avatar_stopped_at: new Date().toISOString(),
    });
  }

  const ctx = await buildAvatarContext(session, agent);
  const adapter = getAvatarProvider(provider);
  try {
    await adapter.stopAvatarSession(ctx, session.avatar_session_id);
  } catch {
    /* best effort */
  }

  return persistAvatarSession(session, {
    avatar_status: "stopped",
    avatar_stopped_at: new Date().toISOString(),
    eventType:
      provider === "tavus"
        ? "tavus_avatar_stopped"
        : provider === "did"
          ? "did_session_stopped"
          : "avatar_stopped",
  });
}

export async function pauseAvatarSessionForDemo(session: DemoSession): Promise<DemoSession> {
  if (!isExternalAvatarProvider(session.avatar_provider)) return session;
  if (
    (session.avatar_provider === "tavus" || session.avatar_provider === "did") &&
    session.avatar_session_id &&
    session.avatar_status !== "stopped"
  ) {
    try {
      await stopAvatarSessionForDemo({
        demoSessionId: session.id,
        organizationId: session.organization_id,
      });
    } catch {
      /* best effort */
    }
  }
  return persistAvatarSession(session, {
    avatar_status: "paused",
    eventType:
      session.avatar_provider === "did" ? "did_avatar_paused" : "tavus_avatar_paused",
  });
}

export async function getAvatarSessionStatusForDemo(
  demoSessionId: string,
  organizationId: string
) {
  const session = await getDemoSession(demoSessionId);
  if (!session || session.organization_id !== organizationId) {
    return { error: "Not found" };
  }
  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent || !session.avatar_session_id || !isExternalAvatarProvider(session.avatar_provider)) {
    return {
      status: session.avatar_status ?? "not_started",
      streamUrl: session.avatar_stream_url,
      joinUrl: session.avatar_join_url,
      error: session.avatar_error,
    };
  }
  const ctx = await buildAvatarContext(session, agent);
  const adapter = getAvatarProvider(session.avatar_provider!);
  try {
    const remote = await adapter.getAvatarSessionStatus(ctx, session.avatar_session_id);
    return {
      status: remote.status ?? session.avatar_status,
      streamUrl: remote.streamUrl ?? session.avatar_stream_url,
      joinUrl: session.avatar_join_url,
      error: remote.error ?? session.avatar_error,
      providerSessionId: remote.providerSessionId,
    };
  } catch {
    return {
      status: session.avatar_status,
      streamUrl: session.avatar_stream_url,
      joinUrl: session.avatar_join_url,
      error: session.avatar_error,
    };
  }
}

export async function sendAvatarSpeechFromWorkflow(params: {
  session: DemoSession;
  agent: Agent;
  text: string;
}): Promise<void> {
  if (isDemoAiPaused(params.session)) return;
  if (!params.agent.avatar_enabled) return;
  const provider = await resolveAgentProvider(params.agent, params.session);
  if (!isExternalAvatarProvider(provider)) return;
  if (
    params.session.avatar_status === "failed" ||
    params.session.avatar_status === "fallback_active"
  ) {
    return;
  }
  try {
    await speakAvatarSession({
      demoSessionId: params.session.id,
      text: params.text,
      organizationId: params.session.organization_id,
    });
  } catch (err) {
    console.warn("[sendAvatarSpeechFromWorkflow]", err);
  }
}

export async function testAvatarProviderConnection(
  organizationId: string,
  provider: AvatarProviderId,
  agentOverrides?: AvatarAgentConfig
) {
  const integration = await getAvatarIntegration(organizationId, provider);
  const credentials = await loadAvatarProviderCredentials(
    organizationId,
    provider,
    integration ?? undefined
  );
  const ctx: AvatarSessionContext = {
    organizationId,
    demoSessionId: "test",
    agent: {
      id: "test",
      name: "Test Agent",
      ...agentOverrides,
      avatar_provider: provider,
      avatar_enabled: true,
    },
    integration,
    credentials,
    config: integration?.config ?? {},
  };
  return getAvatarProvider(provider).testConnection(ctx);
}
