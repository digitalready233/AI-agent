import type { SessionContext } from "@/lib/platform/types";
import { getDemoPath } from "@/lib/demo/demo-paths-data";
import { getDemoSession, listDemoAssets, saveDemoSession } from "./demo-data";
import { recordDemoPresentationEvent } from "./demo-presentation-events-data";
import { publishDemoAiSyncToRoom } from "./demo-livekit-ai-sync";
import { safeRecordDemoTimeline } from "./demo-timeline-helpers";
import type {
  DemoSession,
  DemoPresenterType,
  PresentationControlMode,
} from "./types";

export type PresentationActionType =
  | "select_path"
  | "show_asset"
  | "next_asset"
  | "previous_asset"
  | "highlight_cta"
  | "none";

export type PresentationAction = {
  type: PresentationActionType;
  demoPathId?: string | null;
  demoAssetId?: string | null;
  reason?: string;
};

export function normalizePresentationControlMode(
  session: DemoSession
): PresentationControlMode {
  const mode = session.presentation_control_mode;
  if (mode === "staff_controlled" || mode === "shared_control") return mode;
  return "ai_controlled";
}

export function derivePresentationAction(params: {
  selectedPathId: string | null;
  previousPathId: string | null;
  currentAssetId: string | null;
  nextAssetId: string | null;
  bookingRecommended: boolean;
  handoffRequired: boolean;
}): PresentationAction {
  if (params.handoffRequired) {
    return { type: "none", reason: "handoff active" };
  }
  if (params.bookingRecommended) {
    return { type: "highlight_cta", reason: "booking recommended" };
  }
  if (
    params.selectedPathId &&
    params.selectedPathId !== params.previousPathId
  ) {
    return {
      type: "select_path",
      demoPathId: params.selectedPathId,
      reason: "path selected for prospect need",
    };
  }
  if (
    params.nextAssetId &&
    params.nextAssetId !== params.currentAssetId
  ) {
    return {
      type: "show_asset",
      demoAssetId: params.nextAssetId,
      reason: "advance presentation slide",
    };
  }
  return { type: "none" };
}

async function syncTimelineForPresentation(
  session: DemoSession,
  eventType: string,
  title: string,
  description?: string | null,
  metadata?: Record<string, unknown>
) {
  const timelineMap: Record<string, string> = {
    screen_share_started: "screen_share_started",
    screen_share_stopped: "screen_share_stopped",
    control_mode_changed: "presentation_control_changed",
    presenter_changed: "presenter_changed",
    ai_selected_asset: "asset_viewed",
    staff_selected_asset: "asset_viewed",
    ai_moved_next: "asset_viewed",
    staff_moved_next: "asset_viewed",
    booking_cta_shown: "booking_recommended",
    handoff_triggered: "human_handoff_triggered",
    staff_takeover_started: "staff_takeover_started",
    staff_takeover_ended: "staff_took_over",
    ai_paused: "ai_paused",
    ai_resumed: "ai_resumed",
  };
  const timelineType = timelineMap[eventType];
  if (!timelineType) return;
  await safeRecordDemoTimeline({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: timelineType,
    title,
    description,
    metadata: { presentation_event: eventType, ...metadata },
  });
}

