import { getLead, saveLead, saveNotification } from "@/lib/platform/data";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { Lead, LeadCategory } from "@/lib/platform/types";
import type { SessionContext } from "@/lib/platform/types";
import { getDemoProviderSettings } from "./demo-provider";
import {
  getDemoSession,
  listDemoParticipants,
  saveDemoMessage,
  saveDemoOutcome,
  saveDemoParticipant,
  saveDemoSession,
} from "./demo-data";
import { recordDemoEvent } from "./demo-events-data";
import { handoffReasonLabel, resolveHandoffReason } from "./demo-handoff";
import type { DemoAnalysis } from "./demo-schemas";
import { canJoinLiveDemo } from "./demo-takeover-permissions";
import type { DemoSession, HandoffReason, HandoffStatus } from "./types";
import { pauseDemoLiveKitAiWorker, resumeDemoLiveKitAiWorker } from "./demo-livekit-ai-worker";
import { syncAiPresenterState, recordStaffBecamePresenter, recordAiPresenterResumed } from "./sync-ai-presenter";
import { pauseAvatarSessionForDemo } from "@/lib/avatar/avatar-session-service";
import { isDemoAiPaused } from "./demo-session-flags";

export { isDemoAiPaused };

export function normalizeHandoffFields(session: DemoSession): DemoSession {
  const meta = session.metadata ?? {};
  return {
    ...session,
    ai_paused:
      session.ai_paused ??
      (meta.ai_paused === true ? true : false),
    handoff_status:
      (session.handoff_status as HandoffStatus | undefined) ??
      (session.handoff_required ? "notified" : "none"),
  };
}

async function saveProspectSystemNotice(params: {
  organizationId: string;
  demoSessionId: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  await saveDemoMessage({
    id: crypto.randomUUID(),
    organization_id: params.organizationId,
    demo_session_id: params.demoSessionId,
    sender_type: "system",
    sender_name: "Demo",
    content: params.content,
    metadata: params.metadata,
    created_at: now,
  });
}

async function syncLeadOnTakeoverStart(
  session: DemoSession,
  reason: string | null | undefined
) {
  if (!session.lead_id) return;
  const lead = await getLead(session.lead_id);
  if (!lead) return;
  const category = (session.lead_category ?? lead.lead_category) as LeadCategory;
  const nextStatus =
    category === "hot" || category === "warm" ? "qualified" : "working";
  const noteLine = `Human takeover started${reason ? ` (${handoffReasonLabel(reason)})` : ""}.`;
  const notes = lead.notes?.trim()
    ? `${lead.notes.trim()}\n\n${noteLine}`
    : noteLine;
  await saveLead({
    ...lead,
    lead_status:
      lead.lead_status === "qualified" ? lead.lead_status : nextStatus,
    notes,
    next_action: session.recommended_next_action ?? "Continue live demo with prospect",
    updated_at: new Date().toISOString(),
  });
}

export async function triggerDemoHandoff(params: {
  demoSessionId: string;
  requestedBy?: "prospect" | "staff" | "system";
  reason?: HandoffReason | string | null;
  analysis?: DemoAnalysis;
  leadCategory?: LeadCategory;
  notes?: string;
  skipNotification?: boolean;
}): Promise<DemoSession> {
  const raw = await getDemoSession(params.demoSessionId);
  if (!raw) throw new Error("Demo session not found");
  const session = normalizeHandoffFields(raw);

  const now = new Date().toISOString();
  const reason =
    params.reason ??
    (params.analysis && params.leadCategory != null
      ? resolveHandoffReason({
          analysis: params.analysis,
          leadCategory: params.leadCategory,
        })
      : session.handoff_reason) ??
    "manual";

  const lead = session.lead_id ? await getLead(session.lead_id) : null;
  const settings = await getOrganizationSettings(session.organization_id);

  const nextStatus: HandoffStatus =
    session.handoff_status === "taken_over" || session.handoff_status === "joined"
      ? (session.handoff_status as HandoffStatus)
      : session.handoff_status === "none"
        ? "requested"
        : "notified";

  const updated = await saveDemoSession({
    ...session,
    handoff_required: true,
    handoff_reason: reason,
    handoff_status: nextStatus,
    recommended_next_action:
      session.recommended_next_action ?? "Human specialist to join demo",
    metadata: {
      ...(session.metadata ?? {}),
      handoff_requested_at: now,
      handoff_requested_by: params.requestedBy ?? "system",
    },
  });

  await saveDemoOutcome({
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    demo_session_id: session.id,
    lead_id: session.lead_id,
    outcome_type: "handoff_requested",
    notes: params.notes ?? handoffReasonLabel(reason),
    next_action: "Assign team member to demo",
    booking_id: session.booking_id ?? null,
    handoff_required: true,
    metadata: { requested_by: params.requestedBy ?? "system", reason },
    created_at: now,
  });

  await recordDemoEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "handoff_triggered",
    actorType: params.requestedBy === "prospect" ? "prospect" : "system",
    description: handoffReasonLabel(reason),
    metadata: { reason, requested_by: params.requestedBy },
  });

  if (!params.skipNotification && settings.notifications.events.human_handoff_required !== false) {
    const joinLink = `/dashboard/demo-calls/${session.id}`;
    const roomLink = `/demo-room/${session.id}?staff=1`;
    await saveNotification({
      id: crypto.randomUUID(),
      organization_id: session.organization_id,
      type: "demo_handoff",
      title: "Human closer needed",
      message: [
        lead?.full_name ?? "Prospect",
        lead?.service_interest ? `· ${lead.service_interest}` : "",
        lead?.budget ? `· Budget: ${lead.budget}` : "",
        lead?.timeline ? `· Timeline: ${lead.timeline}` : "",
        `· ${handoffReasonLabel(reason)}`,
      ]
        .filter(Boolean)
        .join(" "),
      status: "unread",
      metadata: {
        link: joinLink,
        join_demo_room_link: roomLink,
        demo_session_id: session.id,
        lead_id: lead?.id,
        handoff_reason: reason,
        service_interest: lead?.service_interest,
        budget: lead?.budget,
        timeline: lead?.timeline,
      },
      created_at: now,
    });
    await recordDemoEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "staff_notified",
      actorType: "system",
      description: "Staff notified for human closer",
      metadata: { link: joinLink },
    });
    if (updated.handoff_status === "requested") {
      await saveDemoSession({
        ...(await getDemoSession(session.id))!,
        handoff_status: "notified",
      });
    }
  }

  await saveProspectSystemNotice({
    organizationId: session.organization_id,
    demoSessionId: session.id,
    content:
      "A team member has been notified and may join this demo to assist you.",
    metadata: { handoff_reason: reason },
  });

  return (await getDemoSession(session.id))!;
}

