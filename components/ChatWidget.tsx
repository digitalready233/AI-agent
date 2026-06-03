"use client";

import { useChat } from "@ai-sdk/react";
import type { Message } from "@ai-sdk/ui-utils";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { visitorToUiMessages } from "@/lib/chat/visitor-message-ui";
import { useVisitorHandoffSync } from "@/hooks/use-visitor-handoff-sync";
import type { VisitorChatMessage } from "@/lib/platform/visitor-chat";
import styles from "./ChatWidget.module.css";

function getMessageDisplayText(m: Message): string {
  if (m.content?.trim()) return m.content;
  const fromTextParts = m.parts
    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
  if (fromTextParts?.trim()) return fromTextParts;
  if (m.role === "assistant" && m.reasoning?.trim()) return m.reasoning;
  return m.content ?? "";
}

const SESSION_KEY = "digisales_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function clearWebsiteChatSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export type ChatWidgetVariant = "floating" | "embed" | "workspace" | "live";

export type AgentChatConfig = {
  name: string;
  welcomeMessage: string;
  companyProductName?: string | null;
};

type PanelMessage = {
  id: string;
  role: "user" | "assistant" | "staff" | "system";
  content: string;
  label?: string;
};

function aiMessagesToPanel(messages: Message[]): PanelMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role:
      m.role === "user"
        ? "user"
        : m.role === "system"
          ? "system"
          : "assistant",
    content: getMessageDisplayText(m),
  }));
}

function panelToAiMessages(messages: PanelMessage[]): Message[] {
  return messages.map((m) => ({
    id: m.id,
    role:
      m.role === "staff"
        ? "assistant"
        : m.role === "system"
          ? "system"
          : m.role,
    content: m.content,
  }));
}

type HistoryMessage = {
  id?: string;
  role: "user" | "assistant" | "staff" | "system";
  content: string;
  at?: string;
  label?: string;
};

function ChatPanelShell({
  variant,
  agentConfig,
  messages,
  isLoading,
  input,
  onInputChange,
  onSubmit,
  onQuickSend,
  handoffActive,
  staffJoined,
}: {
  variant: ChatWidgetVariant;
  agentConfig?: AgentChatConfig | null;
  messages: PanelMessage[];
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onQuickSend: (text: string) => void;
  handoffActive?: boolean;
  staffJoined?: boolean;
}) {
  const docked = variant === "embed" || variant === "workspace" || variant === "live";
  const [open, setOpen] = useState(docked);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const quickActions = [
    "I'd like to learn about your services",
    "Book a consultation",
    "I need support with my account",
    "Speak to a team member",
  ];

  const panelClass =
    variant === "workspace"
      ? styles.panelWorkspace
      : variant === "live"
        ? styles.panelLive
        : variant === "embed"
          ? styles.panelEmbedded
          : styles.panel;

  const displayName = agentConfig?.name ?? "DigiSales.ai";
  const subtitle =
    variant === "workspace"
      ? "Workspace · Live platform agent"
      : agentConfig?.companyProductName
        ? `${agentConfig.companyProductName} · AI assistant`
        : "AI Sales & Support · 24/7";

  const panel = (
    <div className={panelClass}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.logoMark} aria-hidden />
          {displayName}
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {handoffActive && (
          <p className={styles.handoffBanner} role="status">
            {staffJoined
              ? "A team member is in this chat. Messages appear here in real time."
              : "Waiting for a team member — you can keep messaging here."}
          </p>
        )}
        {variant === "floating" && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            ×
          </button>
        )}
      </header>

      <div ref={scrollRef} className={styles.messages}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? styles.bubbleUser
                : m.role === "staff"
                  ? styles.bubbleStaff
                  : m.role === "system"
                    ? styles.bubbleSystem
                    : styles.bubbleAssistant
            }
          >
            {m.role !== "system" ? (
              <p className={styles.bubbleRole}>
                {m.role === "user"
                  ? "You"
                  : m.role === "staff"
                    ? m.label ?? "Team member"
                    : displayName}
              </p>
            ) : null}
            <p className={styles.bubbleText}>{m.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className={styles.typing} aria-live="polite">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {!handoffActive ? (
        <div className={styles.quickRow}>
          {quickActions.map((text) => (
            <button
              key={text}
              type="button"
              className={styles.quickBtn}
              disabled={isLoading}
              onClick={() => onQuickSend(text)}
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(e);
        }}
      >
        <input
          className={styles.input}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={
            handoffActive
              ? "Message our team…"
              : variant === "workspace"
                ? "Message your agent…"
                : "Type your message…"
          }
          disabled={isLoading}
          autoComplete="off"
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );

  if (docked) return panel;

  return (
    <>
      {!open && (
        <button
          type="button"
          className={styles.launcher}
          onClick={() => setOpen(true)}
          aria-label="Open chat"
        >
          <span className={styles.launcherDot} />
          Chat with us
        </button>
      )}
      {open && panel}
    </>
  );
}

function LegacyChatPanel({
  sessionId,
  initialMessages,
  variant,
  agentRole,
}: {
  sessionId: string;
  initialMessages: Message[];
  variant: ChatWidgetVariant;
  agentRole: "unified" | "support" | "sales" | "appointment" | "crm";
}) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/chat",
      id: sessionId,
      body: { sessionId, channel: "website", role: agentRole },
      initialMessages,
    });

  return (
    <ChatPanelShell
      variant={variant}
      messages={aiMessagesToPanel(messages)}
      isLoading={isLoading}
      input={input}
      onInputChange={(v) =>
        handleInputChange({ target: { value: v } } as ChangeEvent<HTMLInputElement>)
      }
      onSubmit={handleSubmit}
      onQuickSend={(text) => append({ role: "user", content: text })}
    />
  );
}

