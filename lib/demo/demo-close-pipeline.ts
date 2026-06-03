/**
 * Ordered close pipeline after an AI demo ends:
 * 1. Stop recording → 2. Save transcript → 3. Timeline → 4. AI summary
 * → 5. CRM lead update → 6. Follow-up task → 7. Replay/review ready → 8. Dashboard metrics (on read)
 */
import {
  getAgent,
  getConversation,
  getLead,
  saveConversation,
  saveLead,
  saveNotification,
} from "@/lib/platform/data";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import {
  getDemoSession,
  listDemoMessages,
  rebuildSessionTranscript,
  saveDemoOutcome,
  saveDemoSession,
} from "./demo-data";
import { getDemoPath } from "./demo-paths-data";
import { isDemoRoomAiEnabled } from "./config";
import { formatDemoSummaryText, generateDemoSummaryFromTranscript } from "./demo-summary";
import { recordDemoEvent } from "./demo-events-data";
import { buildStage1PlaceholderSummary } from "./stage1-summary";
import { stopDemoLiveKitAiWorker } from "./demo-livekit-ai-worker";
import { endLiveKitRoomForSession, shouldUseLiveKitVideo } from "./livekit-service";
import { isLiveKitEnvConfigured } from "./demo-provider";
import { stopDemoRecording } from "./livekit-recording-service";
import { recordDemoTimelineEvent } from "./demo-timeline-data";
import {
  buildDemoFollowUpDraft,
  followUpDueHoursForCategory,
} from "./demo-follow-up-draft";
import { resolveDemoRecordingSettings } from "./demo-recording-settings";
import { getDemoProviderSettings } from "./demo-provider";
import { saveFollowUpTask } from "./follow-up-tasks-data";
import type { LeadCategory } from "@/lib/platform/types";
import type { DemoSession } from "./types";

export type DemoClosePipelineResult = {
  summary: string;
  sessionId: string;
  session: DemoSession;
};

export async function runDemoClosePipeline(params: {
  demoSessionId: string;
  status?: "completed" | "missed" | "cancelled";
}): Promise<DemoClosePipelineResult> {
  let session = await getDemoSession(params.demoSessionId);
  if (!session) throw new Error("Demo session not found");

  // --- Live demo stops (AI + recording + room) ---
  if (session.ai_joined && session.ai_status !== "stopped") {
    try {
      await stopDemoLiveKitAiWorker({
        demoSessionId: session.id,
        reason: "demo_ended",
      });
    } catch (e) {
      console.warn("[demo-close] stop AI worker failed", e);
    }
  }

  if (session.recording_status === "recording" || session.recording_status === "starting") {
    try {
      await stopDemoRecording({ demoSessionId: session.id, stoppedBy: "demo_end" });
    } catch (e) {
      console.warn("[demo-close] stop recording failed", e);
    }
    session = (await getDemoSession(session.id)) ?? session;
  }

  if (isLiveKitEnvConfigured() && shouldUseLiveKitVideo(session)) {
    const lkStatus = session.livekit_room_status;
    if (lkStatus && lkStatus !== "ended" && lkStatus !== "not_created") {
      try {
        await endLiveKitRoomForSession(session.id, { endedBy: "demo_end" });
      } catch (e) {
        console.warn("[demo-close] end LiveKit room failed", e);
      }
    }
  }

  const ended = new Date().toISOString();
  const started = session.started_at
    ? new Date(session.started_at)
    : new Date(session.created_at);
  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - started.getTime()) / 1000)
  );

  // --- Transcript saved ---
  const transcript = await rebuildSessionTranscript(session.id);
  await recordDemoTimelineEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "transcript_saved",
    title: "Transcript saved",
    description: `${transcript.length} characters`,
  });

  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  const lead = session.lead_id ? await getLead(session.lead_id) : null;
  const messages = await listDemoMessages(session.id);
  const demoPath = session.demo_path_id ? await getDemoPath(session.demo_path_id) : null;

  // --- AI final summary ---
  let summary: string;
  if (isDemoRoomAiEnabled()) {
    let aiSummary = "";
    try {
      aiSummary = await generateDemoSummaryFromTranscript({
        transcript,
        agentName: agent?.name ?? "AI Agent",
        companyName: agent?.company_product_name ?? undefined,
        demoPathTitle: demoPath?.title,
      });
    } catch {
      aiSummary = session.summary ?? "";
    }
    summary = formatDemoSummaryText({
      session,
      lead,
      transcript,
      aiSummary,
      demoPath,
      assetsViewed: Array.isArray(session.metadata?.assets_viewed)
        ? (session.metadata.assets_viewed as string[])
        : [],
    });
  } else {
    summary = buildStage1PlaceholderSummary({ session, lead, messages });
  }

  await recordDemoTimelineEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "summary_generated",
    title: "Final demo summary generated",
    description: summary.slice(0, 200),
  });

  const updated = await saveDemoSession({
    ...session,
    status: params.status ?? "completed",
    ended_at: ended,
    duration_seconds: durationSeconds,
    summary,
    transcript,
    handoff_status:
      session.handoff_required && session.handoff_status !== "none"
        ? "resolved"
        : session.handoff_status,
    human_takeover_ended_at:
      session.human_takeover_started_at && !session.human_takeover_ended_at
        ? ended
        : session.human_takeover_ended_at,
  });

  await saveDemoOutcome({
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    demo_session_id: session.id,
    lead_id: session.lead_id,
    outcome_type: params.status ?? "completed",
    notes: summary.slice(0, 2000),
    next_action: session.recommended_next_action,
    booking_id: session.booking_id ?? null,
    handoff_required: session.handoff_required,
    metadata: { duration_seconds: durationSeconds },
    created_at: ended,
  });

  await recordDemoEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "demo_completed",
    description: `Demo ${params.status ?? "completed"}`,
    metadata: { duration_seconds: durationSeconds },
  });

  await recordDemoTimelineEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "demo_ended",
    title: "Demo session ended",
    description: params.status ?? "completed",
    metadata: { duration_seconds: durationSeconds },
  });

  // --- CRM + follow-up task (single pass) ---
  const finalSession = await runPostDemoCrmAndFollowUp(updated, { lead, agent });

  return {
    summary,
    sessionId: finalSession.id,
    session: finalSession,
  };
}

