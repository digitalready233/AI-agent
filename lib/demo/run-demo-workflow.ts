import { isLlmConfigured } from "@/lib/agent/llm-env";

import {

  findOrCreateConversationBySession,

  getAgent,

  getKnowledgeContextForAgent,

  getLead,

  saveConversation,

  saveNotification,

} from "@/lib/platform/data";

import type { LeadCategory } from "@/lib/platform/types";

import { WorkflowError } from "@/lib/platform/workflow/types";

import { loadWorkflowContext } from "@/lib/platform/workflow/workflow-context";

import {
  applyDemoHotLeadPromotion,
  resolveDemoLeadCategory,
  sumDemoBantScores,
} from "./demo-lead-scoring";

import { upsertLeadFromWorkflow } from "@/lib/platform/workflow/lead-sync";

import type { WorkflowAnalysis } from "@/lib/platform/workflow/schemas";

import { analyzeDemoTurn } from "./demo-analyze";
import {
  defaultRecommendedNextAction,
  enrichDemoAnalysisFromHeuristics,
} from "./bant-heuristics";
import { listDemoPaths } from "./demo-paths-data";
import { seedDefaultDemoPathsForAgent } from "./seed-default-paths";
import { resolveDemoPathForTurn } from "./select-demo-path";
import { assetsForDemoPath, resolveNextDemoAsset } from "./resolve-demo-asset";
import {
  computeQualificationProgress,
  isQualificationStrong,
  qualificationProgressScore,
} from "./qualification-progress";
import { detectObjectionTags, mergeObjectionTags } from "./objection-tracker";
import { normalizeDemoStage } from "./demo-stages";
import { toDemoVoiceText } from "./voice-tts";

import { buildDemoSafeFallbackResponse } from "./demo-fallback";
import {
  applyAiPresentationFromWorkflow,
  derivePresentationAction,
  normalizePresentationControlMode,
} from "./presentation-control";
import { resolveAiPresenterState } from "./resolve-ai-presenter-state";
import { syncAiPresenterState } from "./sync-ai-presenter";
import { sendAvatarSpeechFromWorkflow } from "@/lib/avatar/avatar-session-service";

import {

  buildDemoWorkflowResponse,

  demoWorkflowInputSchema,

  hasEnoughLeadInfoForCreate,

  hasDemoLeadSignalForSync,

  mapDemoIntentToWorkflow,

  type DemoWorkflowInput,
  type DemoWorkflowResponse,
} from "./demo-schemas";

import { generateDemoResponse } from "./demo-generate";
import { safeRecordDemoTimeline, recordLeadCategoryTimeline } from "./demo-timeline-helpers";

import {
  resolveDemoBookingRecommended,
  resolveDemoHandoffRequired,
  resolveDemoHotLeadAdminAlert,
  resolveHandoffReason,
} from "./demo-handoff";
import { isDemoAiPaused, triggerDemoHandoff } from "./demo-live-handoff";

import { buildDemoSystemPrompt } from "./demo-prompt";
import { buildLiveKitDemoVoicePrompt } from "./demo-livekit-ai-prompt";

import {

  appendDemoTranscript,

  getDemoSession,

  listDemoAssets,

  listDemoMessages,

  rebuildSessionTranscript,

  saveDemoMessage,

  saveDemoSession,

} from "./demo-data";

import type { DemoStage, RunDemoWorkflowResult } from "./types";
import {
  getMultiAgentDemoSettings,
  isMultiAgentDemoEnabledForSession,
} from "./multi-agent/settings";
import {
  applyMultiAgentInsightsToTurn,
  runMultiAgentSpecialistsForTurn,
} from "./multi-agent/run-multi-agent-specialists";
import { runPresenterAgent } from "./multi-agent/specialist-runner";



