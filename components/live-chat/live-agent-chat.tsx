"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { visitorToUiMessages, type UiChatMessage } from "@/lib/chat/visitor-message-ui";
import { useVisitorHandoffSync } from "@/hooks/use-visitor-handoff-sync";
import {
  READYBOT_BUDGET_QUICK_REPLIES,
} from "@/lib/platform/playbooks/digital-ready-readybot";
import {
  LIVE_AGENT_DEFAULT_QUICK_PROMPTS,
  LIVE_AGENT_QUALIFICATION_WELCOME,
} from "@/lib/copy/public-messaging";
import { LiveAgentSalesStrip } from "@/components/live-chat/live-agent-sales-strip";
import { LiveAgentStageBar } from "@/components/live-chat/live-agent-stage-bar";
import { resolveUiPipelineStage } from "@/lib/live-chat/pipeline-stages";
import type { VisitorChatMessage } from "@/lib/platform/visitor-chat";
import { LiveAgentBookingPanel } from "./live-agent-booking-panel";
import { LiveAgentAudioControls } from "./live-agent-audio-controls";
import { useLiveAgentVoice } from "@/hooks/use-live-agent-voice";
import type { PlatformChatResponseBody } from "@/lib/platform/chat/build-platform-chat-response";
import { readybotMicroStepLabel } from "@/lib/platform/workflow/readybot-micro-steps";
import styles from "./live-agent-chat.module.css";

export type LiveAgentMeta = {
  id: string;
  name: string;
  nickname?: string | null;
  companyProductName?: string | null;
  welcomeMessage: string;
};

type ChatMessage = UiChatMessage & {
  inputMode?: "text" | "audio";
  audioBase64?: string | null;
  audioMimeType?: string | null;
  at?: string;
};

type PlatformChatResponse = PlatformChatResponseBody & {
  staffHandling?: boolean;
  staffJoined?: boolean;
  status?: string;
  messages?: VisitorChatMessage[];
  error?: string;
  code?: string;
};

function isReadybotAgent(meta: LiveAgentMeta | null): boolean {
  if (!meta) return false;
  const label = `${meta.name} ${meta.nickname ?? ""}`.toLowerCase();
  return label.includes("readybot");
}

type QuickPrompt = {
  label: string;
  message: string;
  variant?: "default" | "accent" | "sales";
};

function quickPromptsForAgent(
  meta: LiveAgentMeta | null,
  conversationStage?: string,
  readybotPipelineStep?: PlatformChatResponseBody["readybotPipelineStep"]
): QuickPrompt[] {
  if (!isReadybotAgent(meta)) {
    return DEFAULT_QUICK_PROMPTS.map((message) => ({ label: message, message }));
  }
  const step =
    readybotPipelineStep ??
    (conversationStage === "greeting"
      ? "onboarding"
      : conversationStage === "discovery"
        ? "discovery"
        : conversationStage === "qualification"
          ? "stack"
          : conversationStage === "booking"
            ? "close"
            : undefined);
  if (step === "budget_timing" || step === "team") {
    return [
      ...READYBOT_BUDGET_QUICK_REPLIES.map((p) => ({ ...p, variant: "accent" as const })),
      {
        label: "Talk to Sales",
        message: "I'd like to speak with someone on your sales team.",
        variant: "sales" as const,
      },
    ];
  }
  if (step === "stack" || conversationStage === "qualification") {
    return [
      {
        label: "Paid Ads & Leads",
        message:
          "I want to focus on paid ads and lead generation (Meta, Google, or TikTok).",
        variant: "accent" as const,
      },
      {
        label: "Social Media Management",
        message: "We need social media management and branding support.",
        variant: "accent" as const,
      },
      {
        label: "Digital Transformation",
        message:
          "We're looking for full-scale digital transformation — web, e-commerce, and automation.",
        variant: "accent" as const,
      },
      {
        label: "Talk to Sales",
        message: "I'd like to speak with someone on your sales team.",
        variant: "sales" as const,
      },
    ];
  }
  if (step === "onboarding" || step === "discovery" || conversationStage === "greeting" || conversationStage === "discovery") {
    return [
      {
        label: "Paid Ads & Leads",
        message:
          "I want to focus on paid ads and lead generation (Meta, Google, or TikTok).",
        variant: "accent" as const,
      },
      {
        label: "Social Media Management",
        message: "We need social media management and branding support.",
        variant: "accent" as const,
      },
      {
        label: "Digital Transformation",
        message:
          "We're looking for full-scale digital transformation — web, e-commerce, and automation.",
        variant: "accent" as const,
      },
      {
        label: "Talk to Sales",
        message: "I'd like to speak with someone on your sales team.",
        variant: "sales" as const,
      },
    ];
  }
  return [
    {
      label: "Paid Ads & Leads",
      message:
        "I want to focus on paid ads and lead generation (Meta, Google, or TikTok).",
      variant: "accent" as const,
    },
    {
      label: "Talk to Sales",
      message: "I'd like to speak with someone on your sales team.",
      variant: "sales" as const,
    },
  ];
}

