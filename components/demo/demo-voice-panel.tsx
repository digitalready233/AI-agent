"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DemoVoiceStatus } from "@/hooks/use-demo-voice";
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RefreshCw,
  Square,
  Volume2,
} from "lucide-react";

const STATUS_LABEL: Record<DemoVoiceStatus, string> = {
  idle: "Ready",
  connecting: "Connecting…",
  listening: "Listening",
  processing: "Processing",
  ai_speaking: "AI speaking",
  error: "Error",
  disconnected: "Off",
};

const STATUS_VARIANT: Record<
  DemoVoiceStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  idle: "secondary",
  connecting: "outline",
  listening: "default",
  processing: "outline",
  ai_speaking: "secondary",
  error: "destructive",
  disconnected: "outline",
};

export function DemoVoicePanel(props: {
  status: DemoVoiceStatus;
  error: string | null;
  muted: boolean;
  voiceDemoActive: boolean;
  useBrowserStt: boolean;
  disabled?: boolean;
  onStartVoiceDemo: () => void;
  onStopVoiceDemo: () => void;
  onSpeakNow: () => void;
  onFinishSpeaking: () => void;
  onToggleMute: () => void;
  onReconnect: () => void;
}) {
  const busy =
    props.status === "connecting" ||
    props.status === "processing" ||
    props.status === "ai_speaking";

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-cyan-950/30 p-4 shadow-lg shadow-cyan-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">Voice demo</span>
        </div>
        <Badge variant={STATUS_VARIANT[props.status]} className="gap-1.5">
          {(props.status === "connecting" ||
            props.status === "listening" ||
            props.status === "processing" ||
            props.status === "ai_speaking") && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {props.status === "listening" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
          )}
          {STATUS_LABEL[props.status]}
        </Badge>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        {props.voiceDemoActive
          ? props.useBrowserStt
            ? "Using browser speech recognition. Tap Speak, then talk."
            : "Tap Speak to record. We transcribe securely on the server, then the AI responds by voice."
          : "Start voice demo to use your microphone. You can still type in the chat anytime."}
      </p>

      <div className="flex flex-wrap gap-2">
        {!props.voiceDemoActive ? (
          <Button
            type="button"
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500"
            onClick={() => void props.onStartVoiceDemo()}
            disabled={props.disabled || busy}
          >
            <Mic className="h-4 w-4 mr-1.5" />
            Start voice demo
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant={props.status === "listening" ? "default" : "outline"}
              className={
                props.status === "listening"
                  ? "bg-cyan-600 hover:bg-cyan-500 border-cyan-500"
                  : "border-slate-600"
              }
              onClick={() =>
                props.status === "listening"
                  ? props.onFinishSpeaking()
                  : void props.onSpeakNow()
              }
              disabled={props.disabled || busy}
            >
              {props.status === "listening" ? (
                <>
                  <Square className="h-4 w-4 mr-1.5" />
                  Done speaking
                </>
              ) : (
                <>
                  <Radio className="h-4 w-4 mr-1.5" />
                  Speak now
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600"
              onClick={props.onStopVoiceDemo}
              disabled={busy}
            >
              <PhoneOff className="h-4 w-4 mr-1.5" />
              Stop voice demo
            </Button>
          </>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-600"
          onClick={props.onToggleMute}
          disabled={!props.voiceDemoActive}
        >
          {props.muted ? (
            <MicOff className="h-4 w-4 mr-1.5" />
          ) : (
            <Mic className="h-4 w-4 mr-1.5" />
          )}
          {props.muted ? "Unmute AI" : "Mute AI"}
        </Button>

        {props.status === "error" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-slate-600"
            onClick={props.onReconnect}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Reconnect
          </Button>
        )}
      </div>

      {props.error && (
        <div className="mt-3 flex gap-2 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{props.error}</p>
        </div>
      )}
    </div>
  );
}
