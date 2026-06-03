"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONVERSATION_STAGE_LABELS } from "@/lib/platform/sales-ops";
import type { WorkflowStage } from "@/lib/platform/workflow/schemas";
import type { Conversation, ConversationStatus, Message, Profile } from "@/lib/platform/types";

const POLL_MS = 12_000;

function statusLabel(status: ConversationStatus) {
  return status.replace(/_/g, " ");
}

export function StaffConversationInbox({
  conversation: initialConversation,
  initialMessages,
  team,
  currentProfileId,
  canManage,
}: {
  conversation: Conversation;
  initialMessages: Message[];
  team: Profile[];
  currentProfileId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const assigneeName =
    team.find((p) => p.id === conversation.assigned_to)?.full_name ?? null;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setPolling(true);
    try {
      const res = await fetch(`/api/platform/conversations/${conversation.id}/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      setMessages(data.messages ?? []);
      if (data.conversation) {
        setConversation((c) => ({ ...c, ...data.conversation }));
      }
    } catch (e) {
      if (!silent) {
        toast.error(e instanceof Error ? e.message : "Could not refresh");
      }
    } finally {
      setPolling(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function patchConversation(body: {
    status?: ConversationStatus;
    assigned_to?: string | null;
  }) {
    const res = await fetch(`/api/platform/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Update failed");
    setConversation(data.conversation);
    router.refresh();
    return data.conversation as Conversation;
  }

  async function takeOver() {
    setLoading("takeover");
    try {
      await patchConversation({
        status: "assigned",
        assigned_to: currentProfileId,
      });
      toast.success("You are now assigned to this conversation");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  async function markResolved() {
    setLoading("resolved");
    try {
      await patchConversation({ status: "resolved" });
      toast.success("Conversation marked resolved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  async function assignTo(profileId: string) {
    setLoading("assign");
    try {
      const assigned_to = profileId === "unassigned" ? null : profileId;
      await patchConversation({
        assigned_to,
        status: assigned_to ? "assigned" : conversation.status,
      });
      toast.success(assigned_to ? "Conversation assigned" : "Assignment cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setLoading(null);
    }
  }

  async function sendReply() {
    const text = reply.trim();
    if (!text) return;
    setLoading("reply");
    try {
      const res = await fetch(`/api/platform/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setMessages((prev) => [...prev, data.message]);
      setConversation(data.conversation);
      setReply("");
      toast.success("Reply sent");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-slate-800/60">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  conversation.status === "human_needed"
                    ? "warning"
                    : conversation.status === "resolved"
                      ? "success"
                      : "secondary"
                }
              >
                {statusLabel(conversation.status)}
              </Badge>
              {conversation.conversation_stage && (
                <Badge variant="outline">
                  {CONVERSATION_STAGE_LABELS[
                    conversation.conversation_stage as WorkflowStage
                  ] ?? conversation.conversation_stage}
                </Badge>
              )}
              {assigneeName && (
                <span className="text-xs text-slate-500">Assigned to {assigneeName}</span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Auto-refreshes every {POLL_MS / 1000}s · Last updated{" "}
              {new Date(conversation.updated_at).toLocaleString()}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                disabled={polling}
                onClick={() => void refresh(false)}
              >
                <RefreshCw className={`h-4 w-4 ${polling ? "animate-spin" : ""}`} />
              </Button>
              <Select
                value={conversation.assigned_to ?? "unassigned"}
                onValueChange={(v) => void assignTo(v)}
                disabled={loading !== null}
              >
                <SelectTrigger className="w-[180px] h-9 rounded-lg">
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {team.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={
                  loading !== null ||
                  conversation.assigned_to === currentProfileId
                }
                onClick={() => void takeOver()}
              >
                {loading === "takeover" ? "…" : "Take over"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-lg"
                disabled={loading !== null || conversation.status === "resolved"}
                onClick={() => void markResolved()}
              >
                {loading === "resolved" ? "…" : "Mark resolved"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {conversation.summary && (
        <Card className="border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-300 space-y-2">
            <p>{conversation.summary}</p>
            {conversation.recommended_next_action && (
              <p className="text-cyan-400/90 text-xs">
                Next: {conversation.recommended_next_action}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
          <CardTitle className="text-base">Transcript</CardTitle>
          <span className="text-xs text-slate-500">{messages.length} messages</span>
        </CardHeader>
        <CardContent
          ref={scrollRef}
          className="space-y-4 max-h-[28rem] overflow-y-auto pr-1 platform-scrollbar"
        >
          {messages.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  m.sender_type === "user"
                    ? "bg-slate-800/60 ml-0 mr-12 ring-1 ring-slate-700/50"
                    : m.sender_type === "staff"
                      ? "bg-amber-500/10 border border-amber-500/25 ml-12 mr-0"
                      : "bg-gradient-to-br from-cyan-500/10 to-indigo-500/5 border border-cyan-500/20 ml-12 mr-0"
                }`}
              >
                <p className="text-xs text-slate-500 mb-1 capitalize">
                  {m.sender_name ?? m.sender_type}
                  {m.created_at && (
                    <span className="ml-2 opacity-70">
                      {new Date(m.created_at).toLocaleTimeString()}
                    </span>
                  )}
                </p>
                <p className="text-slate-200 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Staff reply</CardTitle>
            <p className="text-xs text-slate-500">
              Your message is saved to this thread. The customer sees it when they return to
              chat (website channel).
            </p>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply to the customer…"
              rows={3}
              disabled={loading === "reply"}
              className="resize-none rounded-xl border-slate-700/60 bg-slate-950/80"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
            />
            <Button
              type="button"
              className="h-auto shrink-0 rounded-xl px-4"
              disabled={loading === "reply" || !reply.trim()}
              onClick={() => void sendReply()}
            >
              {loading === "reply" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