export async function staffJoinLiveDemo(params: {
  ctx: SessionContext;
  demoSessionId: string;
  displayName?: string;
}): Promise<{ session: DemoSession; participantId: string; joined: boolean }> {
  const { ctx, demoSessionId } = params;
  if (!canJoinLiveDemo(ctx.profile.role)) {
    throw new Error("You do not have permission to join live demos.");
  }

  const session = await getDemoSession(demoSessionId);
  if (!session || session.organization_id !== ctx.organization.id) {
    throw new Error("Demo not found");
  }
  if (["completed", "cancelled", "missed"].includes(session.status)) {
    throw new Error("Demo has ended");
  }

  const providerSettings = await getDemoProviderSettings(session.organization_id);
  if (!providerSettings.enable_human_takeover) {
    throw new Error("Human takeover is disabled for demos.");
  }

  const staffName =
    params.displayName?.trim() ||
    ctx.profile.full_name?.trim() ||
    ctx.email ||
    "Team member";

  const existing = (await listDemoParticipants(demoSessionId)).find(
    (p) =>
      p.role === "staff" &&
      !p.left_at &&
      (p.metadata?.staff_user_id === ctx.userId ||
        p.email === ctx.email)
  );

  const now = new Date().toISOString();
  let participantId = existing?.id ?? "";

  if (!existing) {
    const participant = await saveDemoParticipant({
      id: crypto.randomUUID(),
      organization_id: session.organization_id,
      demo_session_id: demoSessionId,
      role: "staff",
      display_name: staffName,
      name: staffName,
      email: ctx.email,
      joined_at: now,
      left_at: null,
      metadata: { staff_user_id: ctx.userId },
      created_at: now,
    });
    participantId = participant.id;

    await saveProspectSystemNotice({
      organizationId: session.organization_id,
      demoSessionId,
      content: `${staffName} has joined the demo.`,
      metadata: { staff_user_id: ctx.userId, staff_name: staffName },
    });

    await recordDemoEvent({
      demoSessionId,
      organizationId: session.organization_id,
      eventType: "staff_joined",
      actorType: "staff",
      actorId: ctx.userId,
      description: `${staffName} joined live demo`,
      metadata: { staff_name: staffName },
    });
    const { recordDemoTimelineEvent } = await import("./demo-timeline-data");
    await recordDemoTimelineEvent({
      demoSessionId,
      organizationId: session.organization_id,
      eventType: "staff_joined",
      title: "Staff joined",
      description: staffName,
    });
  }

  const handoffStatus: HandoffStatus =
    session.handoff_status === "taken_over" ? "taken_over" : "joined";

  await saveDemoSession({
    ...session,
    handoff_required: true,
    handoff_status: handoffStatus,
    metadata: {
      ...(session.metadata ?? {}),
      active_staff_user_id: ctx.userId,
      active_staff_name: staffName,
    },
  });

  return {
    session: (await getDemoSession(demoSessionId))!,
    participantId,
    joined: !existing,
  };
}

