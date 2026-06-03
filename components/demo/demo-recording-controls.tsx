"use client";

import { Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { useDemoRecording } from "@/hooks/use-demo-recording";

type Rec = ReturnType<typeof useDemoRecording>;

function formatTimer(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  recording: Rec;
};

export function DemoRecordingControls({ recording }: Props) {
  if (!recording.canControlRecording) return null;

  const { status, elapsedSec, providerConfigured, providerMessage, error, busy } =
    recording;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {status === "recording" && (
          <Badge variant="destructive" className="gap-1 animate-pulse">
            <Circle className="h-2 w-2 fill-current" />
            REC {formatTimer(elapsedSec)}
          </Badge>
        )}
        {status === "starting" && (
          <Badge variant="secondary">Starting recording…</Badge>
        )}
        {status === "stopped" && <Badge variant="outline">Recording saved</Badge>}
        {status === "failed" && <Badge variant="destructive">Recording failed</Badge>}
        {!providerConfigured && (
          <Badge variant="outline" className="text-amber-600 border-amber-600/40">
            Provider not configured
          </Badge>
        )}
      </div>
      {!providerConfigured && providerMessage && (
        <p className="text-[10px] text-muted-foreground text-center max-w-md">
          {providerMessage}
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        {(status === "idle" ||
          status === "consent_required" ||
          status === "stopped" ||
          status === "failed" ||
          status === "unavailable") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void recording.startRecording()}
          >
            <Circle className="h-3 w-3 mr-1 text-red-500 fill-red-500" />
            Start recording
          </Button>
        )}
        {(status === "recording" || status === "starting") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void recording.stopRecording()}
          >
            <Square className="h-3 w-3 mr-1" />
            Stop recording
          </Button>
        )}
      </div>
      {status === "recording" && !providerConfigured && (
        <p className="text-[10px] text-slate-500">
          Transcript and summary still save when recording egress is unavailable.
        </p>
      )}
    </div>
  );
}