export async function runPostDemoCrmAndFollowUp(
  session: DemoSession,
  ctx: { lead: Awaited<ReturnType<typeof getLead>>; agent: Awaited<ReturnType<typeof getAgent>> }
): Promise<DemoSession> {
  if (session.post_demo_automation_at) return session;

  const now = new Date().toISOString();
  const { lead, agent } = ctx;
  const settings = await getDemoProviderSettings(session.organization_id);
  const orgSettings = await getOrganizationSettings(session.organization_id);
  const recSettings = resolveDemoRecordingSettings(settings);

  const category = session.lead_category ?? lead?.lead_category ?? null;
  let followHours = followUpDueHoursForCategory(category);
  if (session.booking_id) followHours = 0;
  if (session.human_takeover_by) followHours = Math.min(followHours, 4);

  const followUpDue = new Date(Date.now() + followHours * 60 * 60 * 1000).toISOString();
  const bookingUrl =
    typeof session.metadata?.booking_url === "string"
      ? session.metadata.booking_url
      : process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/book`
        : null;

  let followUpDraft = buildDemoFollowUpDraft({
    session,
    lead,
    agentName: agent?.name,
    companyName: agent?.company_product_name ?? undefined,
    bookingUrl,
  });

  if (session.multi_agent_enabled && session.follow_up_agent_id) {
    try {
      const { runFollowUpAgent } = await import("./multi-agent/specialist-runner");
      const { recordSpecialistEvent } = await import("./multi-agent/events-data");
      const followUpOut = await runFollowUpAgent({
        agentId: session.follow_up_agent_id,
        session,
        isDemoEnding: true,
      });
      if (followUpOut.followUpMessageDraft?.trim()) {
        followUpDraft = followUpOut.followUpMessageDraft;
      }
      await recordSpecialistEvent({
        organizationId: session.organization_id,
        demoSessionId: session.id,
        agentRole: "follow_up_agent",
        agentId: session.follow_up_agent_id,
        eventType: "follow_up_created",
        output: followUpOut as unknown as Record<string, unknown>,
      });
    } catch (e) {
      console.warn("[demo-close] follow_up_agent failed", e);
    }
  }

  const demoStatus = session.status === "completed" ? "completed" : session.status;
  const leadStatus = session.booking_id
    ? lead?.lead_status === "customer"
      ? lead.lead_status
      : "qualified"
    : category === "hot" || category === "warm"
      ? "qualified"
      : lead?.lead_status ?? "new";

  const objections = Array.isArray(session.metadata?.objections)
    ? (session.metadata.objections as string[])
    : [];

  const followUpTaskId = crypto.randomUUID();
  const taskTitle = buildFollowUpTaskTitle(session, lead, category);
  const taskPriority =
    category === "hot" ? "urgent" : category === "warm" ? "high" : "normal";

  await saveFollowUpTask({
    id: followUpTaskId,
    organization_id: session.organization_id,
    demo_session_id: session.id,
    lead_id: lead?.id ?? session.lead_id ?? null,
    title: taskTitle,
    description: session.recommended_next_action ?? session.summary?.slice(0, 500) ?? null,
    status: "pending",
    due_at: followUpDue,
    assigned_to:
      session.human_takeover_by ??
      (typeof session.metadata?.assigned_staff_id === "string"
        ? session.metadata.assigned_staff_id
        : null),
    follow_up_draft: followUpDraft,
    priority: taskPriority,
    metadata: {
      lead_category: category,
      booking_id: session.booking_id,
      auto_send: recSettings.autoSendFollowUp,
    },
    created_at: now,
    updated_at: now,
  });

  const saved = await saveDemoSession({
    ...session,
    follow_up_draft: followUpDraft,
    follow_up_due_at: followUpDue,
    post_demo_automation_at: now,
    metadata: {
      ...session.metadata,
      demo_status: demoStatus,
      last_demo_date: now,
      follow_up_task_id: followUpTaskId,
      follow_up_task_created: true,
      follow_up_task_title: taskTitle,
      internal_notification_sent: false,
      objections,
      assigned_staff_id:
        session.human_takeover_by ?? session.metadata?.assigned_staff_id ?? null,
      booking_status: session.booking_id
        ? "booked"
        : session.booking_recommended
          ? "recommended"
          : "none",
      follow_up_draft_saved: true,
      auto_send_follow_up: recSettings.autoSendFollowUp,
      replay_ready: Boolean(session.recording_url || session.transcript),
    },
  });

  if (lead) {
    const noteBlock = [
      lead.notes,
      `Demo (${now.slice(0, 10)}) — ${demoStatus}`,
      session.summary ? session.summary.slice(0, 1200) : null,
      followUpDraft ? `\n--- Follow-up draft ---\n${followUpDraft.slice(0, 2000)}` : null,
      `\nFollow-up task: ${followUpTaskId} · due ${followUpDue.slice(0, 16)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    await saveLead({
      ...lead,
      lead_status: leadStatus as typeof lead.lead_status,
      lead_category: (category ?? lead.lead_category) as LeadCategory | null | undefined,
      summary: session.summary?.slice(0, 500) || lead.summary,
      next_action:
        session.recommended_next_action ?? lead.next_action ?? "Follow up after demo",
      follow_up_date: followUpDue.slice(0, 10),
      notes: noteBlock,
      metadata: {
        ...(lead.metadata ?? {}),
        last_demo_date: now,
        demo_status: demoStatus,
        demo_session_id: session.id,
        demo_summary: session.summary?.slice(0, 500),
        service_interest: lead.service_interest ?? session.detected_intent,
        objections,
        lead_score: session.lead_score ?? lead.metadata?.lead_score,
        lead_category: category,
        booking_status: session.booking_id ? "booked" : lead.metadata?.booking_status,
        assigned_staff: session.human_takeover_by ?? lead.metadata?.assigned_staff,
        follow_up_task_id: followUpTaskId,
      },
      updated_at: now,
    });

    await recordDemoTimelineEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "crm_updated",
      title: "Lead updated in CRM",
      description: lead.full_name ?? lead.email ?? lead.id,
      metadata: { lead_id: lead.id, lead_status: leadStatus },
    });
  }

  if (session.conversation_id) {
    const conv = await getConversation(session.conversation_id);
    if (conv) {
      await saveConversation({
        ...conv,
        status: session.handoff_required ? "human_needed" : "resolved",
        summary: session.summary?.slice(0, 500) || conv.summary,
        recommended_next_action:
          session.recommended_next_action ?? conv.recommended_next_action,
        conversation_stage: "close",
        metadata: {
          ...(conv.metadata ?? {}),
          post_demo_follow_up_draft: followUpDraft.slice(0, 4000),
          follow_up_due_at: followUpDue,
          follow_up_task_id: followUpTaskId,
        },
        updated_at: now,
      });
    }
  }

  const notifyFollowUp =
    orgSettings.notifications.events.follow_up_due !== false &&
    !session.booking_id;
  if (notifyFollowUp) {
    const leadName = lead?.full_name ?? lead?.email ?? "Prospect";
    await saveNotification({
      id: crypto.randomUUID(),
      organization_id: session.organization_id,
      type: "follow_up_due",
      title: "Demo follow-up due",
      message: `${leadName} — ${buildFollowUpTaskTitle(session, lead, category)}. Review replay: /dashboard/demo-calls/${session.id}/replay`,
      status: "unread",
      metadata: {
        demo_session_id: session.id,
        lead_id: session.lead_id,
        follow_up_task_id: followUpTaskId,
        follow_up_due_at: followUpDue,
        lead_category: category,
        assigned_staff_id: session.human_takeover_by,
      },
      created_at: now,
    });
    await saveDemoSession({
      ...saved,
      metadata: { ...saved.metadata, internal_notification_sent: true },
    });
  }

  await recordDemoTimelineEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "follow_up_scheduled",
    title: "Follow-up task created",
    description: `Due ${new Date(followUpDue).toLocaleString()}`,
    metadata: { follow_up_task_id: followUpTaskId, follow_up_due_at: followUpDue },
  });

  await recordDemoEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "demo_completed",
    description: "Post-demo automation completed",
    metadata: { follow_up_due_at: followUpDue, follow_up_task_id: followUpTaskId },
  });

  return (await getDemoSession(session.id)) ?? saved;
}

function buildFollowUpTaskTitle(
  session: DemoSession,
  lead: { full_name?: string | null; email?: string | null } | null,
  category: string | null
): string {
  const name = lead?.full_name ?? lead?.email ?? "prospect";
  const cat = category ? ` (${category} lead)` : "";
  if (session.booking_id) return `Confirm booking with ${name}`;
  if (session.human_takeover_by) return `Follow up after live handoff — ${name}${cat}`;
  return `Post-demo follow-up — ${name}${cat}`;
}