export async function staffTakeOverDemo(params: {
  ctx: SessionContext;
  demoSessionId: string;
  notes?: string;
}): Promise<DemoSession> {
  await staffJoinLiveDemo({
    ctx: params.ctx,
    demoSessionId: params.demoSessionId,
  });

  const session = (await getDemoSession(params.demoSessionId))!;
  const now = new Date().toISOString();
  const reason = session.handoff_reason ?? "manual";

  const updated = await saveDemoSession({
    ...session,
    status: "human_taken_over",
    ai_paused: true,
    handoff_required: true,
    handoff_status: "taken_over",
    human_takeover_started_at: session.human_takeover_started_at ?? now,
    human_takeover_by: params.ctx.userId,
    presentation_control_mode: "staff_controlled",
    current_presenter_type: "staff",
    current_presenter_id: params.ctx.userId,
    recommended_next_action: "Staff assisting live — AI paused",
    metadata: {
      ...(session.metadata ?? {}),
      ai_paused: true,
      active_staff_user_id: params.ctx.userId,
      active_staff_name:
        session.metadata?.active_staff_name ??
        params.ctx.profile.full_name ??
        params.ctx.email,
    },
  });

  await syncLeadOnTakeoverStart(updated, reason);

  await recordDemoEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "takeover_started",
    actorType: "staff",
    actorId: params.ctx.userId,
    description: params.notes ?? "Staff took over demo",
    metadata: { reason },
  });
  await recordDemoEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "ai_paused",
    actorType: "staff",
    actorId: params.ctx.userId,
    description: "AI auto-replies paused",
  });
  const { recordDemoTimelineEvent } = await import("./demo-timeline-data");
  await recordDemoTimelineEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "staff_takeover_started",
    title: "Staff takeover started",
    description: params.notes ?? reason,
  });
  await recordDemoTimelineEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "staff_took_over",
    title: "Staff took over",
    description: params.notes ?? reason,
  });
  await recordDemoTimelineEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "ai_paused",
    title: "AI paused",
    description: "Staff takeover — AI replies paused",
  });

  const staffName =
    (typeof updated.metadata?.active_staff_name === "string"
      ? updated.metadata.active_staff_name
      : null) ?? "A team member";

  await saveProspectSystemNotice({
    organizationId: session.organization_id,
    demoSessionId: params.demoSessionId,
    content: `${staffName} is now assisting you directly.`,
    metadata: { takeover: true },
  });

  if (updated.ai_joined) {
    try {
      await pauseDemoLiveKitAiWorker(params.demoSessionId);
    } catch (e) {
      console.warn("[staffTakeOverDemo] pause LiveKit AI failed", e);
    }
  }

  await syncAiPresenterState({
    session: updated,
    state: "paused",
    recordEvent: true,
  });
  await pauseAvatarSessionForDemo(updated);
  await recordStaffBecamePresenter(updated, {
    userId: params.ctx.userId,
    name:
      (typeof updated.metadata?.active_staff_name === "string"
        ? updated.metadata.active_staff_name
        : null) ?? params.ctx.profile.full_name ?? undefined,
  });

  return (await getDemoSession(params.demoSessionId)) ?? updated;
}

