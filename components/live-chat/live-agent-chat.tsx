"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
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
import {
  LiveAgentConversationSidebar,
  SidebarToggleButton,
} from "@/components/live-chat/live-agent-conversation-sidebar";
import {
  createConversation,
  getActiveSessionId,
  getPriorSessionId,
  listConversations,
  migrateLegacyConversationIndex,
  replaceConversationSessionId,
  setActiveSessionId,
  touchConversationFromUserMessage,
  type VisitorConversationEntry,
} from "@/lib/live-chat/visitor-conversation-store";
import type { VisitorChatMessage } from "@/lib/platform/visitor-chat";
import { LiveAgentBookingPanel } from "./live-agent-booking-panel";
import { useComposerDictation } from "@/hooks/use-composer-dictation";
import {
  clearLiveSessionToken,
  getStoredLiveSessionToken,
  storeLiveSessionToken,
  visitorAuthHeaders,
} from "@/lib/auth/visitor-session-client";
import type { PlatformChatResponseBody } from "@/lib/platform/chat/build-platform-chat-response";
import styles from "./live-agent-chat.module.css";

export type LiveAgentMeta = {
  id: string;
  name: string;
  nickname?: string | null;
  companyProductName?: string | null;
  welcomeMessage: string;
};

type ChatMessage = UiChatMessage & {
  at?: string;
};