function demoAnalysisToWorkflow(analysis: Awaited<ReturnType<typeof analyzeDemoTurn>>): WorkflowAnalysis {

  const stageMap: Record<string, WorkflowAnalysis["conversation_stage"]> = {
    welcome: "greeting",
    need_discovery: "discovery",
    demo_path_selection: "discovery",
    presentation: "recommendation",
    value_explanation: "recommendation",
    objection_handling: "objection_handling",
    qualification: "qualification",
    recommendation: "recommendation",
    booking: "booking",
    human_handoff: "handoff",
    close: "close",
    discovery: "discovery",
    product_overview: "recommendation",
    feature_explanation: "recommendation",
    use_case_match: "qualification",
    booking_recommendation: "booking",
    handoff: "handoff",
  };

  return {

    detected_intent: mapDemoIntentToWorkflow(analysis.detected_intent),

    conversation_stage: stageMap[analysis.current_demo_stage] ?? "discovery",

    ai_confidence: analysis.flags.low_confidence ? 0.45 : 0.88,

    conversation_summary: analysis.conversation_summary,

    recommended_next_action: analysis.recommended_next_action,

    lead_extraction: analysis.lead_extraction,

    lead_scores: analysis.lead_scores,

    flags: {

      custom_pricing_requested: analysis.flags.custom_pricing_requested ?? false,

      ready_to_pay: analysis.flags.ready_to_book,

      human_requested: analysis.flags.human_requested,

      serious_objection: analysis.flags.serious_objection,

      complaint_detected: analysis.flags.complaint_detected ?? false,

    },

    suggest_booking: analysis.suggest_booking,

  };

}