export async function recordPresentationMoment(params: {
  session: DemoSession;
  eventType: string;
  title: string;
  description?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await recordDemoPresentationEvent({
    organizationId: params.session.organization_id,
    demoSessionId: params.session.id,
    eventType: params.eventType,
    actorType: params.actorType,
    actorId: params.actorId,
    title: params.title,
    description: params.description,
    metadata: params.metadata,
  });
  await syncTimelineForPresentation(
    params.session,
    params.eventType,
    params.title,
    params.description,
    params.metadata
  );
}

export async function setPresentationControlMode(params: {
  session: DemoSession;
  mode: PresentationControlMode;
  actorType: string;
  actorId: string;
}): Promise<DemoSession> {
  const updated = await saveDemoSession({
    ...params.session,
    presentation_control_mode: params.mode,
    metadata: {
      ...(params.session.metadata ?? {}),
      presentation_control_mode: params.mode,
    },
  });
  await recordPresentationMoment({
    session: updated,
    eventType: "control_mode_changed",
    title: `Control mode: ${params.mode.replace(/_/g, " ")}`,
    actorType: params.actorType,
    actorId: params.actorId,
    metadata: { mode: params.mode },
  });
  await publishDemoAiSyncToRoom(updated);
  return updated;
}

export async function startDemoScreenShare(params: {
  session: DemoSession;
  staffUserId: string;
  staffName?: string;
}): Promise<DemoSession> {
  const now = new Date().toISOString();
  const updated = await saveDemoSession({
    ...params.session,
    screen_share_active: true,
    screen_share_started_at: now,
    screen_share_ended_at: null,
    screen_share_by: params.staffUserId,
    current_presenter_type: "staff",
    current_presenter_id: params.staffUserId,
    metadata: {
      ...(params.session.metadata ?? {}),
      screen_share_active: true,
      presenter_name: params.staffName ?? "Team member",
    },
  });
  await recordPresentationMoment({
    session: updated,
    eventType: "screen_share_started",
    title: "Screen share started",
    description: params.staffName ?? undefined,
    actorType: "staff",
    actorId: params.staffUserId,
    metadata: { staff_name: params.staffName },
  });
  await publishDemoAiSyncToRoom(updated);
  return updated;
}

export async function stopDemoScreenShare(params: {
  session: DemoSession;
  staffUserId?: string;
}): Promise<DemoSession> {
  const now = new Date().toISOString();
  const updated = await saveDemoSession({
    ...params.session,
    screen_share_active: false,
    screen_share_ended_at: now,
    metadata: {
      ...(params.session.metadata ?? {}),
      screen_share_active: false,
    },
  });
  await recordPresentationMoment({
    session: updated,
    eventType: "screen_share_stopped",
    title: "Screen share stopped",
    actorType: "staff",
    actorId: params.staffUserId ?? params.session.screen_share_by ?? null,
  });
  await publishDemoAiSyncToRoom(updated);
  return updated;
}

async function resolveAssetIndex(
  organizationId: string,
  pathId: string | null | undefined,
  assetId: string
): Promise<{ assets: Awaited<ReturnType<typeof listDemoAssets>>; index: number }> {
  if (!pathId) return { assets: [], index: 0 };
  const assets = await listDemoAssets(organizationId, undefined, {
    demoPathId: pathId,
  });
  const index = assets.findIndex((a) => a.id === assetId);
  return { assets, index: index >= 0 ? index : 0 };
}

export async function applyPresentationAction(params: {
  session: DemoSession;
  action: PresentationAction;
  actorType: "ai" | "staff" | "system";
  actorId?: string | null;
  autoApplied?: boolean;
}): Promise<{ session: DemoSession; applied: boolean; pending?: boolean }> {
  const { session, action, actorType, actorId, autoApplied } = params;
  const mode = normalizePresentationControlMode(session);

  if (action.type === "none") {
    return { session, applied: false };
  }

  if (actorType === "ai" && mode === "staff_controlled") {
    return { session, applied: false };
  }

  if (actorType === "ai" && mode === "shared_control" && autoApplied) {
    const pending = await saveDemoSession({
      ...session,
      metadata: {
        ...(session.metadata ?? {}),
        pending_presentation_action: action,
      },
    });
    return { session: pending, applied: false, pending: true };
  }

  let next = { ...session };
  const now = new Date().toISOString();
  let eventType = actorType === "ai" ? "ai_selected_asset" : "staff_selected_asset";

  switch (action.type) {
    case "select_path": {
      if (!action.demoPathId) break;
      const path = await getDemoPath(action.demoPathId);
      const pathAssets = path
        ? await listDemoAssets(session.organization_id, session.agent_id ?? undefined, {
            demoPathId: path.id,
          })
        : [];
      const firstAsset = pathAssets[0];
      next = {
        ...next,
        demo_path_id: path?.id ?? action.demoPathId,
        current_demo_asset_id: firstAsset?.id ?? next.current_demo_asset_id,
        current_demo_stage: "presentation",
        current_presenter_type: actorType as DemoPresenterType,
        current_presenter_id: actorId ?? (actorType === "ai" ? "ai-agent" : null),
        metadata: {
          ...(next.metadata ?? {}),
          demo_path_title: path?.title,
          current_asset_index: 0,
          assets_viewed: firstAsset
            ? [
                ...new Set([
                  ...((next.metadata?.assets_viewed as string[]) ?? []),
                  firstAsset.id,
                ]),
              ]
            : (next.metadata?.assets_viewed as string[]) ?? [],
        },
      };
      eventType = actorType === "ai" ? "ai_selected_asset" : "staff_selected_asset";
      break;
    }
    case "show_asset":
    case "next_asset":
    case "previous_asset": {
      const assetId = action.demoAssetId;
      if (!assetId) break;
      const { assets, index } = await resolveAssetIndex(
        session.organization_id,
        next.demo_path_id,
        assetId
      );
      next = {
        ...next,
        current_demo_asset_id: assetId,
        current_presenter_type: actorType as DemoPresenterType,
        current_presenter_id: actorId ?? (actorType === "ai" ? "ai-agent" : null),
        metadata: {
          ...(next.metadata ?? {}),
          current_asset_index: index,
          assets_viewed: [
            ...new Set([
              ...((next.metadata?.assets_viewed as string[]) ?? []),
              assetId,
            ]),
          ],
          slide_total: assets.length || undefined,
        },
      };
      eventType =
        action.type === "next_asset"
          ? actorType === "ai"
            ? "ai_moved_next"
            : "staff_moved_next"
          : actorType === "ai"
            ? "ai_selected_asset"
            : "staff_selected_asset";
      break;
    }
    case "highlight_cta": {
      next = {
        ...next,
        booking_recommended: true,
        metadata: {
          ...(next.metadata ?? {}),
          booking_cta_visible: true,
        },
      };
      await recordPresentationMoment({
        session: next,
        eventType: "booking_cta_shown",
        title: "Booking CTA shown",
        actorType,
        actorId: actorId ?? null,
        metadata: { source: actorType },
      });
      const saved = await saveDemoSession(next);
      await publishDemoAiSyncToRoom(saved, { bookingRecommended: true });
      return { session: saved, applied: true };
    }
    default:
      break;
  }

  const saved = await saveDemoSession({
    ...next,
    updated_at: now,
    metadata: {
      ...(next.metadata ?? {}),
      pending_presentation_action: undefined,
    },
  });

  await recordPresentationMoment({
    session: saved,
    eventType,
    title:
      action.type === "select_path"
        ? "Demo path selected"
        : "Demo slide updated",
    description: action.reason ?? null,
    actorType,
    actorId: actorId ?? null,
    metadata: {
      action: action.type,
      demo_path_id: action.demoPathId,
      demo_asset_id: action.demoAssetId,
      auto_applied: autoApplied ?? false,
    },
  });

  await publishDemoAiSyncToRoom(saved, {
    selectedDemoPathId: saved.demo_path_id,
    currentDemoAssetId: saved.current_demo_asset_id,
  });

  return { session: saved, applied: true };
}

export async function applyAiPresentationFromWorkflow(params: {
  session: DemoSession;
  action: PresentationAction;
}): Promise<DemoSession> {
  const mode = normalizePresentationControlMode(params.session);
  if (params.action.type === "none") return params.session;

  const result = await applyPresentationAction({
    session: params.session,
    action: params.action,
    actorType: "ai",
    actorId: "ai-agent",
    autoApplied: mode === "ai_controlled",
  });
  return result.session;
}

export async function staffPresentationCommand(params: {
  ctx: SessionContext;
  demoSessionId: string;
  command:
    | "set_control_mode"
    | "select_path"
    | "select_asset"
    | "next_asset"
    | "previous_asset"
    | "show_booking_cta"
    | "hide_booking_cta"
    | "pause_ai"
    | "resume_ai"
    | "take_over"
    | "return_to_ai"
    | "screen_share_start"
    | "screen_share_stop"
    | "apply_pending_ai_action";
  demoPathId?: string;
  demoAssetId?: string;
  controlMode?: PresentationControlMode;
  notes?: string;
}): Promise<DemoSession> {
  const raw = await getDemoSession(params.demoSessionId);
  if (!raw || raw.organization_id !== params.ctx.organization.id) {
    throw new Error("Demo session not found");
  }

  let session = raw;

  switch (params.command) {
    case "set_control_mode": {
      if (!params.controlMode) throw new Error("controlMode required");
      session = await setPresentationControlMode({
        session,
        mode: params.controlMode,
        actorType: "staff",
        actorId: params.ctx.userId,
      });
      break;
    }
    case "screen_share_start":
      session = await startDemoScreenShare({
        session,
        staffUserId: params.ctx.userId,
        staffName: params.ctx.profile.full_name ?? params.ctx.email,
      });
      break;
    case "screen_share_stop":
      session = await stopDemoScreenShare({
        session,
        staffUserId: params.ctx.userId,
      });
      break;
    case "show_booking_cta": {
      session = (
        await applyPresentationAction({
          session,
          action: { type: "highlight_cta", reason: params.notes },
          actorType: "staff",
          actorId: params.ctx.userId,
        })
      ).session;
      break;
    }
    case "hide_booking_cta": {
      session = await saveDemoSession({
        ...session,
        booking_recommended: false,
        metadata: {
          ...(session.metadata ?? {}),
          booking_cta_visible: false,
        },
      });
      break;
    }
    case "select_path":
      if (!params.demoPathId) throw new Error("demoPathId required");
      session = (
        await applyPresentationAction({
          session,
          action: {
            type: "select_path",
            demoPathId: params.demoPathId,
            reason: params.notes,
          },
          actorType: "staff",
          actorId: params.ctx.userId,
        })
      ).session;
      break;
    case "select_asset":
      if (!params.demoAssetId) throw new Error("demoAssetId required");
      session = (
        await applyPresentationAction({
          session,
          action: {
            type: "show_asset",
            demoAssetId: params.demoAssetId,
            reason: params.notes,
          },
          actorType: "staff",
          actorId: params.ctx.userId,
        })
      ).session;
      break;
    case "next_asset": {
      const pathId = params.demoPathId ?? session.demo_path_id;
      if (!pathId) throw new Error("No demo path selected");
      const assets = await listDemoAssets(session.organization_id, session.agent_id ?? undefined, {
        demoPathId: pathId,
      });
      const idx = assets.findIndex((a) => a.id === session.current_demo_asset_id);
      const next = assets[Math.min(idx + 1, assets.length - 1)];
      if (!next) throw new Error("No next asset");
      session = (
        await applyPresentationAction({
          session,
          action: {
            type: "next_asset",
            demoAssetId: next.id,
            reason: params.notes,
          },
          actorType: "staff",
          actorId: params.ctx.userId,
        })
      ).session;
      break;
    }
    case "previous_asset": {
      const pathId = params.demoPathId ?? session.demo_path_id;
      if (!pathId) throw new Error("No demo path selected");
      const assets = await listDemoAssets(session.organization_id, session.agent_id ?? undefined, {
        demoPathId: pathId,
      });
      const idx = assets.findIndex((a) => a.id === session.current_demo_asset_id);
      const prev = assets[Math.max(idx - 1, 0)];
      if (!prev) throw new Error("No previous asset");
      session = (
        await applyPresentationAction({
          session,
          action: {
            type: "previous_asset",
            demoAssetId: prev.id,
            reason: params.notes,
          },
          actorType: "staff",
          actorId: params.ctx.userId,
        })
      ).session;
      break;
    }
    case "apply_pending_ai_action": {
      const pending = session.metadata?.pending_presentation_action as
        | PresentationAction
        | undefined;
      if (!pending) throw new Error("No pending AI recommendation");
      session = (
        await applyPresentationAction({
          session,
          action: pending,
          actorType: "staff",
          actorId: params.ctx.userId,
        })
      ).session;
      break;
    }
    case "pause_ai":
    case "resume_ai":
    case "take_over":
    case "return_to_ai": {
      const { staffTakeOverDemo, staffResumeAiDemo } = await import(
        "./demo-live-handoff"
      );
      if (params.command === "take_over") {
        session = await staffTakeOverDemo({
          ctx: params.ctx,
          demoSessionId: params.demoSessionId,
          notes: params.notes,
        });
        session = await setPresentationControlMode({
          session,
          mode: "staff_controlled",
          actorType: "staff",
          actorId: params.ctx.userId,
        });
      } else if (params.command === "return_to_ai") {
        session = await staffResumeAiDemo({
          ctx: params.ctx,
          demoSessionId: params.demoSessionId,
        });
        session = await setPresentationControlMode({
          session,
          mode: params.controlMode ?? "ai_controlled",
          actorType: "staff",
          actorId: params.ctx.userId,
        });
      } else if (params.command === "pause_ai") {
        session = await staffTakeOverDemo({
          ctx: params.ctx,
          demoSessionId: params.demoSessionId,
          notes: params.notes ?? "AI paused by staff",
        });
      } else {
        session = await staffResumeAiDemo({
          ctx: params.ctx,
          demoSessionId: params.demoSessionId,
        });
      }
      break;
    }
    default:
      break;
  }

  return (await getDemoSession(params.demoSessionId)) ?? session;
}
