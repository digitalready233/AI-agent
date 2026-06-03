"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function defaultWelcome(welcomeMessage: string | null | undefined, agentName: string) {
  return (
    welcomeMessage?.trim() ||
    `Hi! I'm ${agentName}. Ask me anything about our products or services — I'll answer using the knowledge base linked to this agent.`
  );
}

export function AgentTestChat({
  agentId,
  agentName = "Agent",
  welcomeMessage,
}: {
  agentId: string;
  agentName?: string;
  welcomeMessage?: string | null;
}) {
  const welcome = defaultWelcome(welcomeMessage, agentName);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: welcome },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveTestConversation, setSaveTestConversation] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(`test_${agentId}_${Date.now()}`);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  function resetChat() {
    setMessages([{ id: "welcome", role: "assistant", content: welcome }]);
    setInput("");
    setConversationId(null);
    sessionIdRef.current = `test_${agentId}_${Date.now()}`;
    toast.message("Test chat cleared");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
    };

    const historyForApi = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/platform/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: text,
          history: historyForApi,
          saveTestConversation,
          conversationId: conversationId ?? undefined,
          sessionId: sessionIdRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Test failed");
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.reply as string,
        },
      ]);

      if (saveTestConversation && data.conversationId) {
        toast.success("Saved to test conversation");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800/60 bg-slate-950/50 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/50 px-4 py-3 bg-slate-900/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/25">
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200 truncate">{agentName}</p>
            <p className="text-[11px] text-slate-500">Test mode · KB-grounded responses</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-slate-400"
          onClick={resetChat}
          disabled={loading}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-[280px] max-h-[420px] flex-col gap-3 overflow-y-auto p-4 platform-scrollbar"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "ml-auto bg-cyan-600/90 text-white rounded-br-md"
                : "mr-auto bg-slate-800/80 text-slate-100 border border-slate-700/40 rounded-bl-md"
            )}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl bg-slate-800/60 px-4 py-2.5 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-slate-800/50 p-4 space-y-3 bg-slate-900/30">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={saveTestConversation}
            onChange={(e) => setSaveTestConversation(e.target.checked)}
            className="mt-0.5 rounded border-slate-600"
          />
          <span>
            Save test conversation
            <span className="block text-xs text-slate-500 mt-0.5">
              When enabled, messages are stored in Supabase under channel &quot;test&quot;.
            </span>
          </span>
        </label>

        {conversationId && saveTestConversation && (
          <p className="text-xs text-slate-500">
            Saved thread:{" "}
            <Link
              href={`/dashboard/conversations/${conversationId}`}
              className="text-cyan-400 hover:underline"
            >
              View conversation
            </Link>
          </p>
        )}

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Type a test message…"
            disabled={loading}
            className="min-h-[52px] resize-none rounded-xl border-slate-700/60 bg-slate-950/80"
          />
          <Button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="h-auto shrink-0 rounded-xl px-4"
            aria-label="Send test message"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
