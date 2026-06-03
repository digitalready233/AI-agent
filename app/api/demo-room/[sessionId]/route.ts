import { getAgent, getLead } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { isDemoRoomAiEnabled } from "@/lib/demo/config";
import {
  getDemoSession,
  listDemoAssets,
  listDemoMessages,
  listDemoParticipants,
  listDemoTranscripts,
} from "@/lib/demo/demo-data";
import { isDemoAiPaused } from "@/lib/demo/demo-live-handoff";
import { handoffReasonLabel } from "@/lib/demo/demo-handoff";
import {
  shouldUseLiveKitVideo,
  resolveSessionVideoProvider,
} from "@/lib/demo/livekit-service";
import { getDemoPath } from "@/lib/demo/demo-paths-data";
import { assetsForDemoPath } from "@/lib/demo/resolve-demo-asset";
import { getPathSlideBrandingMap } from "@/lib/demo/slide-branding";
import { getDemoProviderSettings, isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";
import {
  parseAiPresenterOrgSettings,
  parseAgentPresenterConfig,
  resolvePresenterDisplay,
} from "@/lib/demo/ai-presenter-settings";
import { DEFAULT_AVATAR_ORG_SETTINGS } from "@/lib/avatar/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo room not configured." }, { status: 503 });
  }

  const { sessionId } = await params;

  return withPlatformAdmin(async () => {
    const session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Demo not found" }, { status: 404 });
    }

    const agent = session.agent_id ? await getAgent(session.agent_id) : null;
    if (!agent?.enabled) {
      return Response.json({ error: "Demo not available" }, { status: 404 });
    }

    const [allAssets, messages, transcripts, providerSettings, demoPath, participants] =
      await Promise.all([
        listDemoAssets(session.organization_id, agent.id),
        listDemoMessages(sessionId),
        listDemoTranscripts(sessionId),
        getDemoProviderSettings(session.organization_id),
        session.demo_path_id ? getDemoPath(session.demo_path_id) : null,
        listDemoParticipants(sessionId),
      ]);
    const staffParticipants = participants.filter(
      (p) => p.role === "staff" && !p.left_at
    );
    const activeStaffName =
      (typeof session.metadata?.active_staff_name === "string"
        ? session.metadata.active_staff_name
        : null) ??
      staffParticipants[staffParticipants.length - 1]?.display_name ??
      null;
    const presentationAssets = assetsForDemoPath(allAssets, demoPath);
    const lead = session.lead_id ? await getLead(session.lead_id) : null;
    const presenterOrg = parseAiPresenterOrgSettings(providerSettings);
    const presenterDisplay = resolvePresenterDisplay(agent, presenterOrg);
    const currentAsset = presentationAssets.find(
      (a) => a.id === session.current_demo_asset_id
    );

    const resumable =
      messages.length > 0 &&
      ["in_progress", "human_taken_over", "completed"].includes(session.status);

    return Response.json({
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        current_demo_stage: session.current_demo_stage,
        entry_mode: session.entry_mode ?? "scheduled",
        demo_path_id: session.demo_path_id ?? null,
        demo_path_title:
          demoPath?.title ??
          (typeof session.metadata?.demo_path_title === "string"
            ? session.metadata.demo_path_title
            : null),
        recommended_cta: demoPath?.recommended_cta ?? null,
        slide_branding: getPathSlideBrandingMap(demoPath),
        current_demo_asset_id: session.current_demo_asset_id ?? null,
        objections: session.objections ?? [],
        qualification_progress: session.qualification_progress ?? {
          need: false,
          budget: false,
          authority: false,
          timeline: false,
        },
        handoff_required: session.handoff_required,
        handoff_status: session.handoff_status ?? "none",
        handoff_reason: session.handoff_reason ?? null,
        handoff_reason_label: handoffReasonLabel(session.handoff_reason),
        ai_paused: isDemoAiPaused(session),
        active_staff_name: activeStaffName,
        booking_recommended: session.booking_recommended,
        lead_category: session.lead_category,
        lead_score: session.lead_score,
        started_at: session.started_at,
        conversation_id: session.conversation_id,
        booking_id: session.booking_id,
        summary: session.summary,
        recommended_next_action: session.recommended_next_action,
        video_provider: resolveSessionVideoProvider(session),
        livekit_room_name: session.livekit_room_name ?? null,
        livekit_room_status: session.livekit_room_status ?? "not_created",
        video_enabled: session.video_enabled ?? false,
        audio_enabled: session.audio_enabled ?? true,
        screen_share_enabled: session.screen_share_enabled ?? false,
        screen_share_active: session.screen_share_active ?? false,
        presentation_control_mode:
          session.presentation_control_mode ?? "ai_controlled",
        current_presenter_type: session.current_presenter_type ?? null,
        current_presenter_id: session.current_presenter_id ?? null,
        presenter_name:
          typeof session.metadata?.presenter_name === "string"
            ? session.metadata.presenter_name
            : activeStaffName,
        pending_presentation_action: session.metadata?.pending_presentation_action ?? null,
        recording_enabled: session.recording_enabled ?? false,
        use_livekit_video: shouldUseLiveKitVideo(session),
        ai_joined: session.ai_joined ?? false,
        ai_status: session.ai_status ?? "not_started",
        ai_participant_identity: session.ai_participant_identity ?? null,
        ai_last_response_at: session.ai_last_response_at ?? null,
        ai_audio_track_published: session.ai_audio_track_published ?? false,
        ai_audio_mode: session.ai_audio_mode ?? "fallback_tts",
        ai_audio_status: session.ai_audio_status ?? "idle",
        ai_audio_error: session.ai_audio_error ?? null,
        ai_last_spoken_at: session.ai_last_spoken_at ?? null,
        enable_ai_auto_join: providerSettings.enable_ai_auto_join !== false,
        ai_presenter_state: session.ai_presenter_state ?? "idle",
        ai_presenter_mode: session.ai_presenter_mode ?? "animated_card",
        ai_presenter_last_stage: session.ai_presenter_last_stage ?? null,
        ai_presenter_last_asset_id: session.ai_presenter_last_asset_id ?? null,
        ai_presenter_last_updated_at: session.ai_presenter_last_updated_at ?? null,
        ai_presenter_asset_title:
          typeof session.metadata?.ai_presenter_asset_title === "string"
            ? session.metadata.ai_presenter_asset_title
            : currentAsset?.title ?? null,
        avatar_session_id: session.avatar_session_id ?? null,
        avatar_provider: session.avatar_provider ?? agent.avatar_provider ?? null,
        avatar_status: session.avatar_status ?? "not_started",
        avatar_stream_url: session.avatar_stream_url ?? null,
        avatar_join_url: session.avatar_join_url ?? null,
        avatar_error: session.avatar_error ?? null,
        tavus_conversation_id: session.tavus_conversation_id ?? null,
        tavus_conversation_url: session.tavus_conversation_url ?? null,
        tavus_replica_id: session.tavus_replica_id ?? null,
        tavus_persona_id: session.tavus_persona_id ?? null,
        did_agent_id: session.did_agent_id ?? null,
        did_stream_id: session.did_stream_id ?? null,
        did_session_id: session.did_session_id ?? null,
        avatar_fallback_provider: session.avatar_fallback_provider ?? null,
        avatar_routing_rule_id: session.avatar_routing_rule_id ?? null,
        avatar_selection_source:
          typeof session.metadata?.avatar_selection_source === "string"
            ? session.metadata.avatar_selection_source
            : null,
        avatar_routing_rule_name:
          typeof session.metadata?.avatar_routing_rule_name === "string"
            ? session.metadata.avatar_routing_rule_name
            : null,
      },
      presenter_settings: presenterOrg,
      presenter_display: presenterDisplay,
      avatar_settings: {
        ...DEFAULT_AVATAR_ORG_SETTINGS,
        ...providerSettings.avatar,
      },
      resumable,
      messages: messages.map((m) => ({
        id: m.id,
        sender_type: m.sender_type,
        sender_name: m.sender_name,
        content: m.content,
        created_at: m.created_at,
      })),
      lead: lead
        ? {
            id: lead.id,
            full_name: lead.full_name,
            email: lead.email,
            phone: lead.phone,
            business_name: lead.business_name,
            industry: (lead as { industry?: string | null }).industry ?? null,
            service_interest: lead.service_interest,
            lead_category: lead.lead_category,
            budget: lead.budget,
            timeline: lead.timeline,
            source: lead.source ?? null,
          }
        : null,
      has_lead: Boolean(session.lead_id),
      staff_participants: staffParticipants.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        joined_at: p.joined_at,
      })),
      stage1_placeholder: !isDemoRoomAiEnabled(),
      booking_placeholder: !isDemoRoomAiEnabled(),
      agent: {
        id: agent.id,
        name: agent.name,
        company_product_name: agent.company_product_name,
        welcome_message: agent.welcome_message,
        avatar_url: agent.avatar_url ?? null,
        position: agent.position ?? null,
        presenter_config: parseAgentPresenterConfig(agent),
        avatar_enabled: agent.avatar_enabled ?? false,
        avatar_provider: agent.avatar_provider ?? "internal_card",
      },
      assets: presentationAssets.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        asset_type: a.asset_type,
        sort_order: a.sort_order,
      })),
      all_assets_count: allAssets.length,
      transcripts,
      recording: {
        enable_recording:
          providerSettings.enable_recording ??
          providerSettings.enable_recording_placeholder ??
          false,
        auto_record_demos: providerSettings.auto_record_demos ?? false,
        record_only_with_consent: providerSettings.record_only_with_consent ?? true,
        require_recording_consent:
          providerSettings.require_recording_consent ??
          providerSettings.record_only_with_consent ??
          true,
        consent_message:
          providerSettings.recording_consent_message ??
          "This demo may be recorded for quality, training, and follow-up purposes. Do you agree to continue?",
        recording_status: session.recording_status ?? "idle",
        recording_consent_given: session.recording_consent_given ?? false,
        recording_url: session.recording_url ?? null,
        recording_started_at: session.recording_started_at ?? null,
        recording_ended_at: session.recording_ended_at ?? null,
        recording_error: session.recording_error ?? null,
      },
      provider_settings: {
        enable_voice_demo: providerSettings.enable_voice_demo,
        enable_human_takeover: providerSettings.enable_human_takeover,
        enable_transcript: providerSettings.enable_transcript,
        connection_status: providerSettings.connection_status,
        provider: providerSettings.provider,
        branding: providerSettings.demo_room_branding,
        enable_recording:
          providerSettings.enable_recording ??
          providerSettings.enable_recording_placeholder ??
          false,
        auto_record_demos: providerSettings.auto_record_demos ?? false,
        record_only_with_consent: providerSettings.record_only_with_consent ?? true,
      },
      livekit_configured: isLiveKitEnvConfigured(),
      video_providers: ["livekit", "daily", "zoom", "agora"],
      integration_roadmap: {
        current: providerSettings.provider === "livekit_future" && isLiveKitEnvConfigured()
          ? "livekit_realtime"
          : "internal_browser_demo",
        next: "livekit",
        planned: [
          "livekit_realtime_room",
          "ai_voice_in_room",
          "human_join_room",
          "screen_sharing",
          "recording",
          "ai_avatar",
        ],
      },
    });
  });
}
