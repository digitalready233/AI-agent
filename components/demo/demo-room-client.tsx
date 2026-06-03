"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LiveAgentBookingPanel } from "@/components/live-chat/live-agent-booking-panel";
import { DemoStageProgress } from "@/components/demo/demo-stage-progress";
import { DemoLeftWorkspacePanel } from "@/components/demo/demo-left-workspace-panel";
import { DemoConversationPanel } from "@/components/demo/demo-conversation-panel";
import { DemoRightWorkspacePanel } from "@/components/demo/demo-right-workspace-panel";
import { DemoRoomTopBar } from "@/components/demo/demo-room-top-bar";
import { DemoBottomControlBar } from "@/components/demo/demo-bottom-control-bar";
import { DemoStaffControlBar } from "@/components/demo/demo-staff-control-bar";
import type { SlideBrandingMap } from "@/lib/demo/slide-branding";
import type { DemoQualificationProgress, DemoSession } from "@/lib/demo/types";
import { apiDemoMessagesToChatLines } from "@/lib/demo/message-lines";
import { isDemoRoomAiEnabled } from "@/lib/demo/config";
import { useDemoVoice, type DemoVoiceTurnResult } from "@/hooks/use-demo-voice";
import { DemoVoicePanel } from "@/components/demo/demo-voice-panel";
import { useDemoTimer } from "@/hooks/use-demo-timer";
import { useDemoLivekitRoom } from "@/hooks/use-demo-livekit-room";
import { useDemoLivekitAi } from "@/hooks/use-demo-livekit-ai";
import { DemoLiveKitStage } from "@/components/demo/demo-livekit-stage";
import { DemoCenterStage } from "@/components/demo/demo-center-stage";
import { DemoAiPresenter } from "@/components/demo/demo-ai-presenter";
import { DemoAvatarPanel } from "@/components/demo/demo-avatar-panel";
import {
  DidAvatarPresenter,
  type DidAvatarPresenterHandle,
} from "@/components/demo/did-avatar-presenter";
import { inferCustomerSentiment } from "@/lib/demo/demo-room-ui";
import { resolveAiPresenterState } from "@/lib/demo/resolve-ai-presenter-state";
import type { AiPresenterOrgSettings } from "@/lib/demo/ai-presenter-types";
import { DEFAULT_AI_PRESENTER_ORG_SETTINGS } from "@/lib/demo/ai-presenter-types";
import {
  DEFAULT_AVATAR_ORG_SETTINGS,
  type AvatarOrgSettings,
} from "@/lib/avatar/types";
import { isExternalAvatarProvider } from "@/lib/avatar/registry";
import { DemoStaffControlPanel } from "@/components/demo/demo-staff-control-panel";
import { useDemoPresentationControl } from "@/hooks/use-demo-presentation-control";
import { DemoRecordingConsentModal } from "@/components/demo/demo-recording-consent-modal";
import { DemoRecordingControls } from "@/components/demo/demo-recording-controls";
import { useDemoRecording } from "@/hooks/use-demo-recording";
import {
  Bot,
  HandHelping,
  Loader2,
  Sparkles,
} from "lucide-react";

type DemoAsset = {
  id: string;
  title: string;
  content: string;
  asset_type: string;
  sort_order: number;
};

type LeadDetail = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  industry?: string | null;
  service_interest?: string | null;
  lead_category?: string | null;
  budget?: string | null;
  timeline?: string | null;
  source?: string | null;
};

type ChatLine = {
  role: "user" | "assistant" | "system" | "staff";
  content: string;
  senderName?: string;
  asset?: DemoAsset | null;
  createdAt?: string;
};