export async function runDemoWorkflow(

  input: DemoWorkflowInput

): Promise<RunDemoWorkflowResult & { structured?: DemoWorkflowResponse }> {

  const parsed = demoWorkflowInputSchema.safeParse(input);

  if (!parsed.success) {

    throw new WorkflowError(

      parsed.error.errors.map((e) => e.message).join("; "),

      "VALIDATION_ERROR",

      400

    );

  }



  const {

    organizationId,

    demoSessionId,

    agentId,

    leadId,

    customerMessage,

    inputType,

    participantRole,

    transcriptSegment,

    currentDemoStep,

    currentDemoAssetId,

    channel,

    customerMetadata,

    livekitAiVoice,

  } = parsed.data;

  const effectiveMessage = (transcriptSegment?.trim() || customerMessage).trim();



  if (!isLlmConfigured()) {

    throw new WorkflowError(

      "LLM not configured. Set OPENAI_API_KEY or GROQ_API_KEY on the server.",

      "LLM_NOT_CONFIGURED",

      503

    );

  }



  const session = await getDemoSession(demoSessionId);

  if (!session || session.organization_id !== organizationId) {

    throw new WorkflowError("Demo session not found.", "NOT_FOUND", 404);

  }

  if (isDemoAiPaused(session) && participantRole === "prospect") {

    const staffName =
      typeof session.metadata?.active_staff_name === "string"
        ? session.metadata.active_staff_name
        : null;
    const paused = staffName
      ? `${staffName} is now assisting you directly.`
      : "A team member is assisting you. Please continue in the chat — AI replies are paused.";

    const now = new Date().toISOString();

    const agentEarly = await getAgent(agentId);

    const agentMsgPaused = await saveDemoMessage({

      id: crypto.randomUUID(),

      organization_id: organizationId,

      demo_session_id: demoSessionId,

      sender_type: "system",

      sender_name: "Demo",

      content: paused,

      metadata: { ai_paused: true },

      created_at: now,

    });

    return {
      aiResponse: paused,
      aiVoiceText: paused,
      demoStage: session.current_demo_stage,
      currentDemoStage: session.current_demo_stage,
      selectedDemoPathId: session.demo_path_id ?? null,
      currentDemoAssetId: session.current_demo_asset_id ?? null,
      nextDemoAsset: null,
      nextDemoAssetId: null,
      detectedIntent: session.detected_intent,
      leadScore: session.lead_score ?? 0,
      leadCategory: session.lead_category,
      bookingRecommended: session.booking_recommended,
      handoffRequired: true,
      recommendedNextAction: session.recommended_next_action,
      qualificationProgress: session.qualification_progress,
      objections: session.objections ?? [],
      bookingId: session.booking_id ?? null,
      messageId: agentMsgPaused.id,
      aiPaused: true,
      humanTakeoverActive: true,
    };

  }



  let agent = await getAgent(agentId);

  if (!agent || agent.organization_id !== organizationId || !agent.enabled) {

    throw new WorkflowError("Agent not found.", "AGENT_NOT_FOUND", 404);

  }

  const multiSettings = await getMultiAgentDemoSettings(organizationId);
  const useMultiAgent =
    parsed.data.multiAgentMode === true ||
    isMultiAgentDemoEnabledForSession(session, multiSettings);

  let multiAgentInsights: Awaited<
    ReturnType<typeof runMultiAgentSpecialistsForTurn>
  > | null = null;
  let multiAgentCrmSummary: string | undefined;
  let multiAgentFollowUp: string | undefined;
  let multiAgentInternalBrief = "";

  const ctx = await loadWorkflowContext(organizationId, agent);

  const priorMessages = await listDemoMessages(demoSessionId);

  const history = priorMessages

    .filter((m) => m.sender_type === "prospect" || m.sender_type === "agent")

    .map((m) => ({

      role: m.sender_type === "prospect" ? ("user" as const) : ("assistant" as const),

      content: m.content,

    }));



  const assets = await listDemoAssets(organizationId, agentId);

  await seedDefaultDemoPathsForAgent({ organizationId, agentId });
  const demoPaths = await listDemoPaths(organizationId, agentId);

  const pathsSummary = demoPaths
    .map(
      (p) =>
        `${p.id} | ${p.path_key ?? "path"} | ${p.title} | assets: ${(p.demo_asset_sequence ?? []).join(", ")}`
    )
    .join("\n");

  const assetsSummary = assets
    .map((a) => `${a.id} | ${a.asset_type} | ${a.title}`)
    .join("\n");

  const knowledgeContext = await getKnowledgeContextForAgent(agentId, organizationId, {
    strict: true,
  });

  const currentStage = normalizeDemoStage(
    currentDemoStep || session.current_demo_stage
  );



  const activeAssetId =

    currentDemoAssetId ??

    (typeof session.metadata?.last_asset_id === "string"

      ? session.metadata.last_asset_id

      : null);



  let analysis: Awaited<ReturnType<typeof analyzeDemoTurn>>;

  let usedFallback = false;



  try {

    analysis = await analyzeDemoTurn({
      ctx,
      customerMessage: effectiveMessage,
      history,
      knowledgeContext,
      assetsSummary,
      pathsSummary,
      demoPaths,
      currentStage,
      currentAssetId: activeAssetId,
      priorSummary: session.summary,
      scheduledLeadContext: parsed.data.scheduledLeadContext,
      entryMode: session.entry_mode,
      inputType,
    });

    analysis = enrichDemoAnalysisFromHeuristics(
      analysis,
      effectiveMessage,
      session.qualification_progress
    );

  } catch (err) {

    console.error("[runDemoWorkflow] analyze failed", { demoSessionId, err });

    if (err instanceof WorkflowError) throw err;

    usedFallback = true;

    analysis = {
      detected_intent: "general_enquiry",
      current_demo_stage: currentStage,
      conversation_summary: session.summary ?? "Demo in progress.",
      recommended_next_action: "Continue discovery and offer human handoff if needed.",
      next_asset_id: activeAssetId,
      detected_objection_tags: [],
      lead_extraction: {},
      lead_scores: { need: 0, budget: 0, authority: 0, timeline: 0 },
      flags: {
        human_requested: false,
        serious_objection: false,
        ready_to_book: false,
        custom_pricing_requested: false,
        complaint_detected: false,
        outside_knowledge: true,
        low_confidence: true,
        asks_next_step: false,
        requests_consultation: false,
        ready_to_pay: false,
        wants_final_confirmation: false,
        wants_negotiation: false,
      },
      suggest_booking: false,
      handoff_required: true,
    };
  }

  const pathSelection = resolveDemoPathForTurn({
    paths: demoPaths,
    customerMessage: effectiveMessage,
    llmPathId: analysis.selected_demo_path_id,
    currentPathId: session.demo_path_id,
  });
  const selectedPath = pathSelection.path;
  const pathAssets = assetsForDemoPath(assets, selectedPath);

  if (useMultiAgent) {
    const historyText = history
      .slice(-8)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    multiAgentInsights = await runMultiAgentSpecialistsForTurn({
      organizationId,
      demoSessionId,
      session,
      primaryAgent: agent,
      customerMessage: effectiveMessage,
      historyText,
      priorObjections: session.objections ?? [],
    });
    const presenterId =
      multiAgentInsights.team.presenter_agent ?? agent.id;
    const presenter = await getAgent(presenterId);
    if (presenter?.enabled) {
      agent = presenter;
    }
    const applied = applyMultiAgentInsightsToTurn({
      analysis,
      insights: multiAgentInsights,
      priorObjections: session.objections,
    });
    Object.assign(analysis, applied.analysis);
    multiAgentCrmSummary = applied.crmSummaryUpdate;
    multiAgentFollowUp = applied.followUpRecommendation;
    multiAgentInternalBrief = applied.internalBrief;
  }

  const objectionTags = mergeObjectionTags(
    session.objections,
    [
      ...detectObjectionTags(effectiveMessage),
      ...(analysis.detected_objection_tags ?? []),
      ...(multiAgentInsights?.objection?.objections ?? []),
    ]
  );

  const qualProgress = multiAgentInsights?.qualification?.qualificationProgress
    ? multiAgentInsights.qualification.qualificationProgress
    : computeQualificationProgress(
        analysis.lead_extraction,
        session.qualification_progress
      );

  const scores = multiAgentInsights?.qualification?.leadScore
    ? {
        need: multiAgentInsights.qualification.leadScore.need,
        budget: multiAgentInsights.qualification.leadScore.budget,
        authority: multiAgentInsights.qualification.leadScore.authority,
        timeline: multiAgentInsights.qualification.leadScore.timeline,
        total: multiAgentInsights.qualification.leadScore.total,
      }
    : sumDemoBantScores(analysis.lead_scores);
  let leadCategory: LeadCategory = resolveDemoLeadCategory(scores.total, analysis);
  leadCategory = applyDemoHotLeadPromotion(leadCategory, qualProgress, scores.total);
  if (multiAgentInsights?.qualification?.leadCategory) {
    const lc = String(multiAgentInsights.qualification.leadCategory).toLowerCase();
    if (lc === "hot" || lc === "warm" || lc === "cold") {
      leadCategory = lc as LeadCategory;
    }
  }
  const workflowAnalysis = demoAnalysisToWorkflow(analysis);

  let handoffRequired = resolveDemoHandoffRequired({ analysis, leadCategory });
  let bookingRecommended = resolveDemoBookingRecommended({
    analysis,
    leadCategory,
    handoffRequired,
    qualificationStrong: isQualificationStrong(qualProgress),
  });
  if (multiAgentInsights?.handoff) {
    handoffRequired =
      multiAgentInsights.handoff.handoffRequired || handoffRequired;
  }
  if (multiAgentInsights?.booking) {
    bookingRecommended =
      multiAgentInsights.booking.bookingRecommended || bookingRecommended;
  }

  if (!analysis.recommended_next_action?.trim() || leadCategory === "hot") {
    analysis.recommended_next_action = defaultRecommendedNextAction({
      leadCategory,
      bookingRecommended,
      handoffRequired,
      qualificationProgress: qualProgress,
    });
  }

  const nextAsset = await resolveNextDemoAsset({
    organizationId,
    analysis,
    pathAssets,
    allAssets: assets,
    currentAssetId: activeAssetId,
    lastAssetId:
      session.current_demo_asset_id ??
      (typeof session.metadata?.last_asset_id === "string"
        ? session.metadata.last_asset_id
        : null),
    customerMessage: effectiveMessage,
  });

  const currentAssetId = activeAssetId ?? nextAsset?.id ?? null;

  const voicePresentation = inputType === "voice" || livekitAiVoice === true;
  const systemPrompt =
    livekitAiVoice === true
      ? buildLiveKitDemoVoicePrompt({
          agent,
          knowledgeContext,
          assets: pathAssets.length > 0 ? pathAssets : assets,
          currentStage: analysis.current_demo_stage,
          selectedPath,
          companyName: agent.company_product_name ?? undefined,
        })
      : buildDemoSystemPrompt({
          agent,
          knowledgeContext,
          assets: pathAssets.length > 0 ? pathAssets : assets,
          currentStage: analysis.current_demo_stage,
          selectedPath,
          voiceMode: voicePresentation,
        });



  let aiResponse: string;

  if (usedFallback) {

    aiResponse = buildDemoSafeFallbackResponse({

      reason: "analysis_failed",

      nextAsset,

      handoffSuggested: handoffRequired,

    });

  } else {

    try {

      if (useMultiAgent && multiAgentInternalBrief) {
        const presented = await runPresenterAgent({
          agentId: agent.id,
          systemPrompt,
          customerMessage: effectiveMessage,
          history,
          internalBrief: multiAgentInternalBrief,
          handoffRequired,
          suggestBooking: bookingRecommended,
          handoffMessage: ctx.effective.handoff_message,
          bookingMessage: ctx.effective.booking_message,
          voiceMode: voicePresentation,
        });
        aiResponse = presented.customerResponse;
        if (presented.demoStage) {
          analysis.current_demo_stage = normalizeDemoStage(
            presented.demoStage
          ) as DemoStage;
        }
        if (presented.recommendedNextAction) {
          analysis.recommended_next_action = presented.recommendedNextAction;
        }
      } else {
        aiResponse = await generateDemoResponse({
          systemPrompt,
          customerMessage: effectiveMessage,
          history,
          analysis,
          nextAsset,
          handoffRequired,
          suggestBooking: bookingRecommended,
          handoffMessage: ctx.effective.handoff_message,
          bookingMessage: ctx.effective.booking_message,
          voiceMode: voicePresentation,
        });
      }

    } catch (err) {

      console.error("[runDemoWorkflow] generate failed", { demoSessionId, err });

      usedFallback = true;

      aiResponse = buildDemoSafeFallbackResponse({

        reason: "llm_error",

        nextAsset,

        handoffSuggested: handoffRequired,

      });

    }

  }



  const aiVoiceText =
    inputType === "voice" ? toDemoVoiceText(aiResponse) : undefined;

  if (!isDemoAiPaused(session)) {
    void sendAvatarSpeechFromWorkflow({
      session,
      agent,
      text: aiVoiceText ?? aiResponse,
    });
  }

  const presentationAction = derivePresentationAction({
    selectedPathId: selectedPath?.id ?? null,
    previousPathId: session.demo_path_id ?? null,
    currentAssetId: currentAssetId ?? null,
    nextAssetId: nextAsset?.id ?? null,
    bookingRecommended,
    handoffRequired,
  });

  let presentationSession = session;
  const controlMode = normalizePresentationControlMode(session);
  if (
    !isDemoAiPaused(session) &&
    controlMode !== "staff_controlled" &&
    presentationAction.type !== "none"
  ) {
    presentationSession = await applyAiPresentationFromWorkflow({
      session,
      action: presentationAction,
    });
  }

  const pendingAction = presentationSession.metadata?.pending_presentation_action as
    | typeof presentationAction
    | undefined;

  const structured = buildDemoWorkflowResponse({
    aiResponse,
    aiVoiceText,
    analysis,
    leadScore: scores,
    leadCategory,
    bookingRecommended,
    handoffRequired,
    selectedDemoPathId: selectedPath?.id ?? null,
    currentDemoAssetId:
      presentationSession.current_demo_asset_id ?? currentAssetId ?? null,
    nextAssetId: nextAsset?.id ?? null,
    presentationAction:
      presentationAction.type !== "none" ? presentationAction : undefined,
    pendingPresentationAction: pendingAction ?? null,
  });



  const now = new Date().toISOString();

  const userMsg = await saveDemoMessage({

    id: crypto.randomUUID(),

    organization_id: organizationId,

    demo_session_id: demoSessionId,

    sender_type: "prospect",

    sender_name: customerMetadata?.name ?? null,

    content: effectiveMessage,

    metadata: { input_type: inputType },

    created_at: now,

  });



  const agentMsg = await saveDemoMessage({

    id: crypto.randomUUID(),

    organization_id: organizationId,

    demo_session_id: demoSessionId,

    sender_type: "agent",

    sender_name: agent.name,

    content: aiResponse,

    metadata: {

      ...(nextAsset ? { asset_id: nextAsset.id } : {}),

      ...(usedFallback ? { fallback: true } : {}),

      lead_category: leadCategory,

      lead_score: scores.total,

    },

    created_at: new Date().toISOString(),

  });



  const seq = priorMessages.length;

  await appendDemoTranscript({

    id: crypto.randomUUID(),

    organization_id: organizationId,

    demo_session_id: demoSessionId,

    speaker: "prospect",

    speaker_type: "prospect",

    content: effectiveMessage,

    input_type: inputType,

    sequence_num: seq,

    created_at: now,

  });

  await appendDemoTranscript({

    id: crypto.randomUUID(),

    organization_id: organizationId,

    demo_session_id: demoSessionId,

    speaker: "agent",

    speaker_type: "agent",

    content: aiVoiceText ?? aiResponse,

    input_type: inputType,

    sequence_num: seq + 1,

    created_at: agentMsg.created_at,

  });



  let lead =

    leadId ? await getLead(leadId) : session.lead_id ? await getLead(session.lead_id) : null;



  const conversation = await findOrCreateConversationBySession({

    organizationId,

    agentId,

    sessionId: demoSessionId,

    channel,

  });



  const shouldSyncLead =

    Boolean(lead) ||

    hasEnoughLeadInfoForCreate(analysis.lead_extraction, customerMetadata) ||

    hasDemoLeadSignalForSync(analysis.lead_extraction, customerMetadata);



  if (shouldSyncLead) {

    lead = await upsertLeadFromWorkflow({

      organizationId,

      conversation: {

        ...conversation,

        lead_id: lead?.id ?? null,

        status: handoffRequired ? "human_needed" : "ai_handling",

        summary: analysis.conversation_summary,

        updated_at: now,

      },

      analysis: workflowAnalysis,

      channel: "demo_call",

      scoring: ctx.settings.lead_scoring,

      pipeline: ctx.settings.sales_pipeline,

      workspace: ctx.settings.workspace,

      customerMetadata: {

        ...customerMetadata,

        serviceInterest: analysis.lead_extraction.service_interest,

        budget: analysis.lead_extraction.budget,

        timeline: analysis.lead_extraction.timeline,

      },

      existingLead: lead,

    });

  }



  const settings = ctx.settings;
  const handoffReason = resolveHandoffReason({ analysis, leadCategory });

  if (handoffRequired && !session.handoff_required) {
    await triggerDemoHandoff({
      demoSessionId,
      requestedBy: "system",
      reason: handoffReason,
      analysis,
      leadCategory,
      skipNotification:
        settings.notifications.events.human_handoff_required === false,
    });
  } else if (

    resolveDemoHotLeadAdminAlert({

      leadCategory,

      analysis,

      previousCategory: session.lead_category as LeadCategory | null | undefined,

    })

  ) {

    if (settings.notifications.events.new_hot_lead !== false) {

      await saveNotification({

        id: crypto.randomUUID(),

        organization_id: organizationId,

        type: "hot_lead",

        title: "Hot lead in live demo",

        message: `${lead?.full_name ?? "Prospect"} on "${session.title}" — score ${scores.total}. Budget/timeline shared; consider joining the demo.`,

        status: "unread",

        metadata: {

          link: `/dashboard/demo-calls/${demoSessionId}`,

          demo_session_id: demoSessionId,

          lead_id: lead?.id,

          lead_category: leadCategory,

        },

        created_at: now,

      });

    }

  }



  const transcript = await rebuildSessionTranscript(demoSessionId);

  await saveDemoSession({

    ...session,

    conversation_id: conversation.id,

    lead_id: lead?.id ?? session.lead_id,

    status:
      session.status === "human_taken_over"
        ? session.status
        : session.status === "waiting" || session.status === "scheduled"
          ? "in_progress"
          : session.status,

    current_demo_stage: analysis.current_demo_stage,
    demo_path_id:
      presentationSession.demo_path_id ?? selectedPath?.id ?? session.demo_path_id ?? null,
    current_demo_asset_id:
      presentationSession.current_demo_asset_id ?? nextAsset?.id ?? currentAssetId,
    current_presenter_type:
      presentationSession.current_presenter_type ??
      (isDemoAiPaused(session) ? "staff" : "ai"),
    current_presenter_id:
      presentationSession.current_presenter_id ??
      (isDemoAiPaused(session) ? null : "ai-agent"),
    presentation_control_mode:
      presentationSession.presentation_control_mode ?? controlMode,
    booking_recommended:
      presentationSession.booking_recommended ?? bookingRecommended,
    objections: objectionTags,
    qualification_progress: qualProgress,
    started_at: session.started_at ?? now,
    detected_intent: analysis.detected_intent,
    lead_score: scores.total,
    lead_category: leadCategory,
    handoff_required: handoffRequired || session.handoff_required,
    handoff_reason: handoffReason ?? session.handoff_reason ?? null,
    handoff_status: handoffRequired
      ? session.handoff_status && session.handoff_status !== "none"
        ? session.handoff_status
        : "notified"
      : session.handoff_status ?? "none",
    recommended_next_action: analysis.recommended_next_action,
    summary: multiAgentCrmSummary ?? structured.demoSummaryUpdate,
    follow_up_draft:
      multiAgentFollowUp ?? session.follow_up_draft ?? null,
    transcript,
    metadata: {
      ...(session.metadata ?? {}),
      multi_agent_last_turn: multiAgentInsights
        ? {
            errors: multiAgentInsights.errors,
            booking: multiAgentInsights.booking,
            handoff: multiAgentInsights.handoff,
            qualification: multiAgentInsights.qualification,
            objection: multiAgentInsights.objection,
            crmSummary: multiAgentInsights.crmSummary,
            followUp: multiAgentInsights.followUp,
          }
        : session.metadata?.multi_agent_last_turn,
      demo_path_title: selectedPath?.title,
      path_selection_reason: pathSelection.reason,
      last_asset_id: nextAsset?.id ?? currentAssetId,
      assets_viewed: nextAsset

        ? [

            ...new Set([

              ...(Array.isArray(session.metadata?.assets_viewed)

                ? (session.metadata.assets_viewed as string[])

                : []),

              nextAsset.title,

            ]),

          ]

        : session.metadata?.assets_viewed,

      video_providers: ["livekit", "daily", "zoom", "agora"],

      last_workflow_fallback: usedFallback,

      last_input_type: inputType,

    },

  });

  const prevPathId = session.demo_path_id;
  const newPathId = selectedPath?.id ?? null;
  if (newPathId && newPathId !== prevPathId) {
    await safeRecordDemoTimeline({
      demoSessionId,
      organizationId,
      eventType: "demo_path_selected",
      title: selectedPath?.title ?? "Demo path selected",
      description: pathSelection.reason,
      metadata: { path_id: newPathId },
    });
  }
  if (nextAsset?.id && nextAsset.id !== currentAssetId) {
    await safeRecordDemoTimeline({
      demoSessionId,
      organizationId,
      eventType: "asset_viewed",
      title: nextAsset.title,
      metadata: { asset_id: nextAsset.id },
    });
  }
  const prevObjections = session.objections ?? [];
  for (const tag of objectionTags) {
    if (!prevObjections.includes(tag)) {
      await safeRecordDemoTimeline({
        demoSessionId,
        organizationId,
        eventType: "objection_detected",
        title: `Objection: ${tag}`,
        metadata: { tag },
      });
    }
  }
  await recordLeadCategoryTimeline({
    demoSessionId,
    organizationId,
    previousCategory: session.lead_category,
    nextCategory: leadCategory,
  });
  if (bookingRecommended && !session.booking_recommended) {
    await safeRecordDemoTimeline({
      demoSessionId,
      organizationId,
      eventType: "booking_recommended",
      title: "Booking recommended",
      metadata: { lead_score: scores.total },
    });
  }
  if (handoffRequired && !session.handoff_required) {
    await safeRecordDemoTimeline({
      demoSessionId,
      organizationId,
      eventType: "handoff_triggered",
      title: "Human handoff triggered",
      description: handoffReason ?? undefined,
    });
  }

  const savedForPresenter = await getDemoSession(demoSessionId);
  if (savedForPresenter) {
    const presenterState = resolveAiPresenterState({
      session: savedForPresenter,
      handoffRequired,
      bookingRecommended,
      presentingAssetId: savedForPresenter.current_demo_asset_id,
      aiPaused: isDemoAiPaused(savedForPresenter),
    });
    await syncAiPresenterState({
      session: savedForPresenter,
      state: presenterState,
      stage: analysis.current_demo_stage,
      assetId: nextAsset?.id ?? savedForPresenter.current_demo_asset_id ?? null,
      assetTitle: nextAsset?.title ?? null,
    });
  }

  await saveConversation({

    ...conversation,

    lead_id: lead?.id ?? conversation.lead_id,

    agent_id: agentId,

    channel,

    status: handoffRequired ? "human_needed" : "ai_handling",

    conversation_stage: workflowAnalysis.conversation_stage,

    detected_intent: workflowAnalysis.detected_intent,

    summary: analysis.conversation_summary,

    recommended_next_action: analysis.recommended_next_action,

    customer_name:

      lead?.full_name ?? customerMetadata?.name ?? conversation.customer_name ?? null,

    customer_email:

      lead?.email ?? customerMetadata?.email ?? conversation.customer_email ?? null,

    customer_phone:

      lead?.phone ?? customerMetadata?.phone ?? conversation.customer_phone ?? null,

    updated_at: now,

  });



  void userMsg;



  return {
    aiResponse,
    aiVoiceText,
    demoStage: analysis.current_demo_stage,
    currentDemoStage: analysis.current_demo_stage,
    selectedDemoPathId: selectedPath?.id ?? null,
    selectedDemoPathTitle: selectedPath?.title ?? null,
    currentDemoAssetId: nextAsset?.id ?? currentAssetId,
    nextDemoAsset: nextAsset,
    nextDemoAssetId: nextAsset?.id ?? null,
    demoSummaryUpdate: structured.demoSummaryUpdate,
    summaryUpdate: structured.demoSummaryUpdate,
    detectedIntent: analysis.detected_intent,
    leadScore: scores.total,
    leadCategory,
    bookingRecommended,
    handoffRequired,
    recommendedNextAction: analysis.recommended_next_action,
    qualificationProgress: qualProgress,
    objections: objectionTags,
    bookingId: session.booking_id ?? null,
    messageId: agentMsg.id,
    structured,
    usedFallback,
  };

}