type PlatformChatResponse = PlatformChatResponseBody & {
  visitorToken?: string;
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function LiveAgentChat({
  agentId,
  embed = false,
  startFresh = false,
  initialSessionId,
}: {
  agentId: string;
  embed?: boolean;
  /** When true, always open a blank conversation (e.g. from landing CTA). */
  startFresh?: boolean;
  initialSessionId?: string;
}) {
  const [meta, setMeta] = useState<LiveAgentMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
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
  const [priorSessionId, setPriorSessionId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<VisitorConversationEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionSwitching, setSessionSwitching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshConversationList = useCallback(() => {
    setConversations(listConversations(agentId));
  }, [agentId]);

  const quickPrompts = useMemo(
    () => quickPromptsForAgent(meta, conversationStage, readybotPipelineStep),
    [meta, conversationStage, readybotPipelineStep]
  );

  const handoffPollEnabled = handoffActive && Boolean(sessionId);

  const welcomeText = useCallback(
    (agentMeta?: LiveAgentMeta | null) =>
      agentMeta?.welcomeMessage?.trim() || LIVE_AGENT_QUALIFICATION_WELCOME,
    []
  );

  const makeWelcomeMessage = useCallback(
    (agentMeta?: LiveAgentMeta | null): ChatMessage => ({
      id: `welcome_${Date.now()}`,
      role: "assistant",
      content: welcomeText(agentMeta),
      at: new Date().toISOString(),
    }),
    [welcomeText]
  );

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
    visitorToken,
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
          at: new Date().toISOString(),
        },
      ]);

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.conversationStage) setConversationStage(data.conversationStage);
      if (data.readybotPipelineStep) setReadybotPipelineStep(data.readybotPipelineStep);
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

  const rotateSessionForAuth = useCallback(() => {
    if (!sessionId) return null;
    const oldSid = sessionId;
    clearLiveSessionToken(agentId, oldSid);
    const newSid = `live_${crypto.randomUUID()}`;
    replaceConversationSessionId(agentId, oldSid, newSid);
    setActiveSessionId(agentId, newSid);
    setSessionId(newSid);
    setVisitorToken(null);
    setConversationId(undefined);
    setHandoffActive(false);
    setStaffJoined(false);
    refreshConversationList();
    return newSid;
  }, [agentId, refreshConversationList, sessionId]);

  const resetPipelineState = useCallback(() => {
    setConversationId(undefined);
    setConversationStage(undefined);
    setReadybotPipelineStep(undefined);
    setDetectedIntent(undefined);
    setLeadCategory(undefined);
    setRecommendedNextAction(undefined);
    setHandoffActive(false);
    setStaffJoined(false);
    setHandoffMessage(null);
    setShowBooking(false);
    setInput("");
  }, []);

  const loadConversationSession = useCallback(
    async (sid: string) => {
      setSessionSwitching(true);
      setSessionId(sid);
      setActiveSessionId(agentId, sid);
      setPriorSessionId(getPriorSessionId(agentId, sid));
      setMessages([makeWelcomeMessage(meta)]);
      const storedToken = getStoredLiveSessionToken(agentId, sid);
      setVisitorToken(storedToken);
      resetPipelineState();

      try {
        let agentMeta = meta;
        if (!agentMeta) {
          const agentRes = await fetch(
            `/api/platform/chat/agent?agentId=${encodeURIComponent(agentId)}`
          );
          if (!agentRes.ok) {
            const err = await agentRes.json().catch(() => ({}));
            throw new Error(
              typeof err.error === "string" ? err.error : "This agent is not available."
            );
          }
          const agentPayload = (await agentRes.json()) as LiveAgentMeta & {
            companyProductName?: string;
          };
          agentMeta = {
            id: agentPayload.id,
            name: agentPayload.name,
            nickname: agentPayload.nickname,
            companyProductName: agentPayload.companyProductName,
            welcomeMessage: agentPayload.welcomeMessage,
          };
          setMeta(agentMeta);
        }

        let activeSid = sid;
        let activeToken = storedToken;
        let historyRes = await fetch(
          `/api/platform/chat/history?sessionId=${encodeURIComponent(activeSid)}&agentId=${encodeURIComponent(agentId)}`,
          { headers: visitorAuthHeaders(activeToken) }
        );

        if (historyRes.status === 401) {
          clearLiveSessionToken(agentId, activeSid);
          const newSid = `live_${crypto.randomUUID()}`;
          replaceConversationSessionId(agentId, activeSid, newSid);
          activeSid = newSid;
          activeToken = null;
          setSessionId(newSid);
          setActiveSessionId(agentId, newSid);
          setVisitorToken(null);
          refreshConversationList();
          historyRes = await fetch(
            `/api/platform/chat/history?sessionId=${encodeURIComponent(activeSid)}&agentId=${encodeURIComponent(agentId)}`,
            { headers: visitorAuthHeaders(null) }
          );
        }

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
                agentMeta.welcomeMessage?.trim() ||
                historyPayload.welcomeMessage?.trim() ||
                LIVE_AGENT_QUALIFICATION_WELCOME,
              at: new Date().toISOString(),
            },
          ]);
        }

        setReady(true);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Unable to load chat. Please try again."
        );
      } finally {
        setSessionSwitching(false);
      }
    },
    [agentId, makeWelcomeMessage, meta, refreshConversationList, resetPipelineState]
  );

  const startNewConversation = useCallback(() => {
    const priorSid = sessionId || undefined;
    const sid = createConversation(agentId, { priorSessionId: priorSid });
    setPriorSessionId(priorSid ?? null);
    setSessionId(sid);
    setActiveSessionId(agentId, sid);
    setVisitorToken(null);
    setConversationId(undefined);
    resetPipelineState();
    setMessages([makeWelcomeMessage(meta)]);
    setReady(true);
    setSessionSwitching(false);
    refreshConversationList();
    setSidebarOpen(false);
  }, [
    agentId,
    makeWelcomeMessage,
    meta,
    refreshConversationList,
    resetPipelineState,
    sessionId,
  ]);

  const switchConversation = useCallback(
    (sid: string) => {
      if (sid === sessionId || sessionSwitching) return;
      setSidebarOpen(false);
      void loadConversationSession(sid);
    },
    [loadConversationSession, sessionId, sessionSwitching]
  );

  const dictation = useComposerDictation({
    agentId,
    sessionId,
    disabled: handoffActive || isLoading || sessionSwitching,
  });

  const displayName = useMemo(() => {
    if (!meta) return "AI Assistant";
    return meta.nickname?.trim() || meta.name;
  }, [meta]);

  const rootClass = embed ? `${styles.root} ${styles.rootEmbed}` : styles.root;

  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, sessionSwitching, dictation.isTranscribing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    migrateLegacyConversationIndex(agentId);
    refreshConversationList();

    let sid: string;
    if (initialSessionId?.trim()) {
      sid = initialSessionId.trim();
      setActiveSessionId(agentId, sid);
    } else if (startFresh) {
      sid = createConversation(agentId);
    } else {
      sid = getActiveSessionId(agentId) ?? createConversation(agentId);
    }

    refreshConversationList();
    void loadConversationSession(sid);
    // Bootstrap only when agent or entry intent changes — not when meta loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [agentId, initialSessionId, startFresh]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || !sessionId || dictation.isRecording) return;

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: trimmed,
        at: new Date().toISOString(),
      };

      setMessages((prev) => {
        const welcomeOnly =
          prev.length === 1 &&
          (prev[0]?.id === "welcome" || prev[0]?.id.startsWith("welcome_"));
        return [...(welcomeOnly ? [] : prev), userMsg];
      });
      setInput("");
      setIsLoading(true);
      touchConversationFromUserMessage(agentId, sessionId, trimmed);
      refreshConversationList();

      try {
        const postChat = (sid: string, token: string | null) =>
          fetch("/api/platform/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...visitorAuthHeaders(token),
            },
            body: JSON.stringify({
              sessionId: sid,
              agentId,
              message: trimmed,
              channel: "live_agent",
              ...(priorSessionId ? { priorSessionId } : {}),
            }),
          });

        let activeSessionId = sessionId;
        let activeToken = visitorToken;
        let res = await postChat(activeSessionId, activeToken);

        if (res.status === 401) {
          const rotated = rotateSessionForAuth();
          if (rotated) {
            activeSessionId = rotated;
            activeToken = null;
            res = await postChat(activeSessionId, activeToken);
          }
        }

        const data = (await res.json()) as PlatformChatResponse;

        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Message could not be sent. Please try again."
          );
        }

        if (data.visitorToken) {
          storeLiveSessionToken(agentId, activeSessionId, data.visitorToken);
          setVisitorToken(data.visitorToken);
        }

        applyPlatformResponse(data);
        refreshConversationList();
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
      dictation.isRecording,
      isLoading,
      priorSessionId,
      refreshConversationList,
      rotateSessionForAuth,
      sessionId,
      visitorToken,
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

  const workspaceClass = embed
    ? `${styles.workspace} ${styles.workspaceEmbed}`
    : styles.workspace;

  return (
    <div className={workspaceClass}>
      <LiveAgentConversationSidebar
        conversations={conversations}
        activeSessionId={sessionId}
        open={sidebarOpen}
        embed={embed}
        disabled={sessionSwitching || isLoading}
        onNewChat={startNewConversation}
        onSelect={switchConversation}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={rootClass}>
      <header className={styles.header}>
        <ChatHeader
          displayName={displayName}
          company={meta.companyProductName}
          initialsText={initials(displayName)}
          handoffActive={handoffActive}
          staffJoined={staffJoined}
          handoffMessage={handoffMessage}
          headerStart={
            <SidebarToggleButton onClick={() => setSidebarOpen((o) => !o)} />
          }
        />
      </header>

      <div className={styles.conversationPanel}>
        <ChatMessages
          scrollRef={scrollRef}
          messagesEndRef={messagesEndRef}
          messages={messages}
          displayName={displayName}
          showTyping={isLoading || dictation.isTranscribing}
        />

        <QuickPrompts
          disabled={isLoading || dictation.isTranscribing || sessionSwitching}
          hidden={handoffActive}
          prompts={quickPrompts}
          onSelect={(t) => void sendMessage(t)}
        />
      </div>

      {sessionSwitching ? (
        <div className={styles.sessionSwitchOverlay} role="status" aria-live="polite">
          Loading conversation…
        </div>
      ) : null}

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
        {dictation.isRecording ? (
          <div className={styles.dictationBar} role="status" aria-live="polite">
            <span className={styles.dictationPulse} aria-hidden />
            <span className={styles.dictationLabel}>Listening… tap Done when finished</span>
            <button
              type="button"
              className={styles.dictationDoneBtn}
              onClick={() => {
                void dictation.finishRecording().then((text) => {
                  if (text) {
                    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
                    textareaRef.current?.focus();
                  }
                });
              }}
            >
              Done
            </button>
            <button
              type="button"
              className={styles.dictationCancelBtn}
              onClick={() => dictation.cancelRecording()}
            >
              Cancel
            </button>
          </div>
        ) : null}
        <div className={styles.composerBox}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder={
              dictation.isTranscribing
                ? "Transcribing…"
                : handoffActive
                  ? "Message your team…"
                  : "Message your AI sales agent…"
            }
            disabled={isLoading || dictation.isTranscribing || handoffActive}
            autoComplete="off"
            aria-label="Your message"
          />
          <div className={styles.composerActions}>
            <button
              type="button"
              className={styles.micBtn}
              disabled={
                isLoading || dictation.isTranscribing || handoffActive || sessionSwitching
              }
              onClick={() => {
                void dictation.startRecording().catch((err) => {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `err_mic_${Date.now()}`,
                      role: "assistant",
                      content:
                        err instanceof Error
                          ? err.message
                          : "Microphone access was denied.",
                    },
                  ]);
                });
              }}
              aria-label="Dictate message"
            >
              <MicIcon recording={false} speaking={false} />
            </button>
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={isLoading || dictation.isTranscribing || !input.trim()}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
        </div>
        <p className={styles.composerHint}>
          Enter to send · Shift+Enter for a new line · Mic fills the box before you send
        </p>
      </form>
      </div>
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
  headerStart,
}: {
  displayName: string;
  company?: string | null;
  initialsText: string;
  handoffActive: boolean;
  staffJoined?: boolean;
  handoffMessage: string | null;
  headerStart?: ReactNode;
}) {
  return (
    <>
      <div className={styles.headerRow}>
        {headerStart}
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
  messagesEndRef,
  messages,
  displayName,
  showTyping,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  displayName: string;
  showTyping: boolean;
}) {
  return (
    <div ref={scrollRef} className={styles.messages} role="log" aria-live="polite">
      {messages.map((m) => (
        <ChatBubble key={m.id} message={m} assistantLabel={displayName} />
      ))}
      {showTyping ? <TypingIndicator label="Thinking…" /> : null}
      <div ref={messagesEndRef} className={styles.messagesEnd} aria-hidden />
    </div>
  );
}

function ChatBubble({
  message,
  assistantLabel,
}: {
  message: ChatMessage;
  assistantLabel: string;
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
          <p className={styles.bubbleLabel}>{label}</p>
          {message.at ? (
            <time className={styles.bubbleTime} dateTime={message.at}>
              {formatMessageTime(message.at)}
            </time>
          ) : null}
        </div>
      ) : null}
      <p className={styles.bubbleText}>{renderBoldMarkdown(message.content)}</p>
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

function MicIcon({
  recording,
  speaking,
}: {
  recording: boolean;
  speaking: boolean;
}) {
  if (speaking) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 9.5v5M12 7v10M16 9.5v5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (recording) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className={styles.typingRow} aria-label={label} aria-live="polite">
      <div className={styles.typing}>
        <span />
        <span />
        <span />
      </div>
      <span className={styles.typingLabel}>{label}</span>
    </div>
  );
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
      <p className={styles.quickLabel}>Quick actions</p>
      <div className={styles.quickBtnRow}>
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
    </div>
  );
}