function PlatformChatPanel({
  sessionId,
  agentId,
  agentConfig,
  initialMessages,
  initialHandoffActive,
  variant,
}: {
  sessionId: string;
  agentId: string;
  agentConfig: AgentChatConfig | null;
  initialMessages: PanelMessage[];
  initialHandoffActive?: boolean;
  variant: ChatWidgetVariant;
}) {
  const [messages, setMessages] = useState<PanelMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [handoffActive, setHandoffActive] = useState(Boolean(initialHandoffActive));
  const [staffJoined, setStaffJoined] = useState(false);

  const channel =
    variant === "workspace" ? "workspace" : variant === "embed" ? "embed" : "website";

  const applySyncMessages = useCallback((merged: VisitorChatMessage[]) => {
    const ui = visitorToUiMessages(merged);
    if (ui.length > 0) setMessages(ui);
  }, []);

  const handleHandoffEnded = useCallback(() => {
    setHandoffActive(false);
    setStaffJoined(false);
  }, []);

  const { refresh: refreshHandoff } = useVisitorHandoffSync({
    sessionId,
    agentId,
    enabled: handoffActive,
    localMessages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      at: "",
      label: m.label,
    })),
    onSync: (payload) => {
      setHandoffActive(payload.handoffActive);
      setStaffJoined(payload.staffJoined);
    },
    onMessages: applySyncMessages,
    onHandoffEnded: handleHandoffEnded,
  });

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: PanelMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/platform/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            agentId,
            message: trimmed,
            channel,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg =
            typeof data.error === "string"
              ? data.error
              : "Message failed. Please try again.";
          throw new Error(errMsg);
        }

        if (data.staffHandling) {
          setHandoffActive(true);
          if (data.staffJoined) setStaffJoined(true);
          if (data.messages?.length) {
            applySyncMessages(data.messages as VisitorChatMessage[]);
          } else {
            void refreshHandoff();
          }
          if (data.reply?.trim()) {
            setMessages((prev) => [
              ...prev,
              {
                id: `ack_${Date.now()}`,
                role: "system",
                content: data.reply.trim(),
              },
            ]);
          }
          return;
        }

        if (data.reply?.trim()) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: "assistant",
              content: data.reply.trim(),
            },
          ]);
        }
        if (data.handoffRequired || data.handoffActive) {
          setHandoffActive(true);
          void refreshHandoff();
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
                : "Sorry, something went wrong. Please try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [agentId, applySyncMessages, channel, isLoading, refreshHandoff, sessionId]
  );

  return (
    <ChatPanelShell
      variant={variant}
      agentConfig={agentConfig}
      messages={messages}
      isLoading={isLoading}
      input={input}
      handoffActive={handoffActive}
      staffJoined={staffJoined}
      onInputChange={setInput}
      onSubmit={() => void sendMessage(input)}
      onQuickSend={(text) => void sendMessage(text)}
    />
  );
}

