import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import type { DemoSession } from "@/lib/demo/types";
import { syncAiPresenterState } from "@/lib/demo/sync-ai-presenter";
import { saveAvatarEvent } from "./avatar-events-data";
import { recordAvatarProviderMetric } from "./provider-metrics-data";
import { isAvatarProviderAvailable } from "./select-avatar-provider";
import { startAvatarSessionForDemo } from "./avatar-session-service";
import type { AvatarProviderId, AvatarSessionStatus } from "./types";
import { isExternalAvatarProvider } from "./registry";

function nextFallbackInChain(
  current: AvatarProviderId,
  fallbackProvider: AvatarProviderId
): AvatarProviderId[] {
  const chain: AvatarProviderId[] = [];
  if (current === "tavus") chain.push("did", "internal_card");
  else if (current === "did") chain.push("tavus", "internal_card");
  else chain.push("internal_card");
  if (
    fallbackProvider !== current &&
    !chain.includes(fallbackProvider)
  ) {
    chain.unshift(fallbackProvider);
  }
  return [...new Set(chain)];
}

export async function activateSmartAvatarFallback(
  session: DemoSession,
  reason: string
): Promise<DemoSession> {
  const primary = (session.avatar_provider ?? "internal_card") as AvatarProviderId;
  const configuredFallback = (session.avatar_fallback_provider ??
    "internal_card") as AvatarProviderId;

  const candidates = nextFallbackInChain(primary, configuredFallback).filter(
    (p) => p !== primary
  );

  for (const next of candidates) {
    if (next === "internal_card") {
      return activateInternalFallback(session, reason, primary);
    }
    const ok = await isAvatarProviderAvailable(session.organization_id, next);
    if (!ok) continue;

    await saveAvatarEvent({
      organization_id: session.organization_id,
      demo_session_id: session.id,
      provider: primary,
      event_type: "avatar_provider_failed",
      payload: { reason, attempting: next },
    });

    try {
      const patched = await saveDemoSession({
        ...session,
        avatar_provider: next,
        avatar_status: "starting" as AvatarSessionStatus,
        avatar_error: null,
        avatar_session_id: null,
        avatar_stream_url: null,
        avatar_join_url: null,
        metadata: {
          ...(session.metadata ?? {}),
          avatar_last_event: "avatar_provider_switched",
          avatar_switch_reason: reason,
          avatar_previous_provider: primary,
        },
      });

      await saveAvatarEvent({
        organization_id: patched.organization_id,
        demo_session_id: patched.id,
        provider: next,
        event_type: "avatar_provider_switched",
        payload: { from: primary, to: next, reason },
      });

      const started = await startAvatarSessionForDemo({
        demoSessionId: patched.id,
        organizationId: patched.organization_id,
        agentId: patched.agent_id,
      });

      if (
        started.avatar_status !== "failed" &&
        started.avatar_status !== "fallback_active"
      ) {
        await recordAvatarProviderMetric({
          organization_id: started.organization_id,
          provider: next,
          demo_session_id: started.id,
          status: "fallback_used",
          fallback_used: true,
          failed_reason: reason,
          lead_category: started.lead_category ?? null,
          human_handoff: started.handoff_required ?? false,
          booking_created: Boolean(started.booking_id),
        });
        return started;
      }
      session = started;
    } catch {
      continue;
    }
  }

  return activateInternalFallback(session, reason, primary);
}

async function activateInternalFallback(
  session: DemoSession,
  reason: string,
  failedProvider: AvatarProviderId
): Promise<DemoSession> {
  const now = new Date().toISOString();
  const updated = await saveDemoSession({
    ...session,
    avatar_provider: "internal_card",
    avatar_status: "fallback_active",
    avatar_error: reason,
    avatar_stream_url: null,
    avatar_join_url: null,
    avatar_stopped_at: session.avatar_stopped_at ?? now,
    metadata: {
      ...(session.metadata ?? {}),
      avatar_last_event: "fallback_activated",
      avatar_failed_provider: failedProvider,
    },
  });

  const eventType =
    failedProvider === "tavus"
      ? "avatar_fallback_activated"
      : failedProvider === "did"
        ? "did_fallback_activated"
        : "fallback_activated";

  await saveAvatarEvent({
    organization_id: updated.organization_id,
    demo_session_id: updated.id,
    provider: failedProvider,
    event_type: eventType,
    payload: { reason },
  });

  await recordAvatarProviderMetric({
    organization_id: updated.organization_id,
    provider: failedProvider,
    demo_session_id: updated.id,
    status: "session_failed",
    failed_reason: reason,
    fallback_used: true,
    lead_category: updated.lead_category ?? null,
    human_handoff: updated.handoff_required ?? false,
    booking_created: Boolean(updated.booking_id),
  });

  await syncAiPresenterState({
    session: updated,
    state: "listening",
    recordEvent: true,
  });

  return updated;
}

export async function switchDemoAvatarProvider(params: {
  demoSessionId: string;
  organizationId: string;
  targetProvider: AvatarProviderId;
  switchedBy?: string;
}): Promise<DemoSession> {
  let session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.organizationId) {
    throw new Error("Demo session not found");
  }

  const previous = session.avatar_provider ?? "internal_card";

  if (isExternalAvatarProvider(previous as AvatarProviderId)) {
    const { stopAvatarSessionForDemo } = await import("./avatar-session-service");
    await stopAvatarSessionForDemo({
      demoSessionId: session.id,
      organizationId: session.organization_id,
    });
    session = (await getDemoSession(session.id)) ?? session;
  }

  session = await saveDemoSession({
    ...session,
    avatar_provider: params.targetProvider,
    avatar_status: "starting",
    avatar_session_id: null,
    avatar_stream_url: null,
    avatar_join_url: null,
    avatar_error: null,
    metadata: {
      ...(session.metadata ?? {}),
      avatar_last_event: "avatar_provider_switched",
      avatar_switched_by: params.switchedBy ?? null,
      avatar_previous_provider: previous,
    },
  });

  await saveAvatarEvent({
    organization_id: session.organization_id,
    demo_session_id: session.id,
    provider: params.targetProvider,
    event_type: "avatar_provider_switched",
    payload: { from: previous, to: params.targetProvider, manual: true },
  });

  if (params.targetProvider === "internal_card") {
    return saveDemoSession({
      ...session,
      avatar_status: "active",
    });
  }

  const started = await startAvatarSessionForDemo({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    agentId: session.agent_id,
  });

  if (
    started.avatar_status === "failed" ||
    started.avatar_status === "fallback_active"
  ) {
    return started;
  }

  return started;
}