export async function staffResumeAiDemo(params: {
  ctx: SessionContext;
  demoSessionId: string;
}): Promise<DemoSession> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.ctx.organization.id) {
    throw new Error("Demo not found");
  }

  const now = new Date().toISOString();
  const updated = await saveDemoSession({
    ...session,
    ai_paused: false,
    status:
      session.status === "human_taken_over" ? "in_progress" : session.status,
    presentation_control_mode: "ai_controlled",
    current_presenter_type: "ai",
    current_presenter_id: "ai-agent",
    metadata: {
      ...(session.metadata ?? {}),
      ai_paused: false,
      presentation_control_mode: "ai_controlled",
    },
  });

  await recordDemoEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "ai_resumed",
    actorType: "staff",
    actorId: params.ctx.userId,
    description: "Control returned to AI",
  });
  const { recordDemoTimelineEvent } = await import("./demo-timeline-data");
  await recordDemoTimelineEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "ai_resumed",
    title: "AI resumed",
    description: "Staff returned control to AI",
  });

  await saveProspectSystemNotice({
    organizationId: session.organization_id,
    demoSessionId: params.demoSessionId,
    content:
      "Our AI assistant will continue helping you. Your team member may still be available if needed.",
    metadata: { ai_resumed: true },
  });

  if (session.ai_joined) {
    try {
      await resumeDemoLiveKitAiWorker(params.demoSessionId);
    } catch (e) {
      console.warn("[staffResumeAiDemo] resume LiveKit AI failed", e);
    }
  }

  await recordAiPresenterResumed(updated);
  await syncAiPresenterState({
    session: updated,
    state: "listening",
    recordEvent: true,
  });

  return (await getDemoSession(params.demoSessionId)) ?? updated;
}

export async function staffEndTakeover(params: {
  ctx: SessionContext;
  demoSessionId: string;
  staffNotes?: string;
}): Promise<DemoSession> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session) throw new Error("Demo not found");

  const now = new Date().toISOString();
  const updated = await saveDemoSession({
    ...session,
    ai_paused: false,
    handoff_status: "resolved",
    human_takeover_ended_at: now,
    metadata: {
      ...(session.metadata ?? {}),
      ai_paused: false,
      takeover_end_notes: params.staffNotes,
    },
  });

  await recordDemoEvent({
    demoSessionId: params.demoSessionId,
    organizationId: session.organization_id,
    eventType: "takeover_ended",
    actorType: "staff",
    actorId: params.ctx.userId,
    description: params.staffNotes ?? "Human takeover ended",
  });

  if (session.lead_id && params.staffNotes?.trim()) {
    const lead = await getLead(session.lead_id);
    if (lead) {
      const noteLine = `Takeover notes: ${params.staffNotes.trim()}`;
      await saveLead({
        ...lead,
        notes: lead.notes?.trim() ? `${lead.notes}\n\n${noteLine}` : noteLine,
        updated_at: now,
      });
    }
  }

  return updated;
}

export function formatTakeoverSummaryBlock(session: DemoSession): string {
  const started = session.human_takeover_started_at;
  const ended = session.human_takeover_ended_at;
  let duration = "—";
  if (started) {
    const endMs = ended ? new Date(ended).getTime() : Date.now();
    const sec = Math.max(0, Math.round((endMs - new Date(started).getTime()) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    duration = `${m}m ${s}s`;
  }
  const staffName =
    typeof session.metadata?.active_staff_name === "string"
      ? session.metadata.active_staff_name
      : "—";

  return [
    "Handoff triggered:",
    session.handoff_required ? "Yes" : "No",
    "",
    "Handoff reason:",
    handoffReasonLabel(session.handoff_reason),
    "",
    "Handoff status:",
    session.handoff_status ?? "—",
    "",
    "Staff joined:",
    ["joined", "taken_over", "resolved"].includes(session.handoff_status ?? "")
      ? "Yes"
      : "No",
    "",
    "Staff name:",
    staffName,
    "",
    "AI paused:",
    isDemoAiPaused(session) || session.status === "human_taken_over" ? "Yes" : "No",
    "",
    "Human takeover duration:",
    duration,
    "",
    "Outcome after takeover:",
    session.recommended_next_action ?? "—",
  ].join("\n");
}