function historyRowsToUi(
  rows: {
    id?: string;
    role: string;
    content: string;
    at?: string;
    label?: string;
  }[]
): ChatMessage[] {
  return rows.map((m, i) => ({
    id: m.id ?? `hist_${i}_${m.at ?? i}`,
    role:
      m.role === "user" || m.role === "staff" || m.role === "system"
        ? m.role
        : "assistant",
    content: m.content,
    label: m.label,
    at: m.at,
  }));
}

const DEFAULT_QUICK_PROMPTS = [...LIVE_AGENT_DEFAULT_QUICK_PROMPTS];

function sessionStorageKey(agentId: string): string {
  return `digisales_live_session_${agentId}`;
}

function getOrCreateSessionId(agentId: string): string {
  const key = sessionStorageKey(agentId);
  let id = localStorage.getItem(key);
  if (!id) {
    id = `live_${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function LiveAgentChat({
  agentId,
  embed = false,
}: {
  agentId: string;
  embed?: boolean;
}) {
  const [meta, setMeta] = useState<LiveAgentMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [handoffActive, setHandoffActive] = useState(false);
  const [staffJoined, setStaffJoined] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversationStage, setConversationStage] = useState<string | undefined>();
  const [readybotPipelineStep, setReadybotPipelineStep] = useState<
    PlatformChatResponseBody["readybotPipelineStep"]
  >();
  const [detectedIntent, setDetectedIntent] = useState<string | undefined>();
  const [leadCategory, setLeadCategory] = useState<string | undefined>();
  const [recommendedNextAction, setRecommendedNextAction] = useState<
    string | undefined
  >();
  const [readybotMicroStep, setReadybotMicroStep] = useState<
    PlatformChatResponseBody["readybotMicroStep"]
  >();
  const [voiceInputMode, setVoiceInputMode] = useState(false);
  const [voiceOutputMode, setVoiceOutputMode] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const uiPipelineStage = useMemo(
    () =>
      resolveUiPipelineStage({
        readybotPipelineStep,
        conversationStage,
        handoffActive,
      }),
    [conversationStage, handoffActive, readybotPipelineStep]
  );

  const quickPrompts = useMemo(
    () => quickPromptsForAgent(meta, conversationStage, readybotPipelineStep),
    [meta, conversationStage, readybotPipelineStep]
  );

  const handoffPollEnabled = handoffActive && Boolean(sessionId);

  const applySyncMessages = useCallback((merged: VisitorChatMessage[]) => {
    const ui = visitorToUiMessages(merged);
    if (ui.length === 0) return;
    setMessages(ui);
  }, []);

  const handleHandoffEnded = useCallback(() => {
    setHandoffActive(false);
    setStaffJoined(false);
    setHandoffMessage(null);
  }, []);

  const { refresh: refreshHandoff } = useVisitorHandoffSync({
    sessionId,
    agentId,
    enabled: handoffPollEnabled,
    localMessages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      at: "",
      label: m.label,
    })),
    onSync: (payload) => {
      setConversationId(payload.conversationId);
      setHandoffActive(payload.handoffActive);
      setStaffJoined(payload.staffJoined);
    },
    onMessages: applySyncMessages,
    onHandoffEnded: handleHandoffEnded,
  });

  const applyPlatformResponse = useCallback(
    (data: PlatformChatResponse) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.reply?.trim() || "Thanks for your message.",
          audioBase64: data.audioBase64,
          audioMimeType: data.audioMimeType,
          at: new Date().toISOString(),
        },
      ]);

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.conversationStage) setConversationStage(data.conversationStage);
      if (data.readybotPipelineStep) setReadybotPipelineStep(data.readybotPipelineStep);
      if (data.readybotMicroStep !== undefined) {
        setReadybotMicroStep(data.readybotMicroStep);
      }
      if (data.detectedIntent) setDetectedIntent(data.detectedIntent);
      if (data.leadCategory) setLeadCategory(data.leadCategory);

      if (data.staffHandling) {
        setHandoffActive(true);
        setShowBooking(false);
        if (data.staffJoined) setStaffJoined(true);
        if (data.messages?.length) applySyncMessages(data.messages);
        else void refreshHandoff();
        if (data.reply?.trim()) {
          setMessages((prev) => [
            ...prev,
            {
              id: `ack_${Date.now()}`,
              role: "system",
              content: data.reply!.trim(),
            },
          ]);
        }
        return;
      }

      if (data.handoffRequired || data.handoffActive) {
        setHandoffActive(true);
        setShowBooking(false);
        const msg =
          data.handoffMessage?.trim() ||
          "A member of our team will follow up with you shortly. Thank you for your patience.";
        setHandoffMessage(msg);
        setMessages((prev) => [
          ...prev,
          { id: `handoff_${Date.now()}`, role: "system", content: msg },
        ]);
        void refreshHandoff();
      } else if (data.suggestBooking || data.bookingRecommended) {
        setShowBooking(true);
      }

      if (data.recommendedNextAction) {
        setRecommendedNextAction(data.recommendedNextAction);
      } else if (data.reply && data.leadCategory === "hot") {
        setRecommendedNextAction("Book consultation or assign human closer");
      }
    },
    [applySyncMessages, refreshHandoff]
  );

  const handleVoiceTurn = useCallback(
    (data: PlatformChatResponse & { transcript?: string }) => {
      const transcript = data.transcript?.trim();
      if (transcript) {
        setMessages((prev) => {
          const withoutWelcomeOnly =
            prev.length === 1 && prev[0]?.id === "welcome" ? [] : prev;
          return [
            ...withoutWelcomeOnly,
            {
              id: `u_voice_${Date.now()}`,
              role: "user",
              content: transcript,
              inputMode: "audio",
              at: new Date().toISOString(),
            },
          ];
        });
      }
      applyPlatformResponse(data);
      setIsLoading(false);
    },
    [applyPlatformResponse]
  );

  const handleVoiceError = useCallback((message: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `err_voice_${Date.now()}`, role: "assistant", content: message },
    ]);
    setIsLoading(false);
  }, []);

  const {
    status: voiceStatus,
    recording,
    toggleRecording,
    playResponseAudio,
  } = useLiveAgentVoice({
    sessionId,
    agentId,
    enabled: voiceInputMode && !handoffActive && Boolean(sessionId),
    autoPlay: voiceOutputMode,
    onTurnComplete: handleVoiceTurn,
    onError: handleVoiceError,
  });

  const sessionStatus = useMemo(() => {
    if (voiceStatus === "listening") return "Listening…";
    if (voiceStatus === "processing") return "Transcribing…";
    if (isLoading) return "Typing…";
    if (voiceStatus === "ai_speaking") return "Speaking…";
    return null;
  }, [isLoading, voiceStatus]);

  const displayName = useMemo(() => {
    if (!meta) return "AI Assistant";
    return meta.nickname?.trim() || meta.name;
  }, [meta]);

  const rootClass = embed ? `${styles.root} ${styles.rootEmbed}` : styles.root;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading, handoffActive]);

  useEffect(() => {
    const sid = getOrCreateSessionId(agentId);
    setSessionId(sid);

    let cancelled = false;

    async function bootstrap() {
      try {
        const [agentRes, historyRes] = await Promise.all([
          fetch(`/api/platform/chat/agent?agentId=${encodeURIComponent(agentId)}`),
          fetch(
            `/api/platform/chat/history?sessionId=${encodeURIComponent(sid)}&agentId=${encodeURIComponent(agentId)}`
          ),
        ]);

        if (!agentRes.ok) {
          const err = await agentRes.json().catch(() => ({}));
          throw new Error(
            typeof err.error === "string" ? err.error : "This agent is not available."
          );
        }

        const agentPayload = (await agentRes.json()) as LiveAgentMeta & {
          companyProductName?: string;
        };

        if (cancelled) return;

        setMeta({
          id: agentPayload.id,
          name: agentPayload.name,
          nickname: agentPayload.nickname,
          companyProductName: agentPayload.companyProductName,
          welcomeMessage: agentPayload.welcomeMessage,
        });

        const historyPayload = historyRes.ok
          ? await historyRes.json()
          : { messages: [] as { role: string; content: string; at?: string; id?: string }[] };

        const stored = (historyPayload.messages ?? []) as {
          id?: string;
          role: string;
          content: string;
          at?: string;
          label?: string;
        }[];

        if (historyPayload.conversationId) {
          setConversationId(historyPayload.conversationId);
        }
        if (historyPayload.handoffActive) {
          setHandoffActive(true);
          setStaffJoined(Boolean(historyPayload.staffJoined));
        }

        if (stored.length > 0) {
          setMessages(historyRowsToUi(stored));
        } else {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                agentPayload.welcomeMessage?.trim() ||
                historyPayload.welcomeMessage?.trim() ||
                LIVE_AGENT_QUALIFICATION_WELCOME,
              at: new Date().toISOString(),
            },
          ]);
        }

        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Unable to load chat. Please try again."
          );
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || !sessionId || voiceInputMode) return;

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: trimmed,
        inputMode: "text",
        at: new Date().toISOString(),
      };

      setMessages((prev) => {
        const withoutWelcomeOnly =
          prev.length === 1 && prev[0]?.id === "welcome" ? [] : prev;
        return [...withoutWelcomeOnly, userMsg];
      });
      setInput("");
      setIsLoading(true);

      try {
        const endpoint = voiceOutputMode
          ? "/api/platform/chat/voice"
          : "/api/platform/chat";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            agentId,
            message: trimmed,
            channel: "live_agent",
            includeTts: voiceOutputMode,
          }),
        });

        const data = (await res.json()) as PlatformChatResponse;

        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Message could not be sent. Please try again."
          );
        }

        applyPlatformResponse(data);
        if (voiceOutputMode && data.reply) {
          await playResponseAudio(
            data.reply,
            data.audioBase64,
            data.audioMimeType
          );
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content:
              err instanceof Error
                ? err.message
                : "Sorry, something went wrong. Please try again in a moment.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      agentId,
      applyPlatformResponse,
      isLoading,
      playResponseAudio,
      sessionId,
      voiceInputMode,
      voiceOutputMode,
    ]
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  if (loadError) {
    return (
      <ChatShell rootClass={rootClass}>
        <StatePanel title="Chat unavailable" text={loadError} />
      </ChatShell>
    );
  }

  if (!ready || !meta) {
    return (
      <ChatShell rootClass={rootClass}>
        <StatePanel title="Starting chat" text="Connecting to your assistant…" loading />
      </ChatShell>
    );
  }

  return (
    <div className={rootClass}>
      <header className={styles.header}>
        <ChatHeader
          displayName={displayName}
          company={meta.companyProductName}
          initialsText={initials(displayName)}
          handoffActive={handoffActive}
          staffJoined={staffJoined}
          handoffMessage={handoffMessage}
        />
      </header>

      <LiveAgentStageBar activeStage={uiPipelineStage} />

      {sessionStatus ? (
        <p className={styles.sessionStatus} role="status" aria-live="polite">
          {sessionStatus}
        </p>
      ) : null}

      <LiveAgentSalesStrip
        stage={conversationStage}
        intent={detectedIntent}
        leadCategory={leadCategory}
        nextAction={
          readybotMicroStep
            ? readybotMicroStepLabel(readybotMicroStep) ?? recommendedNextAction
            : recommendedNextAction
        }
        handoffActive={handoffActive}
        staffJoined={staffJoined}
        bookingReady={showBooking}
      />

      <ChatMessages
        scrollRef={scrollRef}
        messages={messages}
        displayName={displayName}
        loadingLabel={
          voiceStatus === "processing"
            ? "Transcribing…"
            : voiceStatus === "listening"
              ? "Listening…"
              : "Typing…"
        }
        showTyping={isLoading || voiceStatus === "processing"}
        voiceOutputMode={voiceOutputMode}
      />

      <QuickPrompts
        disabled={isLoading}
        hidden={handoffActive}
        prompts={quickPrompts}
        onSelect={(t) => void sendMessage(t)}
      />

      {showBooking && !handoffActive && sessionId ? (
        <LiveAgentBookingPanel
          agentId={agentId}
          sessionId={sessionId}
          conversationId={conversationId}
          onBooked={(msg) => {
            setShowBooking(false);
            setMessages((prev) => [
              ...prev,
              {
                id: `booked_${Date.now()}`,
                role: "system",
                content: msg,
              },
            ]);
          }}
          onDismiss={() => setShowBooking(false)}
        />
      ) : null}

      <form className={styles.composer} onSubmit={onSubmit}>
        <div className={styles.composerToolbar}>
          <div className={styles.toolbarGroup}>
            <span className={styles.toolbarLabel}>Input</span>
            <div className={styles.segmented} role="group" aria-label="Input mode">
              <button
                type="button"
                className={
                  !voiceInputMode
                    ? `${styles.segmentBtn} ${styles.segmentBtnActive}`
                    : styles.segmentBtn
                }
                onClick={() => setVoiceInputMode(false)}
                disabled={handoffActive}
                aria-pressed={!voiceInputMode}
              >
                Text
              </button>
              <button
                type="button"
                className={
                  voiceInputMode
                    ? `${styles.segmentBtn} ${styles.segmentBtnActive}`
                    : styles.segmentBtn
                }
                onClick={() => setVoiceInputMode(true)}
                disabled={handoffActive}
                aria-pressed={voiceInputMode}
              >
                Voice
              </button>
            </div>
          </div>
          <div className={styles.toolbarGroup}>
            <span className={styles.toolbarLabel}>AI replies</span>
            <div className={styles.segmented} role="group" aria-label="Reply mode">
              <button
                type="button"
                className={
                  !voiceOutputMode
                    ? `${styles.segmentBtn} ${styles.segmentBtnActive}`
                    : styles.segmentBtn
                }
                onClick={() => setVoiceOutputMode(false)}
                aria-pressed={!voiceOutputMode}
              >
                Text
              </button>
              <button
                type="button"
                className={
                  voiceOutputMode
                    ? `${styles.segmentBtn} ${styles.segmentBtnActive}`
                    : styles.segmentBtn
                }
                onClick={() => setVoiceOutputMode(true)}
                aria-pressed={voiceOutputMode}
              >
                Audio
              </button>
            </div>
          </div>
        </div>
        {voiceInputMode ? (
          <div className={styles.voiceRow}>
            <button
              type="button"
              className={
                recording ? `${styles.micBtn} ${styles.micBtnActive}` : styles.micBtn
              }
              disabled={isLoading || handoffActive || voiceStatus === "processing"}
              onClick={() => void toggleRecording()}
            >
              {recording
                ? "Stop & send"
                : voiceStatus === "listening"
                  ? "Listening…"
                  : voiceStatus === "ai_speaking"
                    ? "AI speaking…"
                    : "Tap to speak"}
            </button>
            <p className={styles.voiceHint}>
              Speak your answer — Whisper transcribes it, ReadyBot replies in text and audio.
            </p>
          </div>
        ) : (
          <div className={styles.composerInputRow}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                handoffActive
                  ? "Message your human closer…"
                  : "Tell the AI agent about your goals…"
              }
              disabled={isLoading}
              autoComplete="off"
              aria-label="Your message"
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function ChatShell({
  rootClass,
  children,
}: {
  rootClass: string;
  children: ReactNode;
}) {
  return <div className={rootClass}>{children}</div>;
}

function StatePanel({
  title,
  text,
  loading,
}: {
  title: string;
  text: string;
  loading?: boolean;
}) {
  return (
    <div className={styles.stateCard}>
      {loading ? <div className={styles.spinner} aria-hidden /> : null}
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateText}>{text}</p>
    </div>
  );
}

function ChatHeader({
  displayName,
  company,
  initialsText,
  handoffActive,
  staffJoined,
  handoffMessage,
}: {
  displayName: string;
  company?: string | null;
  initialsText: string;
  handoffActive: boolean;
  staffJoined?: boolean;
  handoffMessage: string | null;
}) {
  return (
    <>
      <div className={styles.headerRow}>
        <div className={styles.avatar} aria-hidden>
          {initialsText}
        </div>
        <div className={styles.headerText}>
          <h1 className={styles.agentName}>{displayName}</h1>
          {company?.trim() ? (
            <p className={styles.companyName}>{company.trim()}</p>
          ) : null}
        </div>
        <span className={styles.statusPill}>
          <span className={styles.statusDot} aria-hidden />
          {staffJoined ? "Team online" : handoffActive ? "Handoff" : "Online"}
        </span>
      </div>
      {handoffActive ? (
        <p className={styles.handoffBanner} role="status">
          {staffJoined
            ? "A team member is in this chat. Messages appear here in real time."
            : handoffMessage ??
              "A team member will join this chat shortly. You can keep messaging here."}
        </p>
      ) : null}
    </>
  );
}

function ChatMessages({
  scrollRef,
  messages,
  displayName,
  loadingLabel,
  showTyping,
  voiceOutputMode,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  displayName: string;
  loadingLabel: string;
  showTyping: boolean;
  voiceOutputMode: boolean;
}) {
  return (
    <div ref={scrollRef} className={styles.messages} role="log" aria-live="polite">
      {messages.map((m) => (
        <ChatBubble
          key={m.id}
          message={m}
          assistantLabel={displayName}
          voiceOutputMode={voiceOutputMode}
        />
      ))}
      {showTyping ? (
        <div className={styles.typingRow} aria-label={loadingLabel} aria-live="polite">
          <div className={styles.typing}>
            <span />
            <span />
            <span />
          </div>
          <span className={styles.typingLabel}>{loadingLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function ChatBubble({
  message,
  assistantLabel,
  voiceOutputMode,
}: {
  message: ChatMessage;
  assistantLabel: string;
  voiceOutputMode: boolean;
}) {
  const className =
    message.role === "user"
      ? styles.bubbleUser
      : message.role === "staff"
        ? styles.bubbleStaff
        : message.role === "system"
          ? styles.bubbleSystem
          : styles.bubbleAssistant;

  const label =
    message.role === "user"
      ? "You"
      : message.role === "staff"
        ? message.label ?? "Team member"
        : assistantLabel;

  return (
    <div className={`${className} ${styles.bubbleEnter}`}>
      {message.role !== "system" ? (
        <div className={styles.bubbleHeader}>
          <p className={styles.bubbleLabel}>
            {label}
            {message.inputMode === "audio" ? (
              <span className={styles.voiceBadge}> · voice</span>
            ) : null}
          </p>
          {message.at ? (
            <time className={styles.bubbleTime} dateTime={message.at}>
              {formatMessageTime(message.at)}
            </time>
          ) : null}
        </div>
      ) : null}
      <p className={styles.bubbleText}>{renderBoldMarkdown(message.content)}</p>
      {message.role === "assistant" && voiceOutputMode ? (
        <LiveAgentAudioControls
          text={message.content}
          audioBase64={message.audioBase64}
          audioMimeType={message.audioMimeType}
        />
      ) : null}
    </div>
  );
}

function renderBoldMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function QuickPrompts({
  disabled,
  hidden,
  prompts,
  onSelect,
}: {
  disabled: boolean;
  hidden?: boolean;
  prompts: QuickPrompt[];
  onSelect: (text: string) => void;
}) {
  if (hidden) return null;
  return (
    <div className={styles.quickRow}>
      {prompts.map((p) => (
        <button
          key={p.label}
          type="button"
          className={
            p.variant === "sales"
              ? styles.quickBtnSales
              : p.variant === "accent"
                ? styles.quickBtnAccent
                : styles.quickBtn
          }
          disabled={disabled}
          onClick={() => onSelect(p.message)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
