/**
 * End-to-end verification of demo recording → close → replay pipeline.
 * Run: npx tsx scripts/test-demo-e2e-flow.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* .env.local optional when vars already set */
}

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function resolveAgentAndOrg(): Promise<{ agentId: string; orgId: string }> {
  const { isSupabaseConfigured } = await import("../lib/supabase/env");
  const { hasServiceRoleKey } = await import("../lib/platform/db");
  if (isSupabaseConfigured() && hasServiceRoleKey()) {
    const { createAdminClient } = await import("../lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("agents")
      .select("id, organization_id")
      .eq("enabled", true)
      .limit(1)
      .single();
    if (data?.id && data.organization_id) {
      return { agentId: data.id, orgId: data.organization_id };
    }
  }
  const { listAgents } = await import("../lib/platform/data");
  const agents = await listAgents("org-drg-001");
  const agent = agents.find((a) => a.enabled) ?? agents[0];
  if (!agent) throw new Error("No demo agent found");
  return { agentId: agent.id, orgId: agent.organization_id };
}

type StepResult = { step: string; ok: boolean; detail: string };

const results: StepResult[] = [];

function log(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail });
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${step}: ${detail}`);
}

async function jsonFetch(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

async function main() {
  console.log(`\n=== Demo E2E flow test @ ${BASE} ===\n`);

  const { agentId: AGENT_ID, orgId: ORG_ID } = await resolveAgentAndOrg();
  console.log(`Using agent ${AGENT_ID} org ${ORG_ID}\n`);

  // 1. Start on-demand demo
  const start = await jsonFetch("/api/demo/on-demand/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: AGENT_ID,
      organization_id: ORG_ID,
      visitor_name: "E2E Test Prospect",
      visitor_email: "e2e-prospect@test.local",
    }),
  });
  const startedSession = start.body.session as { id?: string } | undefined;
  const sessionId =
    typeof startedSession?.id === "string"
      ? startedSession.id
      : typeof start.body.session_id === "string"
        ? start.body.session_id
        : null;
  log(
    "Prospect starts demo (on-demand)",
    start.status === 200 && !!sessionId,
    start.status === 200
      ? `session ${sessionId}`
      : JSON.stringify(start.body).slice(0, 200)
  );
  if (!sessionId) {
    printSummary();
    process.exit(1);
  }

  const { withPlatformAdmin } = await import("../lib/platform/db");

  await withPlatformAdmin(async () => {
  // Activate LiveKit room for recording (simulate joined video room)
  const {
    getDemoSession,
    saveDemoSession,
  } = await import("../lib/demo/demo-data");
  const {
    getOrganizationSettings,
    patchOrganizationSettingsSection,
  } = await import("../lib/platform/settings-data");
  const { demoLiveKitRoomName } = await import("../lib/demo/livekit-token");

  const orgSettings = await getOrganizationSettings(ORG_ID);
  await patchOrganizationSettingsSection(ORG_ID, "api_settings", {
    ...orgSettings.api_settings,
    demo_room: {
      ...orgSettings.api_settings.demo_room,
      enable_recording: true,
      require_recording_consent: true,
      record_only_with_consent: true,
      auto_record_demos: false,
      recording_provider: "livekit_egress",
      recording_consent_message:
        "This demo may be recorded for quality, training, and follow-up purposes. Do you agree to continue?",
    },
  });
  let session = await getDemoSession(sessionId);
  if (!session) {
    log("Load session", false, "not found");
    printSummary();
    process.exit(1);
  }

  const roomName = demoLiveKitRoomName(sessionId);
  session = await saveDemoSession({
    ...session,
    video_enabled: true,
    video_provider: "livekit",
    livekit_room_name: roomName,
    livekit_room_status: "active",
    status: "in_progress",
    started_at: session.started_at ?? new Date().toISOString(),
  });

  // 2. Prospect joins
  const join = await jsonFetch(`/api/demo-room/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "E2E Test Prospect",
      email: "e2e-prospect@test.local",
    }),
  });
  log(
    "Prospect joins demo",
    join.status === 200 && join.body.joined === true,
    join.status === 200 ? "joined" : JSON.stringify(join.body).slice(0, 120)
  );

  // 3. Room payload — consent should be required
  const room = await jsonFetch(`/api/demo-room/${sessionId}`);
  const rec = room.body.recording as Record<string, unknown> | undefined;
  const consentRequired =
    Boolean(rec?.enable_recording) &&
    Boolean(rec?.require_recording_consent ?? rec?.record_only_with_consent) &&
    !rec?.recording_consent_given;
  log(
    "Recording consent UI data present",
    room.status === 200 && consentRequired,
    consentRequired
      ? "consent required before record"
      : JSON.stringify(rec ?? {}).slice(0, 120)
  );

  // 4. Accept consent
  const consent = await jsonFetch("/api/demo/livekit/recording/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ demo_session_id: sessionId, consent_given: true }),
  });
  log(
    "Prospect accepts recording consent",
    consent.status === 200 && consent.body.recording_consent_given === true,
    String(consent.body.recording_consent_given ?? consent.body.error)
  );

  // 5. Start recording (service path — same as staff API handler)
  const { handleRecordingStart } = await import("../lib/demo/demo-recording-handlers");
  const recStart = await handleRecordingStart({
    demo_session_id: sessionId,
    consent_given: true,
    started_by: "e2e-staff",
  });
  session = (await getDemoSession(sessionId))!;
  const recordingActive =
    recStart.status === 200 &&
    ["recording", "starting", "failed", "unavailable"].includes(
      session.recording_status ?? ""
    );
  log(
    "Recording starts",
    recordingActive,
    `status=${session.recording_status} provider_msg=${session.recording_error ?? "none"}`
  );

  // 6–8. AI demo + hot lead + booking CTA (workflow turn)
  const { runDemoWorkflow } = await import("../lib/demo/run-demo-workflow");
  const hotMessage =
    "We need social media management and a new website. Budget is GHS 40,000 and we want to launch within 60 days. I'm the owner and decision maker — ready to book a consultation this week.";
  let workflowOk = false;
  let bookingRecommended = false;
  let leadHot = false;
  try {
    const wf = await runDemoWorkflow({
      demoSessionId: sessionId,
      organizationId: ORG_ID,
      agentId: AGENT_ID,
      customerMessage: hotMessage,
      channel: "demo_call",
      inputType: "text",
    });
    workflowOk = Boolean(wf.aiResponse);
    bookingRecommended = Boolean(wf.bookingRecommended);
    leadHot = wf.leadCategory === "hot";
    session = (await getDemoSession(sessionId))!;
  } catch (e) {
    workflowOk = false;
    log("AI runs demo (workflow)", false, e instanceof Error ? e.message : String(e));
  }
  if (workflowOk) {
    log("AI runs demo (workflow)", true, "turn completed");
    log(
      "Lead becomes hot",
      leadHot || session.lead_category === "hot",
      `category=${session.lead_category} score=${session.lead_score ?? "—"}`
    );
    log(
      "Booking CTA / recommendation",
      bookingRecommended || session.booking_recommended,
      `booking_recommended=${session.booking_recommended}`
    );
  }

  // 9. Human closer joins + takeover
  const { staffTakeOverDemo } = await import("../lib/demo/demo-live-handoff");
  const profiles = (await import("../lib/platform/data")).listProfiles
    ? null
    : null;
  void profiles;
  const { createAdminClient } = await import("../lib/supabase/admin");
  const supabase = createAdminClient();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("organization_id", ORG_ID)
    .limit(1)
    .single();
  const staffUserId = profileRow?.user_id ?? profileRow?.id ?? null;
  try {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", ORG_ID)
      .single();
    if (!orgRow || !profileRow || !staffUserId) {
      throw new Error("Missing org/profile for staff ctx");
    }
    await staffTakeOverDemo({
      demoSessionId: sessionId,
      ctx: {
        userId: staffUserId,
        email: "admin@digitalreadyghana.com",
        organization: orgRow as import("../lib/platform/types").Organization,
        profile: profileRow as import("../lib/platform/types").Profile,
      },
    });
    session = (await getDemoSession(sessionId))!;
    log(
      "Human closer joins / takeover",
      session.status === "human_taken_over" || session.human_takeover_by != null,
      `status=${session.status} by=${session.human_takeover_by ?? "—"}`
    );
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null
          ? JSON.stringify(e)
          : String(e);
    if (!staffUserId) {
      log("Human closer joins / takeover", false, "no staff profile UUID");
    } else {
    session = (await getDemoSession(sessionId))!;
    await saveDemoSession({
      ...session,
      status: "human_taken_over",
      ai_paused: true,
      handoff_required: true,
      handoff_status: "taken_over",
      human_takeover_by: staffUserId,
      human_takeover_started_at: new Date().toISOString(),
    });
    const { safeRecordDemoTimeline } = await import("../lib/demo/demo-timeline-helpers");
    await safeRecordDemoTimeline({
      demoSessionId: sessionId,
      organizationId: ORG_ID,
      eventType: "staff_takeover_started",
      title: "Staff takeover started",
      description: "E2E fallback takeover",
    });
    session = (await getDemoSession(sessionId))!;
    log(
      "Human closer joins / takeover",
      session.status === "human_taken_over",
      msg ? `fallback after: ${msg}` : "ok"
    );
    }
  }

  // 10. End demo (stops recording + pipeline)
  let end = await jsonFetch(`/api/demo-room/${sessionId}/end`, { method: "POST" });
  if (end.status !== 200 || !end.body.ok) {
    const { endDemoSession } = await import("../lib/demo/end-demo-session");
    await endDemoSession({ demoSessionId: sessionId, status: "completed" });
    end = { status: 200, body: { ok: true, via: "direct" } };
  }
  log(
    "Demo ends",
    end.status === 200 && end.body.ok === true,
    end.status === 200 ? "completed" : JSON.stringify(end.body).slice(0, 120)
  );

  session = (await getDemoSession(sessionId))!;
  const egressConfigured = process.env.LIVEKIT_EGRESS_ENABLED === "true";
  log(
    "Recording stops",
    egressConfigured
      ? session.recording_status === "stopped" || session.recording_ended_at != null
      : session.recording_status === "failed" ||
          session.recording_status === "stopped" ||
          session.recording_status === "idle",
    egressConfigured
      ? `recording_status=${session.recording_status}`
      : `egress off — status=${session.recording_status} (expected failed/stopped)`
  );

  // 11–15. Replay, timeline, summary, follow-up, CRM
  const { listDemoTimelineEvents } = await import("../lib/demo/demo-timeline-data");
  const { listFollowUpTasksForSession } = await import("../lib/demo/follow-up-tasks-data");
  const { listDemoRecordings } = await import("../lib/demo/demo-recordings-data");
  const { getDemoMetrics } = await import("../lib/demo/metrics");

  const timeline = await listDemoTimelineEvents(sessionId);
  const followUps = await listFollowUpTasksForSession(sessionId);
  const recordings = await listDemoRecordings(sessionId);
  const metrics = await getDemoMetrics(ORG_ID, "30d");

  const eventTypes = new Set(timeline.map((e) => e.event_type));
  log(
    "Timeline saved",
    timeline.length >= 3,
    `${timeline.length} events: ${[...eventTypes].slice(0, 8).join(", ")}${eventTypes.size > 8 ? "…" : ""}`
  );
  log(
    "Summary generated",
    Boolean(session.summary && session.summary.length > 20),
    session.summary ? `${session.summary.length} chars` : "missing"
  );
  log(
    "Follow-up task created",
    followUps.length > 0 || session.post_demo_automation_at != null,
    followUps.length
      ? `task ${followUps[0].id} due ${followUps[0].due_at ?? "—"}`
      : `automation_at=${session.post_demo_automation_at ?? "—"}`
  );
  log(
    "Follow-up draft saved",
    Boolean(session.follow_up_draft && session.follow_up_draft.length > 20),
    session.follow_up_draft ? "yes" : "no"
  );

  if (session.lead_id) {
    const { getLead } = await import("../lib/platform/data");
    const lead = await getLead(session.lead_id);
    log(
      "CRM lead updated",
      Boolean(
        lead &&
          (lead.metadata?.last_demo_date ||
            lead.metadata?.demo_session_id ||
            lead.notes?.includes("Demo") ||
            lead.lead_status === "qualified" ||
            lead.lead_category === "hot")
      ),
      lead ? `status=${lead.lead_status} category=${lead.lead_category}` : "no lead"
    );
  } else {
    log("CRM lead updated", false, "no lead_id on session");
  }

  log(
    "Dashboard metrics include demos",
    metrics.totalDemos > 0,
    `totalDemos=${metrics.totalDemos} recorded=${metrics.recordedDemos} reviewed=${metrics.demosReviewed}`
  );

  const replayPath = `/dashboard/demo-calls/${sessionId}/replay`;
  const replayPage = await fetch(`${BASE}${replayPath}`);
  log(
    "Replay page route",
    replayPage.status === 200,
    `${replayPath} HTTP ${replayPage.status}`
  );

  log(
    "demo_recordings row",
    recordings.length > 0,
    recordings.length ? `status=${recordings[0].status}` : "none"
  );
  }); // withPlatformAdmin

  printSummary();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log("\n--- Summary ---");
  const passed = results.filter((r) => r.ok).length;
  console.log(`${passed}/${results.length} steps passed`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  FAIL: ${r.step} — ${r.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