export function DemoRoomClient({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const staffMode =
    searchParams.get("staff") === "1" || searchParams.get("role") === "staff";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [input, setInput] = useState("");
  const [hasLead, setHasLead] = useState(false);
  const [bookingPlaceholder, setBookingPlaceholder] = useState(true);
  const [agent, setAgent] = useState<{
    id: string;
    name: string;
    company_product_name?: string | null;
    avatar_url?: string | null;
    position?: string | null;
    avatar_enabled?: boolean;
    avatar_provider?: string | null;
  } | null>(null);
  const [avatarOrgSettings, setAvatarOrgSettings] = useState<AvatarOrgSettings>(
    DEFAULT_AVATAR_ORG_SETTINGS
  );
  const [presenterSettings, setPresenterSettings] = useState<AiPresenterOrgSettings>(
    DEFAULT_AI_PRESENTER_ORG_SETTINGS
  );
  const [presenterDisplay, setPresenterDisplay] = useState<{
    displayName: string;
    roleTitle: string;
    avatarUrl: string | null;
    initials: string;
  } | null>(null);
  const [session, setSession] = useState<{
    title: string;
    status: string;
    current_demo_stage: string;
    entry_mode?: string;
    demo_path_id?: string | null;
    demo_path_title?: string | null;
    recommended_cta?: string | null;
    slide_branding?: SlideBrandingMap;
    handoff_required: boolean;
    handoff_status?: string;
    handoff_reason?: string | null;
    handoff_reason_label?: string | null;
    ai_paused?: boolean;
    active_staff_name?: string | null;
    booking_recommended: boolean;
    lead_category: string | null;
    conversation_id?: string | null;
    booking_id?: string | null;
    summary?: string | null;
    recommended_next_action?: string | null;
    detected_intent?: string | null;
    lead_score?: number | null;
    started_at?: string | null;
    video_provider?: string;
    livekit_room_status?: string;
    video_enabled?: boolean;
    use_livekit_video?: boolean;
    ai_joined?: boolean;
    ai_status?: string;
    ai_participant_identity?: string | null;
    enable_ai_auto_join?: boolean;
    qualification_progress?: DemoQualificationProgress;
    objections?: string[];
    presentation_control_mode?: string;
    screen_share_active?: boolean;
    current_presenter_type?: string | null;
    current_presenter_id?: string | null;
    presenter_name?: string | null;
    pending_presentation_action?: Record<string, unknown> | null;
    current_demo_asset_id?: string | null;
    ai_presenter_state?: string | null;
    ai_audio_status?: string | null;
    ai_presenter_asset_title?: string | null;
    avatar_session_id?: string | null;
    avatar_provider?: string | null;
    avatar_status?: string | null;
    avatar_stream_url?: string | null;
    avatar_join_url?: string | null;
    avatar_error?: string | null;
    tavus_conversation_id?: string | null;
    tavus_conversation_url?: string | null;
    did_agent_id?: string | null;
    did_stream_id?: string | null;
    did_session_id?: string | null;
    avatar_fallback_provider?: string | null;
    avatar_selection_source?: string | null;
    avatar_routing_rule_name?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null>(null);
  const [didCreds, setDidCreds] = useState<{
    agentId: string;
    clientKey: string;
  } | null>(null);
  const didPresenterRef = useRef<DidAvatarPresenterHandle | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [livekitConfigured, setLivekitConfigured] = useState(false);
  const [recordingConfig, setRecordingConfig] = useState<{
    enable_recording?: boolean;
    auto_record_demos?: boolean;
    record_only_with_consent?: boolean;
    require_recording_consent?: boolean;
    consent_message?: string;
    recording_status?: string;
    recording_consent_given?: boolean;
  } | null>(null);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("connecting");
  const [staffInput, setStaffInput] = useState("");
  const [staffSending, setStaffSending] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<
    { speaker: string; content: string; input_type?: string }[]
  >([]);
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [assets, setAssets] = useState<DemoAsset[]>([]);
  const [assetIndex, setAssetIndex] = useState(0);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showBooking, setShowBooking] = useState(false);
  const [endedSummary, setEndedSummary] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [pendingRetryText, setPendingRetryText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeAsset = assets[assetIndex] ?? null;
  const timer = useDemoTimer(session?.started_at, joined && !endedSummary);

  const useLiveKitVideo =
    livekitConfigured &&
    (session?.use_livekit_video === true ||
      session?.video_provider === "livekit" ||
      session?.video_enabled === true);

  const applyRoomPayload = useCallback(
    (data: {
      session?: typeof session;
      agent?: typeof agent;
      assets?: DemoAsset[];
      messages?: {
        sender_type: string;
        content: string;
        sender_name?: string | null;
        created_at?: string | null;
      }[];
      lead?: LeadDetail | null;
      has_lead?: boolean;
      provider_settings?: {
        enable_voice_demo?: boolean;
        connection_status?: string;
      };
      livekit_configured?: boolean;
      transcripts?: { speaker: string; content: string; input_type?: string }[];
      recording?: typeof recordingConfig;
      presenter_settings?: AiPresenterOrgSettings;
      presenter_display?: {
        displayName: string;
        roleTitle: string;
        avatarUrl: string | null;
        initials: string;
      };
      avatar_settings?: AvatarOrgSettings;
      agent_avatar?: {
        avatar_enabled?: boolean;
        avatar_provider?: string | null;
      };
    }) => {
      if (data.session) setSession(data.session);
      if (data.presenter_settings) {
        setPresenterSettings({
          ...DEFAULT_AI_PRESENTER_ORG_SETTINGS,
          ...data.presenter_settings,
        });
      }
      if (data.presenter_display) setPresenterDisplay(data.presenter_display);
      if (data.avatar_settings) {
        setAvatarOrgSettings({ ...DEFAULT_AVATAR_ORG_SETTINGS, ...data.avatar_settings });
      }
      if (data.recording) setRecordingConfig(data.recording);
      if (data.agent) setAgent(data.agent);
      if (data.assets) {
        setAssets(data.assets);
        const idx = data.session?.current_demo_asset_id
          ? data.assets.findIndex((a) => a.id === data.session!.current_demo_asset_id)
          : 0;
        setAssetIndex(idx >= 0 ? idx : 0);
      }
      if (data.provider_settings) {
        setVoiceEnabled(Boolean(data.provider_settings.enable_voice_demo));
        setConnectionStatus(data.provider_settings.connection_status ?? "ready");
      }
      if (data.livekit_configured !== undefined) {
        setLivekitConfigured(Boolean(data.livekit_configured));
      }
      if (data.transcripts?.length) {
        setTranscriptLines(
          data.transcripts.map((t) => ({
            speaker: t.speaker,
            content: t.content,
            input_type: t.input_type ?? "text",
          }))
        );
      }
      if (data.lead) {
        setLeadDetail(data.lead);
        if (data.lead.full_name) setName(data.lead.full_name);
        if (data.lead.email) setEmail(data.lead.email);
        if (data.lead.phone) setPhone(data.lead.phone);
      }
      if (data.has_lead !== undefined) setHasLead(Boolean(data.has_lead));
      if (data.messages?.length) {
        setLines(apiDemoMessagesToChatLines(data.messages));
      }
    },
    []
  );

  const refreshRoomQuietly = useCallback(async () => {
    try {
      const res = await fetch(`/api/demo-room/${sessionId}`);
      const data = await res.json();
      if (!res.ok) return;
      applyRoomPayload(data);
      if (data.session?.booking_recommended && !data.booking_placeholder) {
        setShowBooking(true);
      }
    } catch {
      /* ignore poll errors */
    }
  }, [sessionId, applyRoomPayload]);

  const aiPaused =
    session?.ai_paused === true || session?.status === "human_taken_over";
  const activeStaffName = session?.active_staff_name?.trim() || null;
  const handoffBannerText = aiPaused
    ? activeStaffName
      ? `${activeStaffName} is now assisting you directly.`
      : "A human team member is now assisting you."
    : session?.handoff_status === "joined" && activeStaffName
      ? `${activeStaffName} has joined the demo.`
      : session?.handoff_required
        ? "A team member has been notified and may join this demo to assist you."
        : null;

  const applyVoiceTurn = useCallback(
    (data: DemoVoiceTurnResult) => {
      const userText = data.transcript?.trim() ?? "";
      if (userText) {
        setTranscriptLines((prev) => [
          ...prev,
          { speaker: "Prospect", content: userText, input_type: "voice" },
          {
            speaker: "AI",
            content: data.ai_voice_text ?? data.reply,
            input_type: "voice",
          },
        ]);
        setLines((prev) => [
          ...prev,
          { role: "user", content: userText },
          {
            role: "assistant",
            content: data.reply,
            asset: data.next_asset
              ? {
                  id: data.next_asset.id,
                  title: data.next_asset.title,
                  content: data.next_asset.content,
                  asset_type: data.next_asset.asset_type,
                  sort_order: 0,
                }
              : null,
          },
        ]);
      } else {
        setTranscriptLines((prev) => [
          ...prev,
          {
            speaker: "AI",
            content: data.ai_voice_text ?? data.reply,
            input_type: "voice",
          },
        ]);
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
            asset: data.next_asset
              ? {
                  id: data.next_asset.id,
                  title: data.next_asset.title,
                  content: data.next_asset.content,
                  asset_type: data.next_asset.asset_type,
                  sort_order: 0,
                }
              : null,
          },
        ]);
      }
      setSession((s) =>
        s
          ? {
              ...s,
              current_demo_stage: data.demo_stage ?? s.current_demo_stage,
              demo_path_id: data.selected_demo_path_id ?? s.demo_path_id,
              demo_path_title: data.selected_demo_path_title ?? s.demo_path_title,
              handoff_required: data.handoff_required ?? s.handoff_required,
              booking_recommended: data.booking_recommended ?? s.booking_recommended,
              lead_category: data.lead_category ?? s.lead_category,
              lead_score:
                typeof data.lead_score === "number"
                  ? data.lead_score
                  : typeof data.lead_score === "object" && data.lead_score?.total != null
                    ? data.lead_score.total
                    : s.lead_score,
              recommended_next_action:
                data.recommended_next_action ?? s.recommended_next_action,
              qualification_progress:
                (data.qualification_progress as DemoQualificationProgress) ??
                s.qualification_progress,
              objections: data.objections ?? s.objections,
            }
          : s
      );
      if (data.selected_demo_path_title || data.selected_demo_path_id) {
        void refreshRoomQuietly();
      }
      if (data.next_asset) {
        const idx = assets.findIndex((a) => a.id === data.next_asset!.id);
        if (idx >= 0) setAssetIndex(idx);
      }
      if (data.booking_recommended && !bookingPlaceholder) setShowBooking(true);
      if (data.handoff_required) {
        toast.info("A team member will join you shortly.");
      }
      if (data.lead_category) {
        setLeadDetail((ld) => ({ ...ld, lead_category: data.lead_category ?? undefined }));
      }
      const updates = data.structured?.leadUpdates as
        | {
            service_interest?: string;
            budget?: string;
            timeline?: string;
            business_name?: string;
          }
        | undefined;
      if (updates) {
        setLeadDetail((ld) => ({
          ...ld,
          service_interest: updates.service_interest ?? ld?.service_interest,
          budget: updates.budget ?? ld?.budget,
          timeline: updates.timeline ?? ld?.timeline,
        }));
      }
      if (
        data.booking_recommended &&
        /book|consultation/i.test(data.ai_voice_text ?? data.reply)
      ) {
        setShowBooking(true);
      }
    },
    [assets, bookingPlaceholder, refreshRoomQuietly]
  );

  const syncAssetFromId = useCallback(
    (assetId: string | null | undefined, indexOverride?: number) => {
      if (typeof indexOverride === "number" && indexOverride >= 0) {
        setAssetIndex(indexOverride);
        return;
      }
      if (!assetId) return;
      const idx = assets.findIndex((a) => a.id === assetId);
      if (idx >= 0) setAssetIndex(idx);
      else void refreshRoomQuietly();
    },
    [assets, refreshRoomQuietly]
  );

  const presentationCtrl = useDemoPresentationControl(sessionId);

  const livekit = useDemoLivekitRoom({
    sessionId,
    enabled: joined && !endedSummary && useLiveKitVideo,
    displayName: name.trim() || (staffMode ? "Team member" : "Guest"),
    role: staffMode ? "staff" : "prospect",
    autoConnect: false,
    onAiRoomSync: (sync) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              ai_paused: sync.ai_paused,
              demo_path_id: sync.selectedDemoPathId ?? prev.demo_path_id,
              booking_recommended: sync.bookingRecommended ?? prev.booking_recommended,
              handoff_required: sync.handoffRequired ?? prev.handoff_required,
              lead_category: sync.leadCategory ?? prev.lead_category,
              lead_score: sync.leadScore ?? prev.lead_score,
              current_demo_stage: sync.demoStage ?? prev.current_demo_stage,
              presentation_control_mode:
                sync.presentationControlMode ?? prev.presentation_control_mode,
              screen_share_active: sync.screenShareActive ?? prev.screen_share_active,
              current_presenter_type:
                sync.currentPresenterType ?? prev.current_presenter_type,
              pending_presentation_action:
                sync.pendingPresentationAction ?? prev.pending_presentation_action,
            }
          : prev
      );
      if (sync.currentDemoAssetId) {
        syncAssetFromId(sync.currentDemoAssetId, sync.currentAssetIndex ?? undefined);
      }
      if (sync.bookingRecommended) setShowBooking(true);
    },
    onScreenShareChange: staffMode
      ? (active) => {
          if (active) {
            void presentationCtrl.startScreenShare().then(() => refreshRoomQuietly());
          } else {
            void presentationCtrl.stopScreenShare().then(() => refreshRoomQuietly());
          }
        }
      : undefined,
  });

  const displayConnectionStatus =
    livekit.status === "connected" ||
    livekit.status === "connecting" ||
    livekit.status === "reconnecting"
      ? livekit.connectionLabel
      : livekit.status === "error"
        ? "realtime error"
        : connectionStatus;

  const demoRecording = useDemoRecording({
    sessionId,
    enabled: joined && !endedSummary && useLiveKitVideo,
    staffMode,
    recordingConfig,
    onConsentRequired: () => setConsentModalOpen(true),
  });

  useEffect(() => {
    if (
      joined &&
      !staffMode &&
      recordingConfig?.enable_recording &&
      (recordingConfig.require_recording_consent ??
        recordingConfig.record_only_with_consent) &&
      !recordingConfig.recording_consent_given
    ) {
      setConsentModalOpen(true);
    }
  }, [joined, staffMode, recordingConfig]);

  const livekitAi = useDemoLivekitAi({
    sessionId,
    enabled:
      joined && !endedSummary && useLiveKitVideo && !staffMode && isDemoRoomAiEnabled(),
    autoStart: false,
    onWelcomeTurn: applyVoiceTurn,
    onTurnComplete: applyVoiceTurn,
    onStatus: (s) => {
      if (s.ai_paused !== undefined) {
        setSession((prev) => (prev ? { ...prev, ai_paused: s.ai_paused } : prev));
      }
      setSession((prev) =>
        prev
          ? {
              ...prev,
              ai_joined: s.ai_joined,
              ai_status: s.ai_status,
              ai_paused: s.ai_paused ?? prev.ai_paused,
              demo_path_id: s.demo_path_id ?? prev.demo_path_id,
              demo_path_title: s.demo_path_title ?? prev.demo_path_title,
              current_demo_stage: s.current_demo_stage ?? prev.current_demo_stage,
              booking_recommended: s.booking_recommended ?? prev.booking_recommended,
              handoff_required: s.handoff_required ?? prev.handoff_required,
              lead_category: s.lead_category ?? prev.lead_category,
              lead_score: s.lead_score ?? prev.lead_score,
              recommended_next_action:
                s.recommended_next_action ?? prev.recommended_next_action,
              qualification_progress:
                (s.qualification_progress as DemoQualificationProgress) ??
                prev.qualification_progress,
              objections: s.objections ?? prev.objections,
            }
          : prev
      );
      if (s.current_demo_asset_id) syncAssetFromId(s.current_demo_asset_id);
      if (s.booking_recommended && !bookingPlaceholder) setShowBooking(true);
    },
  });

  useEffect(() => {
    if (
      !useLiveKitVideo ||
      staffMode ||
      !joined ||
      endedSummary ||
      livekit.status !== "connected"
    ) {
      return;
    }
    if (
      session?.enable_ai_auto_join !== false &&
      !livekitAi.aiJoined &&
      livekitAi.aiStatus === "not_started" &&
      !livekitAi.starting
    ) {
      void livekitAi.startAi();
    }
  }, [
    useLiveKitVideo,
    staffMode,
    joined,
    endedSummary,
    livekit.status,
    session?.enable_ai_auto_join,
    livekitAi.aiJoined,
    livekitAi.aiStatus,
    livekitAi.starting,
    livekitAi.startAi,
  ]);

  const voice = useDemoVoice({
    sessionId,
    enabled: voiceEnabled,
    displayName: name,
    email,
    phone,
    currentAssetId: activeAsset?.id ?? null,
    aiPaused: aiPaused || livekitAi.aiPaused,
    onTurnComplete: applyVoiceTurn,
  });

  const loadRoom = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/demo-room/${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load demo room");
      applyRoomPayload(data);
      setHasLead(Boolean(data.has_lead));
      setBookingPlaceholder(Boolean(data.booking_placeholder));
      if (!data.provider_settings) setConnectionStatus("ready");
      if (data.session?.conversation_id) {
        setConversationId(data.session.conversation_id);
      }

      const apiMessages = data.messages as
        | { sender_type: string; content: string; sender_name?: string | null }[]
        | undefined;

      if (data.session?.status === "completed") {
        setJoined(true);
        if (data.session.summary) setEndedSummary(data.session.summary);
      } else if (data.resumable && apiMessages?.length) {
        setJoined(true);
        if (data.session?.booking_recommended && !data.booking_placeholder) {
          setShowBooking(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [sessionId, applyRoomPayload]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!joined || endedSummary) return;
    const poll =
      session?.status === "human_taken_over" ||
      session?.handoff_required ||
      session?.booking_recommended ||
      livekitAi.aiJoined ||
      staffMode;
    if (!poll) return;
    const id = window.setInterval(() => void refreshRoomQuietly(), 5000);
    return () => window.clearInterval(id);
  }, [
    joined,
    endedSummary,
    staffMode,
    session?.status,
    session?.handoff_required,
    session?.booking_recommended,
    livekitAi.aiJoined,
    refreshRoomQuietly,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  async function captureLeadIfNeeded() {
    if (hasLead || !name.trim()) return;
    const res = await fetch(`/api/demo-room/${sessionId}/capture-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok && data.lead) {
      setHasLead(true);
      setLeadDetail(data.lead);
    }
  }

  async function handleJoin() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/demo-room/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          display_name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join");
      if (!hasLead) await captureLeadIfNeeded();
      setJoined(true);
      if (data.conversation_id) setConversationId(data.conversation_id);
      const joinedMessages = data.messages as
        | { sender_type: string; content: string; sender_name?: string | null }[]
        | undefined;
      if (joinedMessages?.length) {
        setLines(apiDemoMessagesToChatLines(joinedMessages));
      } else if (data.welcome_message) {
        setLines([{ role: "assistant", content: data.welcome_message }]);
      }
      await refreshRoomQuietly();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    } finally {
      setJoining(false);
    }
  }

  async function sendStaffMessage() {
    const text = staffInput.trim();
    if (!text || !joined) return;
    setStaffSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/demo/sessions/${sessionId}/staff-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          staff_display_name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            "Sign in to the dashboard in this browser, then open Join demo again."
          );
        }
        throw new Error(data.error ?? "Could not send staff message");
      }
      setStaffInput("");
      const label = (data.sender_name as string) ?? name.trim() ?? "Team member";
      setLines((prev) => [
        ...prev,
        { role: "staff", content: text, senderName: label },
      ]);
      setTranscriptLines((prev) => [
        ...prev,
        { speaker: label, content: text, input_type: "text" },
      ]);
      toast.success("Message sent to prospect");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setStaffSending(false);
    }
  }

  async function sendMessage(retryText?: string) {
    const text = (retryText ?? input).trim();
    if (!text || !joined || staffMode) return;
    if (!retryText) setInput("");
    setLines((prev) => {
      if (retryText) {
        const last = prev[prev.length - 1];
        if (last?.role === "user" && last.content === text) return prev;
      }
      return [...prev, { role: "user", content: text }];
    });
    setSending(true);
    setSendError(null);
    setRetryable(false);
    setPendingRetryText(text);
    setError(null);
    try {
      const useLiveKitAiChannel =
        useLiveKitVideo &&
        livekitAi.aiJoined &&
        !livekitAi.aiPaused &&
        livekitAi.aiStatus === "active";

      if (useLiveKitAiChannel) {
        const data = await livekitAi.sendMessage(text);
        if (!data?.ok) {
          setSendError(
            (data as { error?: string })?.error ?? "AI could not respond"
          );
          setRetryable(true);
          return;
        }
        setPendingRetryText(null);
        if (data.handoff_required) {
          toast.info("A team member will join you shortly.");
        }
        return;
      }

      const res = await fetch(`/api/demo-room/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          display_name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          current_demo_asset_id: activeAsset?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fallback_reply) {
          setLines((prev) => [
            ...prev,
            { role: "assistant", content: data.fallback_reply as string },
          ]);
        }
        setSendError(data.error ?? "Send failed");
        setRetryable(Boolean(data.retryable));
        return;
      }
      setPendingRetryText(null);
      setSession((s) =>
        s
          ? {
              ...s,
              current_demo_stage:
                data.demo_stage ?? data.current_demo_stage ?? s.current_demo_stage,
              demo_path_id: data.selected_demo_path_id ?? s.demo_path_id,
              demo_path_title:
                data.selected_demo_path_title ?? s.demo_path_title,
              handoff_required: data.handoff_required ?? s.handoff_required,
              booking_recommended: data.booking_recommended ?? s.booking_recommended,
              lead_category: data.lead_category ?? s.lead_category,
              lead_score:
                typeof data.lead_score === "number" ? data.lead_score : s.lead_score,
              recommended_next_action:
                data.recommended_next_action ?? s.recommended_next_action,
              qualification_progress:
                data.qualification_progress ?? s.qualification_progress,
              objections: data.objections ?? s.objections,
            }
          : s
      );
      if (data.selected_demo_path_title || data.selected_demo_path_id) {
        void refreshRoomQuietly();
      }
      if (data.booking_recommended && !bookingPlaceholder) setShowBooking(true);
      if (data.next_asset) {
        const idx = assets.findIndex((a) => a.id === data.next_asset.id);
        if (idx >= 0) setAssetIndex(idx);
      }
      if (data.lead_category_label || data.lead_category) {
        setLeadDetail((ld) => ({
          ...ld,
          lead_category: data.lead_category_label ?? data.lead_category,
        }));
      }
      const updates = data.structured?.leadUpdates as
        | {
            service_interest?: string;
            budget?: string;
            timeline?: string;
            business_name?: string;
            full_name?: string;
          }
        | undefined;
      if (updates) {
        setLeadDetail((ld) => ({
          ...ld,
          service_interest: updates.service_interest ?? ld?.service_interest,
          budget: updates.budget ?? ld?.budget,
          timeline: updates.timeline ?? ld?.timeline,
          full_name: updates.full_name ?? ld?.full_name,
        }));
      }
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          asset: data.next_asset ?? null,
        },
      ]);
      if (data.handoff_required) {
        toast.info("A team member will join you shortly.");
      } else if (
        data.lead_category === "hot" ||
        data.lead_category_label === "Hot Lead"
      ) {
        toast.success("You're a priority lead — our team has been notified.");
        if (data.booking_recommended && !bookingPlaceholder) setShowBooking(true);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Send failed");
      setRetryable(true);
    } finally {
      setSending(false);
    }
  }

  function retryLastMessage() {
    if (pendingRetryText) {
      setLines((prev) => {
        const copy = [...prev];
        if (copy[copy.length - 1]?.role === "user") copy.pop();
        return copy;
      });
      void sendMessage(pendingRetryText);
    }
  }

  async function requestHandoff() {
    setHandoffLoading(true);
    try {
      const res = await fetch(`/api/demo/sessions/${sessionId}/human-takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setSession((s) =>
        s ? { ...s, handoff_required: true, status: "human_taken_over" } : s
      );
      toast.success("A team member will join you shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request handoff");
    } finally {
      setHandoffLoading(false);
    }
  }

  async function endDemo() {
    setEnding(true);
    try {
      if (livekit.status === "connected" || livekit.status === "reconnecting") {
        await livekit.disconnect();
      }
      if (livekitAi.aiJoined) {
        await livekitAi.stopAi();
      }
      const res = await fetch(`/api/demo/sessions/${sessionId}/end`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not end demo");
      setEndedSummary(data.summary ?? "Thank you for joining the demo.");
      setSession((s) => (s ? { ...s, status: "completed", ai_status: "stopped" } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "End failed");
    } finally {
      setEnding(false);
    }
  }

  function openBooking() {
    if (bookingPlaceholder) {
      toast.info("Booking is unavailable in placeholder mode.");
      return;
    }
    if (!session?.booking_recommended) {
      toast.info("Complete discovery first — booking opens when you are qualified.");
      return;
    }
    setShowBooking(true);
  }

  const showBookingCta =
    joined &&
    !endedSummary &&
    !bookingPlaceholder &&
    Boolean(session?.booking_recommended) &&
    !session?.booking_id;

  const aiPresenterState = useMemo(() => {
    if (!session) return "idle" as const;
    return resolveAiPresenterState({
      session: session as unknown as DemoSession,
      livekitPhase: livekitAi.phase,
      aiAudioStatus: session.ai_audio_status ?? undefined,
      aiStatus: session.ai_status ?? livekitAi.aiStatus,
      aiJoined: session.ai_joined ?? livekitAi.aiJoined,
      aiPaused: aiPaused || livekitAi.aiPaused,
      handoffRequired: session.handoff_required,
      bookingRecommended: session.booking_recommended,
      presentingAssetId: activeAsset?.id ?? session.current_demo_asset_id,
      livekitDisconnected:
        useLiveKitVideo &&
        (livekit.status === "error" || livekit.status === "disconnected"),
      aiAudioFailed: session.ai_audio_status === "failed",
    });
  }, [
    session,
    livekitAi.phase,
    livekitAi.aiPaused,
    livekitAi.aiJoined,
    livekitAi.aiStatus,
    aiPaused,
    activeAsset?.id,
    livekit.status,
    useLiveKitVideo,
  ]);

  const screenShareActive =
    session?.screen_share_active ||
    livekit.screenSharing ||
    Boolean(livekit.remoteScreenShareIdentity);

  const useExternalAvatar =
    avatarOrgSettings.enable_ai_avatar &&
    Boolean(agent?.avatar_enabled) &&
    isExternalAvatarProvider(agent?.avatar_provider ?? session?.avatar_provider) &&
    session?.avatar_status !== "fallback_active" &&
    session?.avatar_status !== "failed" &&
    !aiPaused;

  const showExternalAvatar =
    useExternalAvatar &&
    ["active", "speaking", "listening", "starting", "paused"].includes(
      session?.avatar_status ?? ""
    ) &&
    !endedSummary;

  const showInternalPresenter =
    presenterSettings.enable_ai_presenter &&
    Boolean(presenterDisplay) &&
    !endedSummary &&
    (!showExternalAvatar ||
      session?.avatar_status === "fallback_active" ||
      session?.avatar_status === "failed");

  const activeAvatarProvider =
    session?.avatar_provider ?? agent?.avatar_provider ?? null;
  const isDidAvatar =
    activeAvatarProvider === "did" && Boolean(didCreds?.clientKey && didCreds?.agentId);

  const externalAvatarNode =
    showExternalAvatar && presenterDisplay ? (
      isDidAvatar ? (
        <DidAvatarPresenter
          ref={didPresenterRef}
          agentId={didCreds!.agentId}
          clientKey={didCreds!.clientKey}
          demoSessionId={sessionId}
          displayName={presenterDisplay.displayName}
          status={session?.avatar_status}
          compact={screenShareActive || presenterSettings.compact_mode}
          staffView={staffMode}
          onConnected={() => {
            setSession((prev) =>
              prev ? { ...prev, avatar_status: "active", avatar_error: null } : prev
            );
          }}
          onFallback={() => {
            void fetch("/api/avatar/session/fallback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                demo_session_id: sessionId,
                reason: "D-ID SDK or stream failed",
              }),
            }).then(() => refreshRoomQuietly());
          }}
        />
      ) : (
        <DemoAvatarPanel
          provider={activeAvatarProvider}
          status={session?.avatar_status}
          streamUrl={session?.avatar_stream_url}
          joinUrl={session?.avatar_join_url}
          conversationUrl={session?.tavus_conversation_url}
          error={session?.avatar_error}
          displayName={presenterDisplay.displayName}
          compact={screenShareActive || presenterSettings.compact_mode}
          staffView={staffMode}
        />
      )
    ) : null;

  const aiPresenterNode =
    showInternalPresenter && presenterDisplay ? (
      <DemoAiPresenter
        displayName={presenterDisplay.displayName}
        roleTitle={presenterDisplay.roleTitle}
        avatarUrl={presenterDisplay.avatarUrl}
        fallbackInitials={presenterDisplay.initials}
        brandColor={presenterSettings.brand_color}
        state={aiPresenterState}
        demoStage={session?.current_demo_stage}
        demoPathTitle={session?.demo_path_title}
        currentAssetTitle={activeAsset?.title ?? session?.ai_presenter_asset_title}
        bookingRecommended={
          presenterSettings.show_booking_badge && session?.booking_recommended
        }
        handoffRequired={
          presenterSettings.show_handoff_badge && session?.handoff_required
        }
        showWaveform={presenterSettings.show_waveform}
        showDemoStage={presenterSettings.show_demo_stage}
        showDemoPath={presenterSettings.show_demo_path}
        showBookingBadge={presenterSettings.show_booking_badge}
        showHandoffBadge={presenterSettings.show_handoff_badge}
        compact={screenShareActive || presenterSettings.compact_mode}
        staffView={staffMode}
        leadScore={staffMode ? session?.lead_score : undefined}
        leadCategory={staffMode ? session?.lead_category : undefined}
      />
    ) : null;

  const presenterNode = showExternalAvatar ? externalAvatarNode : aiPresenterNode;

  const presenterNote = useMemo(() => {
    if (session?.recommended_next_action?.trim()) {
      return session.recommended_next_action;
    }
    const lastAi = [...lines].reverse().find((l) => l.role === "assistant");
    if (lastAi?.content && lastAi.content.length <= 320) {
      return lastAi.content;
    }
    return null;
  }, [session?.recommended_next_action, lines]);

  const detectedIntentLabel = session?.detected_intent
    ? session.detected_intent.replace(/_/g, " ")
    : null;

  const customerSentimentLabel = useMemo(
    () => inferCustomerSentiment(session?.lead_score, session?.lead_category),
    [session?.lead_score, session?.lead_category]
  );

  const staffControlBusy = presentationCtrl.busy || ending || handoffLoading;

  async function staffTakeOver() {
    try {
      await presentationCtrl.takeOver();
      toast.success("You are now presenting");
      void refreshRoomQuietly();
    } catch {
      /* hook sets error */
    }
  }

  async function staffPauseAi() {
    try {
      await presentationCtrl.pauseAi();
      toast.success("AI paused");
      void refreshRoomQuietly();
    } catch {
      /* */
    }
  }

  async function staffResumeAi() {
    try {
      await presentationCtrl.resumeAi();
      toast.success("AI resumed");
      void refreshRoomQuietly();
    } catch {
      /* */
    }
  }

  async function staffShowBookingCta() {
    try {
      await presentationCtrl.showBookingCta();
      setShowBooking(true);
      toast.success("Booking CTA shown");
      void refreshRoomQuietly();
    } catch {
      /* */
    }
  }

  async function staffMarkQualified() {
    const res = await fetch(`/api/platform/demo/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mark_qualified: true }),
    });
    if (res.ok) {
      toast.success("Marked as qualified");
      void refreshRoomQuietly();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Could not update");
    }
  }

  async function staffMarkOpportunity() {
    const res = await fetch(`/api/platform/demo/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mark_opportunity: true }),
    });
    if (res.ok) {
      toast.success("Opportunity created");
      void refreshRoomQuietly();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Could not update");
    }
  }

  async function staffCreateFollowUp() {
    const notes = window.prompt("Follow-up notes for this demo");
    if (!notes?.trim()) return;
    const res = await fetch(`/api/platform/demo/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ agent_follow_up_notes: notes.trim() }),
    });
    if (res.ok) {
      toast.success("Follow-up saved");
      void refreshRoomQuietly();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Could not save follow-up");
    }
  }

  const avatarControlNode =
    staffMode && agent?.avatar_enabled && avatarOrgSettings.enable_ai_avatar ? (
      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-400 font-normal">Avatar control</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="capitalize">
            {session?.avatar_provider?.replace(/_/g, " ") ?? "—"} ·{" "}
            {session?.avatar_status?.replace(/_/g, " ") ?? "not started"}
          </Badge>
          {session?.avatar_error && (
            <p className="text-amber-200/90 w-full">{session.avatar_error}</p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={avatarBusy}
            onClick={() => void avatarAction("start")}
          >
            Start avatar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={avatarBusy}
            onClick={() => void avatarAction("restart")}
          >
            Restart
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={avatarBusy}
            onClick={() => void avatarAction("stop")}
          >
            Stop
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={avatarBusy}
            onClick={() => void avatarAction("fallback")}
          >
            Force fallback
          </Button>
        </CardContent>
      </Card>
    ) : null;

  const fallbackAgentNode =
    agent && !showInternalPresenter && !showExternalAvatar ? (
      <Card className="border-slate-800/80 bg-slate-900/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20">
              <Bot className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <p className="font-semibold text-white">{agent.name}</p>
              <p className="text-xs text-slate-500">AI Sales Demo Agent</p>
            </div>
          </div>
        </CardContent>
      </Card>
    ) : null;

  useEffect(() => {
    if (
      !joined ||
      endedSummary ||
      aiPaused ||
      staffMode ||
      !agent?.avatar_enabled ||
      !avatarOrgSettings.enable_ai_avatar ||
      !isExternalAvatarProvider(agent.avatar_provider)
    ) {
      return;
    }
    if (
      session?.avatar_status &&
      !["not_started", "failed", "fallback_active"].includes(session.avatar_status)
    ) {
      return;
    }
    void (async () => {
      try {
        const provider =
          agent.avatar_provider === "tavus"
            ? "tavus"
            : agent.avatar_provider === "did"
              ? "did"
              : "auto";
        const res = await fetch(`/api/demo-room/${sessionId}/avatar/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data.did_client_key && data.did_agent_id) {
            setDidCreds({
              agentId: data.did_agent_id as string,
              clientKey: data.did_client_key as string,
            });
          }
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  avatar_status: data.avatar_status,
                  avatar_provider: data.avatar_provider,
                  avatar_stream_url: data.avatar_stream_url,
                  avatar_join_url: data.avatar_join_url,
                  avatar_error: data.avatar_error,
                  avatar_session_id: data.avatar_session_id,
                  tavus_conversation_id: data.tavus_conversation_id,
                  tavus_conversation_url: data.tavus_conversation_url,
                  did_agent_id: data.did_agent_id ?? prev.did_agent_id,
                  did_stream_id: data.did_stream_id ?? prev.did_stream_id,
                  did_session_id: data.did_session_id ?? prev.did_session_id,
                }
              : prev
          );
        }
      } catch {
        /* fallback handled server-side */
      }
    })();
  }, [
    joined,
    endedSummary,
    aiPaused,
    staffMode,
    agent?.avatar_enabled,
    agent?.avatar_provider,
    avatarOrgSettings.enable_ai_avatar,
    session?.avatar_status,
    sessionId,
  ]);

  useEffect(() => {
    if (
      !joined ||
      endedSummary ||
      aiPaused ||
      session?.avatar_provider !== "did" ||
      didCreds?.clientKey
    ) {
      return;
    }
    if (
      !session?.avatar_status ||
      ["not_started", "failed", "fallback_active", "stopped"].includes(
        session.avatar_status
      )
    ) {
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/demo-room/${sessionId}/avatar/did-credentials`
        );
        const data = await res.json();
        if (res.ok && data.client_key && data.agent_id) {
          setDidCreds({
            agentId: data.agent_id as string,
            clientKey: data.client_key as string,
          });
        }
      } catch {
        /* start flow may supply creds */
      }
    })();
  }, [
    joined,
    endedSummary,
    aiPaused,
    session?.avatar_provider,
    session?.avatar_status,
    didCreds?.clientKey,
    sessionId,
  ]);

  const lastPendingSpeechRef = useRef<string | null>(null);
  useEffect(() => {
    const pending =
      typeof session?.metadata?.did_pending_speech === "string"
        ? session.metadata.did_pending_speech
        : null;
    if (
      !pending ||
      pending === lastPendingSpeechRef.current ||
      session?.avatar_provider !== "did" ||
      aiPaused
    ) {
      return;
    }
    lastPendingSpeechRef.current = pending;
    void didPresenterRef.current?.speak(pending);
  }, [session?.metadata, session?.avatar_provider, aiPaused]);

  function resolveAvatarStartProvider(): "tavus" | "did" | "internal_card" | "auto" {
    const p = session?.avatar_provider ?? agent?.avatar_provider;
    if (p === "tavus") return "tavus";
    if (p === "did") return "did";
    if (p === "internal_card") return "internal_card";
    return "auto";
  }

  async function switchAvatarProvider(target: "tavus" | "did" | "internal_card") {
    setAvatarBusy(true);
    try {
      const res = await fetch(`/api/demo-room/${sessionId}/avatar/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Switch failed");
      setDidCreds(null);
      await refreshRoomQuietly();
      toast.success(`Switched to ${target.replace(/_/g, " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Switch failed");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function avatarAction(action: "start" | "stop" | "restart" | "fallback") {
    setAvatarBusy(true);
    try {
      const path =
        action === "start" || action === "restart"
          ? `/api/demo-room/${sessionId}/avatar/start`
          : action === "stop"
            ? `/api/demo-room/${sessionId}/avatar/stop`
            : "/api/avatar/session/fallback";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: action === "fallback" ? "include" : undefined,
        body: JSON.stringify(
          action === "fallback"
            ? { demo_session_id: sessionId, reason: "Staff forced fallback" }
            : {
                provider: resolveAvatarStartProvider(),
                restart: action === "restart",
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Avatar action failed");
      if (data.did_client_key && data.did_agent_id) {
        setDidCreds({
          agentId: data.did_agent_id as string,
          clientKey: data.did_client_key as string,
        });
      }
      if (action === "stop" || action === "fallback") {
        setDidCreds(null);
        void didPresenterRef.current?.disconnect();
      }
      await refreshRoomQuietly();
      const providerLabel =
        agent?.avatar_provider === "did"
          ? "D-ID"
          : agent?.avatar_provider === "tavus"
            ? "Tavus"
            : "Avatar";
      toast.success(
        action === "fallback"
          ? "Switched to internal presenter"
          : action === "restart"
            ? `${providerLabel} avatar restarted`
            : action === "start"
              ? `${providerLabel} avatar started`
              : "Avatar stopped"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Avatar action failed");
    } finally {
      setAvatarBusy(false);
    }
  }

  const leftPanel = (
    <DemoLeftWorkspacePanel
      presenterNode={presenterNode}
      staffPresenterActive={session?.current_presenter_type === "staff"}
      staffPresenterName={
        session?.presenter_name ?? session?.active_staff_name ?? "Team member"
      }
      joined={joined}
      objections={session?.objections}
      qualificationProgress={session?.qualification_progress}
      leadScore={session?.lead_score}
      leadCategory={leadDetail?.lead_category ?? session?.lead_category}
      recommendedNextAction={session?.recommended_next_action}
      lead={
        leadDetail
          ? {
              ...leadDetail,
              source: leadDetail.source ?? (hasLead ? "demo_room" : null),
            }
          : null
      }
      hasLead={hasLead}
      name={name}
      email={email}
      phone={phone}
      onNameChange={setName}
      onEmailChange={setEmail}
      onPhoneChange={setPhone}
      onSaveLead={() => void captureLeadIfNeeded()}
      handoffBannerText={handoffBannerText}
      hotLeadHint={
        leadDetail?.lead_category === "Hot Lead" ||
        session?.lead_category === "hot" ||
        session?.lead_category === "Hot Lead"
      }
      avatarControl={avatarControlNode}
      fallbackAgentCard={fallbackAgentNode}
    />
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <DemoRoomTopBar
        title={session?.title}
        productName={agent?.company_product_name}
        joined={joined}
        status={session?.status}
        currentStage={session?.current_demo_stage}
        timerLabel={timer.label}
        connectionLabel={displayConnectionStatus}
        connectionOk={
          livekit.status === "connected" || displayConnectionStatus === "ready"
        }
        staffMode={staffMode}
        handoffActive={
          Boolean(session?.handoff_required || session?.status === "human_taken_over")
        }
        demoPathTitle={session?.demo_path_title}
        leadScore={session?.lead_score}
      />
      {handoffBannerText && joined && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
          <HandHelping className="h-4 w-4 inline mr-2 align-text-bottom" />
          {handoffBannerText}
        </div>
      )}

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {!joined ? (
          <div className="max-w-xl mx-auto">
            <Card className="border-slate-800/80 bg-slate-900/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  {staffMode ? "Join as team member" : "Join your personalized demo"}
                </CardTitle>
                <p className="text-sm text-slate-400">
                  {staffMode
                    ? "You can chat with the prospect directly — the AI will not reply to your messages."
                    : `Browser-based demo with ${agent?.name ?? "our AI specialist"}. No video download required.`}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Your name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-slate-950/80 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-950/80 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Phone (optional)</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-slate-950/80 border-slate-700"
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
                  size="lg"
                  onClick={() => void handleJoin()}
                  disabled={joining}
                >
                  {joining ? "Joining…" : "Join demo"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr_minmax(280px,340px)]">
            <div className="hidden lg:block order-1">{leftPanel}</div>

            <div className="order-2 lg:order-2 space-y-4 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-0.5">
                Guided demo presentation
              </p>
              <DemoStageProgress currentStage={session?.current_demo_stage} />
              {staffMode && (
                <DemoStaffControlBar
                  aiPaused={aiPaused}
                  busy={staffControlBusy}
                  controlMode={session?.presentation_control_mode}
                  onTakeOver={() => void staffTakeOver()}
                  onPauseAi={() => void staffPauseAi()}
                  onResumeAi={() => void staffResumeAi()}
                  onShowBookingCta={() => void staffShowBookingCta()}
                  onMarkQualified={() => void staffMarkQualified()}
                  onMarkOpportunity={() => void staffMarkOpportunity()}
                  onCreateFollowUp={() => void staffCreateFollowUp()}
                  onEndDemo={() => void endDemo()}
                />
              )}
              {useLiveKitVideo && (
                <>
                <DemoRecordingConsentModal
                  open={
                    consentModalOpen &&
                    !staffMode &&
                    Boolean(recordingConfig?.enable_recording) &&
                    Boolean(
                      recordingConfig?.require_recording_consent ??
                        recordingConfig?.record_only_with_consent
                    ) &&
                    !recordingConfig?.recording_consent_given
                  }
                  message={demoRecording.consentMessage}
                  busy={demoRecording.busy}
                  onDecline={async () => {
                    await demoRecording.submitConsent(false);
                    setConsentModalOpen(false);
                  }}
                  onAccept={async () => {
                    const ok = await demoRecording.submitConsent(true);
                    setConsentModalOpen(false);
                    if (ok) {
                      setRecordingConfig((c) =>
                        c ? { ...c, recording_consent_given: true } : c
                      );
                    }
                  }}
                />
                <DemoLiveKitStage
                  livekit={livekit}
                  agentName={agent?.name ?? "AI Agent"}
                  demoStage={session?.current_demo_stage}
                  demoPathTitle={session?.demo_path_title}
                  staffName={session?.active_staff_name}
                  staffMode={staffMode}
                  aiPhaseLabel={livekitAi.phaseLabel}
                  aiAudioModeLabel={livekitAi.aiAudioModeLabel}
                  aiSpeaking={
                    aiPresenterState === "speaking" && !(livekitAi.aiPaused || aiPaused)
                  }
                  aiPaused={livekitAi.aiPaused || aiPaused}
                  aiStatus={livekitAi.aiStatus}
                  aiPresenterSlot={
                    screenShareActive && (showInternalPresenter || showExternalAvatar)
                      ? presenterNode
                      : undefined
                  }
                  recordingControls={
                    staffMode ? (
                      <DemoRecordingControls recording={demoRecording} />
                    ) : undefined
                  }
                  showJoinButton={
                    !endedSummary &&
                    livekit.status !== "connected" &&
                    livekit.status !== "connecting"
                  }
                  onJoinRoom={() => {
                    if (staffMode) {
                      void fetch(`/api/platform/demo/sessions/${sessionId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ join_live: true }),
                      }).then(() => refreshRoomQuietly());
                    }
                    void livekit.connect();
                  }}
                />
                </>
              )}
              <DemoCenterStage
                livekit={useLiveKitVideo ? livekit : null}
                useLiveKitVideo={useLiveKitVideo}
                screenShareActive={screenShareActive}
                currentDemoStage={session?.current_demo_stage}
                floatingPresenter={
                  screenShareActive && (showInternalPresenter || showExternalAvatar)
                    ? presenterNode
                    : undefined
                }
                demoPathTitle={session?.demo_path_title}
                slideBranding={session?.slide_branding}
                companyName={agent?.company_product_name}
                activeAsset={activeAsset}
                assets={assets}
                assetIndex={assetIndex}
                showBookingCta={showBookingCta}
                recommendedCta={session?.recommended_cta}
                onOpenBooking={openBooking}
                staffMode={staffMode}
                presenterNote={presenterNote}
                onPrevAsset={() => setAssetIndex((i) => Math.max(0, i - 1))}
                onNextAsset={() =>
                  setAssetIndex((i) => Math.min(assets.length - 1, i + 1))
                }
              />

              {showBooking && !bookingPlaceholder && agent && !endedSummary && !session?.booking_id && (
                <LiveAgentBookingPanel
                  agentId={agent.id}
                  sessionId={sessionId}
                  conversationId={conversationId}
                  demoSessionId={sessionId}
                  defaultName={name.trim() || leadDetail?.full_name || undefined}
                  defaultEmail={email.trim() || leadDetail?.email || undefined}
                  onBooked={(msg) => {
                    setLines((prev) => [...prev, { role: "system", content: msg }]);
                    setShowBooking(false);
                    void loadRoom();
                  }}
                  onDismiss={() => setShowBooking(false)}
                />
              )}

              {endedSummary && (
                <Card className="border-slate-700/50 bg-slate-950/60">
                  <CardHeader>
                    <CardTitle className="text-base text-white">Demo summary</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap text-slate-300">
                    {endedSummary}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="order-3 lg:order-3 flex flex-col min-h-0">
              <div className="lg:hidden mb-4">{leftPanel}</div>

              <DemoRightWorkspacePanel
                voicePanel={
                  !staffMode && voiceEnabled ? (
                    <DemoVoicePanel
                      status={voice.status}
                      error={voice.error}
                      muted={voice.muted}
                      voiceDemoActive={voice.voiceDemoActive}
                      useBrowserStt={voice.useBrowserStt}
                      disabled={aiPaused || sending}
                      onStartVoiceDemo={() => void voice.startVoiceDemo()}
                      onStopVoiceDemo={voice.stopVoiceDemo}
                      onSpeakNow={() => void voice.speakNow()}
                      onFinishSpeaking={voice.finishSpeaking}
                      onToggleMute={() => voice.setMuted(!voice.muted)}
                      onReconnect={voice.reconnect}
                    />
                  ) : undefined
                }
                aiState={aiPresenterState}
                voiceStatus={voice.status}
                aiPaused={aiPaused || livekitAi.aiPaused}
                detectedIntent={detectedIntentLabel}
                customerSentiment={customerSentimentLabel}
                transcriptLines={
                  transcriptLines.length
                    ? transcriptLines
                    : lines.map((l) => ({
                        speaker: l.role,
                        content: l.content,
                        input_type: "text",
                      }))
                }
                conversationPanel={
                  <>
                    <DemoConversationPanel
                      lines={lines}
                      sending={sending}
                      voiceStatus={voice.status}
                      aiPresenterState={aiPresenterState}
                      detectedIntent={detectedIntentLabel}
                      customerSentiment={customerSentimentLabel}
                      input={input}
                      onInputChange={setInput}
                      onSend={() => void sendMessage()}
                      staffMode={staffMode}
                      staffInput={staffInput}
                      onStaffInputChange={setStaffInput}
                      onStaffSend={() => void sendStaffMessage()}
                      staffSending={staffSending}
                      endedSummary={endedSummary}
                      aiPaused={aiPaused || livekitAi.aiPaused}
                      livekitAiPhase={livekitAi.phase}
                      useLiveKitVideo={useLiveKitVideo}
                      livekitAiJoined={livekitAi.aiJoined}
                      sendError={sendError}
                      retryable={retryable}
                      onRetry={retryLastMessage}
                      bottomRef={bottomRef}
                      showStateBadges={false}
                      staffControls={
                        !endedSummary && staffMode ? (
                          <div className="space-y-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-violet-500/40 text-xs w-full"
                              onClick={async () => {
                                const res = await fetch(
                                  `/api/platform/demo/sessions/${sessionId}`,
                                  {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ join_live: true }),
                                  }
                                );
                                const data = await res.json();
                                if (!res.ok) {
                                  toast.error(data.error ?? "Could not join");
                                  return;
                                }
                                toast.success("Joined live demo");
                                void refreshRoomQuietly();
                              }}
                            >
                              Join live demo
                            </Button>
                            <DemoStaffControlPanel
                              sessionId={sessionId}
                              agentId={agent?.id}
                              controlMode={session?.presentation_control_mode}
                              aiPaused={aiPaused}
                              screenShareActive={session?.screen_share_active}
                              presenterType={session?.current_presenter_type}
                              leadScore={session?.lead_score}
                              leadCategory={session?.lead_category}
                              objections={session?.objections}
                              recommendedNextAction={session?.recommended_next_action}
                              demoPathId={session?.demo_path_id}
                              currentAssetId={activeAsset?.id}
                              assets={assets.map((a) => ({ id: a.id, title: a.title }))}
                              pendingAiAction={session?.pending_presentation_action}
                              onSessionUpdated={() => void refreshRoomQuietly()}
                              onEndDemo={() => void endDemo()}
                              onMarkQualified={() => void staffMarkQualified()}
                              onMarkOpportunity={() => void staffMarkOpportunity()}
                              livekitScreenSharing={livekit.screenSharing}
                              onStartScreenShare={() => void livekit.toggleScreenShare()}
                              onStopScreenShare={() => void livekit.toggleScreenShare()}
                            />
                            <p className="text-xs text-violet-200/80 px-1">
                              Staff chat is visible to the prospect. AI stays quiet while you
                              have taken over.
                            </p>
                          </div>
                        ) : undefined
                      }
                    />
                    {error && !sendError && (
                      <p className="text-sm text-red-400 px-1 mt-2">{error}</p>
                    )}
                  </>
                }
              />
            </div>
          </div>
        )}

        {joined && !endedSummary && (
          <div className="mt-4">
            <DemoBottomControlBar
              staffMode={staffMode}
              ended={Boolean(endedSummary)}
              handoffLoading={handoffLoading}
              handoffRequired={session?.handoff_required}
              ending={ending}
              bookingRecommended={session?.booking_recommended}
              aiPaused={aiPaused}
              busy={staffControlBusy}
              onRequestHuman={() => void requestHandoff()}
              onBook={openBooking}
              onEnd={() => void endDemo()}
              onTakeOver={() => void staffTakeOver()}
              onPauseAi={() => void staffPauseAi()}
              onResumeAi={() => void staffResumeAi()}
              onShowBookingCta={() => void staffShowBookingCta()}
              onMarkQualified={() => void staffMarkQualified()}
              onMarkOpportunity={() => void staffMarkOpportunity()}
              onCreateFollowUp={() => void staffCreateFollowUp()}
            />
          </div>
        )}
      </main>
    </div>
  );
}