export function ChatWidget({
  embedded = false,
  variant: variantProp,
  agentRole = "unified",
  platformAgentId,
}: {
  embedded?: boolean;
  variant?: ChatWidgetVariant;
  agentRole?: "unified" | "support" | "sales" | "appointment" | "crm";
  /** When set, chat uses Supabase + workflow (requires service role on server). */
  platformAgentId?: string;
}) {
  const variant: ChatWidgetVariant =
    variantProp ?? (embedded ? "embed" : "floating");

  // Live/embed/workspace use docked layout; floating keeps launcher UX

  const resolvedAgentId =
    platformAgentId?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    "";
  const usePlatform = Boolean(resolvedAgentId);

  const [sessionId, setSessionId] = useState("");
  const [ready, setReady] = useState(false);
  const [initialMessages, setInitialMessages] = useState<PanelMessage[]>([]);
  const [initialHandoffActive, setInitialHandoffActive] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentChatConfig | null>(null);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);

    if (usePlatform) {
      Promise.all([
        fetch(
          `/api/platform/chat/agent?agentId=${encodeURIComponent(resolvedAgentId)}`
        ).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `/api/platform/chat/history?sessionId=${encodeURIComponent(sid)}&agentId=${encodeURIComponent(resolvedAgentId)}`
        ).then((r) => (r.ok ? r.json() : { messages: [] })),
      ])
        .then(([agentPayload, history]) => {
          if (agentPayload?.name) {
            setAgentConfig({
              name: agentPayload.name,
              welcomeMessage: agentPayload.welcomeMessage,
              companyProductName: agentPayload.companyProductName,
            });
          }

          const stored = (history.messages ?? []) as HistoryMessage[];
          const welcome =
            agentPayload?.welcomeMessage ??
            history.welcomeMessage ??
            "Hello! I'm your AI assistant. How can I help you today?";

          if (history.handoffActive) {
            setInitialHandoffActive(true);
          }

          if (stored.length > 0) {
            setInitialMessages(
              stored.map((m, i) => ({
                id: m.id ?? `mem_${i}_${m.at ?? i}`,
                role:
                  m.role === "user" ||
                  m.role === "staff" ||
                  m.role === "system"
                    ? m.role
                    : "assistant",
                content: m.content,
                label: m.label,
              }))
            );
          } else {
            setInitialMessages([
              { id: "welcome", role: "assistant", content: welcome },
            ]);
          }
          setReady(true);
        })
        .catch(() => {
          setInitialMessages([
            {
              id: "welcome",
              role: "assistant",
              content: "Hello! How can I help you today?",
            },
          ]);
          setReady(true);
        });
      return;
    }

    Promise.all([
      fetch(`/api/chat/history?sessionId=${encodeURIComponent(sid)}`).then((r) =>
        r.ok ? r.json() : { messages: [] }
      ),
      fetch("/api/greeting?channel=website&variant=sales").then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([history, greeting]) => {
        const stored = (history.messages ?? []) as HistoryMessage[];
        if (stored.length > 0) {
          setInitialMessages(
            stored.map((m, i) => ({
              id: `mem_${i}_${m.at ?? i}`,
              role: m.role,
              content: m.content,
            }))
          );
        } else {
          const welcome =
            greeting?.message ??
            "Hello! I can help you find the right solution, answer questions, and connect you with our team. What would you like help with today?";
          setInitialMessages([
            { id: "welcome", role: "assistant", content: welcome },
          ]);
        }
        setReady(true);
      })
      .catch(() => {
        setInitialMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hello! I can help you find the right solution, answer questions, and connect you with our team. What would you like help with today?",
          },
        ]);
        setReady(true);
      });
  }, [resolvedAgentId, usePlatform]);

  if (!ready || !sessionId) {
    return (
      <div
        className={
          variant === "live" ? styles.panelLive : styles.panelEmbedded
        }
      >
        <p className={styles.subtitle} style={{ padding: "2rem" }}>
          Loading conversation…
        </p>
      </div>
    );
  }

  if (usePlatform) {
    return (
      <PlatformChatPanel
        sessionId={sessionId}
        agentId={resolvedAgentId}
        agentConfig={agentConfig}
        initialMessages={initialMessages}
        initialHandoffActive={initialHandoffActive}
        variant={variant}
      />
    );
  }

  return (
    <LegacyChatPanel
      sessionId={sessionId}
      initialMessages={panelToAiMessages(initialMessages)}
      variant={variant}
      agentRole={agentRole}
    />
  );
}
