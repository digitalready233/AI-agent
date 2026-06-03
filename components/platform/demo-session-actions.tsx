"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Bot,
  CheckCircle,
  ExternalLink,
  HandHelping,
  Sparkles,
  Square,
  UserCheck,
  XCircle,
} from "lucide-react";
import { handoffReasonLabel } from "@/lib/demo/demo-handoff";

type Props = {
  sessionId: string;
  status: string;
  handoffRequired: boolean;
  handoffStatus?: string | null;
  handoffReason?: string | null;
  aiPaused?: boolean;
  videoProvider?: string | null;
  livekitRoomStatus?: string | null;
  livekitConfigured?: boolean;
  aiJoined?: boolean;
  aiStatus?: string | null;
  aiParticipantIdentity?: string | null;
  aiLastResponseAt?: string | null;
  aiAudioMode?: string | null;
  aiAudioStatus?: string | null;
  aiAudioTrackPublished?: boolean;
  aiAudioError?: string | null;
  aiLastSpokenAt?: string | null;
  layout?: "row" | "stack";
  onUpdated?: () => void;
};

const endedStatuses = new Set(["completed", "cancelled", "missed"]);

export function DemoSessionActions({
  sessionId,
  status,
  handoffRequired,
  handoffStatus,
  handoffReason,
  aiPaused,
  videoProvider,
  livekitRoomStatus,
  livekitConfigured = false,
  aiJoined = false,
  aiStatus = "not_started",
  aiParticipantIdentity,
  aiLastResponseAt,
  aiAudioMode,
  aiAudioStatus,
  aiAudioTrackPublished,
  aiAudioError,
  aiLastSpokenAt,
  layout = "row",
  onUpdated,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const isEnded = endedStatuses.has(status);
  const isTakenOver = status === "human_taken_over" || aiPaused === true;
  const canHandoff = !isEnded && !handoffRequired;
  const canEnd = !isEnded;

  async function livekitAi(
    path: string,
    success: string,
    extraBody?: Record<string, unknown>
  ) {
    setBusy(path);
    try {
      const res = await fetch(`/api/demo/livekit/ai/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo_session_id: sessionId, ...extraBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI action failed");
      toast.success(success);
      onUpdated?.();
      router.refresh();
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI action failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(JSON.stringify(body));
    try {
      const res = await fetch(`/api/platform/demo/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast.success(success);
      onUpdated?.();
      router.refresh();
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const wrap = layout === "stack" ? "flex flex-col gap-2" : "flex flex-wrap gap-2";

  return (
    <div className="space-y-2">
      {livekitConfigured && aiJoined && (
        <p className="text-xs text-slate-500">
          Audio: {aiAudioMode?.replace(/_/g, " ") ?? "—"} · {aiAudioStatus ?? "—"} · track{" "}
          {aiAudioTrackPublished ? "on" : "off"}
          {aiLastSpokenAt
            ? ` · spoken ${new Date(aiLastSpokenAt).toLocaleTimeString()}`
            : ""}
          {aiAudioError ? ` · ${aiAudioError}` : ""}
        </p>
      )}
      {handoffRequired && !isEnded && (
        <p className="text-xs text-amber-200/90">
          Human closer needed
          {handoffReason ? ` · ${handoffReasonLabel(handoffReason)}` : ""}
          {handoffStatus ? ` · ${handoffStatus.replace(/_/g, " ")}` : ""}
        </p>
      )}
      <div className={wrap}>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/demo-room/${sessionId}`} target="_blank">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Open demo room
          </Link>
        </Button>
        {!isEnded && (
          <Button variant="default" size="sm" asChild>
            <Link href={`/demo-room/${sessionId}?staff=1`} target="_blank">
              Join live demo
            </Link>
          </Button>
        )}
        {!isEnded && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void patch({ join_live: true }, "Joined live demo")}
          >
            Join (in-app)
          </Button>
        )}
        {!isEnded && !isTakenOver && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-violet-500/40"
            disabled={busy !== null}
            onClick={() => void patch({ take_over: true }, "You took over this demo — AI paused")}
          >
            Take over
          </Button>
        )}
        {!isEnded && isTakenOver && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-emerald-500/40"
            disabled={busy !== null}
            onClick={() => void patch({ resume_ai: true }, "AI resumed — you can still assist")}
          >
            <Bot className="h-3.5 w-3.5 mr-1" />
            Return control to AI
          </Button>
        )}
        {canHandoff && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-500/40 text-amber-200"
            disabled={busy !== null}
            onClick={() =>
              void patch({ request_handoff: true }, "Human handoff requested — team notified")
            }
          >
            <HandHelping className="h-3.5 w-3.5 mr-1" />
            Request handoff
          </Button>
        )}
        {!isEnded && livekitConfigured && (
          <>
            {aiStatus !== "active" && aiStatus !== "starting" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-cyan-500/40"
                disabled={busy !== null}
                onClick={() => void livekitAi("start", "AI demo agent started")}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Start AI agent
              </Button>
            )}
            {(aiStatus === "active" || aiStatus === "starting" || aiJoined) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void livekitAi("stop", "AI demo agent stopped")}
              >
                <Square className="h-3.5 w-3.5 mr-1" />
                Stop AI agent
              </Button>
            )}
            {aiStatus === "active" && !aiPaused && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void livekitAi("pause", "AI paused")}
              >
                Pause AI
              </Button>
            )}
            {(aiStatus === "paused" || aiPaused) && aiJoined && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void livekitAi("resume", "AI resumed")}
              >
                <Bot className="h-3.5 w-3.5 mr-1" />
                Resume AI
              </Button>
            )}
            {aiJoined && aiAudioMode !== "livekit_track" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-cyan-500/40"
                disabled={busy !== null}
                onClick={() =>
                  void livekitAi("audio-mode", "Native LiveKit audio enabled", {
                    mode: "livekit_track",
                  })
                }
              >
                Start native AI audio
              </Button>
            )}
            {aiJoined && aiAudioMode !== "fallback_tts" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void livekitAi("audio-mode", "Switched to browser TTS fallback", {
                    mode: "fallback_tts",
                  })
                }
              >
                Switch to fallback TTS
              </Button>
            )}
            {aiJoined && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void livekitAi("restart", "AI worker restarted")}
              >
                Restart AI worker
              </Button>
            )}
            {aiJoined && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={async () => {
                  const data = await livekitAi("audio-logs", "Loaded AI audio logs");
                  if (data?.logs?.length) {
                    console.info("[AI audio logs]", data.logs);
                    toast.message(
                      `${data.logs.length} AI events · mode ${data.ai_audio_mode ?? aiAudioMode} · track ${data.ai_audio_track_published ? "published" : "no"}`
                    );
                  }
                }}
              >
                View AI audio logs
              </Button>
            )}
          </>
        )}
        {!isEnded && livekitConfigured && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("create-room");
              try {
                const res = await fetch("/api/demo/livekit/create-room", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ demo_session_id: sessionId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Failed");
                toast.success(
                  data.created ? "LiveKit room created" : "LiveKit room ready"
                );
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              } finally {
                setBusy(null);
              }
            }}
          >
            {livekitRoomStatus === "not_created" || !livekitRoomStatus
              ? "Create LiveKit room"
              : "Ensure LiveKit room"}
          </Button>
        )}
        {!isEnded &&
          livekitConfigured &&
          (videoProvider === "livekit" ||
            (livekitRoomStatus && livekitRoomStatus !== "not_created")) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("end-room");
              try {
                const res = await fetch("/api/demo/livekit/end-room", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ demo_session_id: sessionId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Failed");
                toast.success("LiveKit room ended");
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              } finally {
                setBusy(null);
              }
            }}
          >
            End LiveKit room
          </Button>
        )}
        {!isEnded && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/bookings">Create booking</Link>
          </Button>
        )}
        {!isEnded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void patch({ mark_qualified: true }, "Lead marked qualified")}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            Mark qualified
          </Button>
        )}
        {!isEnded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void patch({ mark_opportunity: true }, "Opportunity recorded")}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Mark opportunity
          </Button>
        )}
        {canEnd && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void patch({ end_demo: true }, "Demo ended — summary saved")}
            >
              <Square className="h-3.5 w-3.5 mr-1" />
              End demo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void patch(
                  { status: "completed", end_demo: true },
                  "Demo marked completed"
                )
              }
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Mark completed
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-400"
              disabled={busy !== null}
              onClick={() => void patch({ status: "cancelled" }, "Demo cancelled")}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
