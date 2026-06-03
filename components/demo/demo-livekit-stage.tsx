"use client";

import {
  Bot,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  User,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { useDemoLivekitRoom } from "@/hooks/use-demo-livekit-room";

type LiveKitHook = ReturnType<typeof useDemoLivekitRoom>;

type Props = {
  livekit: LiveKitHook;
  agentName: string;
  demoStage?: string;
  demoPathTitle?: string | null;
  staffName?: string | null;
  staffMode?: boolean;
  onJoinRoom?: () => void;
  showJoinButton?: boolean;
  aiPhaseLabel?: string;
  aiAudioModeLabel?: string;
  aiSpeaking?: boolean;
  aiPaused?: boolean;
  aiStatus?: string;
  recordingControls?: React.ReactNode;
  aiPresenterSlot?: React.ReactNode;
};

function AiParticipantTile({
  agentName,
  demoPathTitle,
  demoStage,
  speaking,
  liveAudioInRoom,
}: {
  agentName: string;
  demoPathTitle?: string | null;
  demoStage?: string;
  speaking?: boolean;
  liveAudioInRoom?: boolean;
}) {
  return (
    <div
      className={`relative aspect-video rounded-xl border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-950/80 to-slate-900 flex flex-col items-center justify-center gap-2 overflow-hidden ${
        speaking ? "ring-2 ring-emerald-400/60" : ""
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/80">
        <Bot className="h-7 w-7 text-cyan-400" />
      </div>
      <div className="text-center px-2">
        <p className="text-sm font-medium text-white truncate max-w-[140px]">{agentName}</p>
        <p className="text-xs text-slate-500">
          {demoPathTitle ?? demoStage?.replace(/_/g, " ") ?? "AI guide"}
        </p>
      </div>
      {liveAudioInRoom && (
        <span className="absolute top-2 left-2 text-[10px] text-cyan-300 bg-black/50 px-1.5 py-0.5 rounded">
          Room audio
        </span>
      )}
      {speaking && (
        <span className="absolute top-2 right-2 flex items-center gap-1 text-xs text-emerald-400">
          <Radio className="h-3 w-3 animate-pulse" />
          Speaking
        </span>
      )}
    </div>
  );
}

export function DemoLiveKitStage({
  livekit,
  agentName,
  demoStage,
  demoPathTitle,
  staffName,
  staffMode,
  onJoinRoom,
  showJoinButton,
  aiPhaseLabel,
  aiAudioModeLabel,
  aiSpeaking,
  aiPaused,
  aiStatus,
  recordingControls,
  aiPresenterSlot,
}: Props) {
  const {
    status,
    error,
    connectionLabel,
    micEnabled,
    cameraEnabled,
    screenSharing,
    screenShareSupported,
    remoteScreenShareIdentity,
    screenVideoRef,
    activeSpeakerId,
    remoteTiles,
    localVideoRef,
    localVideoReady,
    setRemoteVideoRef,
    toggleScreenShare,
  } = livekit;

  const connected = status === "connected" || status === "reconnecting";
  const staffTile = remoteTiles.find(
    (t) => t.identity.startsWith("staff-") || t.name === staffName
  );
  const aiRemoteTile = remoteTiles.find((t) => t.identity.startsWith("ai-agent-"));
  const remoteProspectTiles = remoteTiles.filter(
    (t) => t !== staffTile && !t.identity.startsWith("ai-agent-")
  );

  return (
    <Card className="border-slate-800/80 bg-slate-900/50 overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-normal text-slate-400 flex items-center gap-2">
          {connected ? (
            <Wifi className="h-4 w-4 text-emerald-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-400" />
          )}
          Live video room
        </CardTitle>
        <div className="flex items-center gap-2">
          {aiStatus && aiStatus !== "not_started" && (
            <Badge
              variant="outline"
              className={`text-xs capitalize ${
                aiPaused ? "border-amber-500/50 text-amber-300" : "border-cyan-500/50 text-cyan-300"
              }`}
            >
              AI: {aiPhaseLabel ?? aiStatus}
            </Badge>
          )}
          {aiAudioModeLabel && (
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
              {aiAudioModeLabel}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs capitalize">
            {connectionLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-xs text-red-300 rounded-lg border border-red-500/30 bg-red-950/30 p-2">
            {error}
          </p>
        )}

        {!connected && showJoinButton && (
          <Button
            type="button"
            className="w-full bg-cyan-600 hover:bg-cyan-500"
            onClick={() => {
              onJoinRoom?.();
              void livekit.connect();
            }}
          >
            Join video room
          </Button>
        )}

        {(remoteScreenShareIdentity || (staffMode && screenSharing)) && (
          <div className="relative w-full aspect-video rounded-xl border-2 border-amber-500/50 bg-black overflow-hidden">
            <video
              ref={screenVideoRef}
              className="h-full w-full object-contain"
              autoPlay
              playsInline
            />
            <span className="absolute top-2 left-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded">
              {staffMode && screenSharing ? "You are sharing" : "Shared screen"}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div
            className={`relative aspect-video rounded-xl border-2 border-slate-700 bg-slate-900/80 overflow-hidden ${
              activeSpeakerId?.includes("prospect") || activeSpeakerId?.includes("staff")
                ? "ring-2 ring-emerald-400/60"
                : ""
            }`}
          >
            <video
              ref={localVideoRef}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {!localVideoReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <User className="h-7 w-7 text-slate-400" />
                <p className="text-sm text-white">You</p>
                <p className="text-xs text-slate-500">
                  {cameraEnabled ? "Starting camera…" : "Camera off"}
                </p>
              </div>
            )}
            <span className="absolute bottom-2 left-2 text-xs text-white/90 bg-black/50 px-2 py-0.5 rounded">
              You
            </span>
          </div>

          {aiPresenterSlot ? (
            <div className="aspect-video flex items-stretch">{aiPresenterSlot}</div>
          ) : (
            <AiParticipantTile
              agentName={`${agentName} AI Demo Agent`}
              demoPathTitle={demoPathTitle}
              demoStage={demoStage}
              liveAudioInRoom={Boolean(aiRemoteTile)}
              speaking={
                !aiPaused &&
                (aiSpeaking ??
                  aiRemoteTile?.isSpeaking ??
                  (!activeSpeakerId || activeSpeakerId.includes("ai-agent")))
              }
            />
          )}

          {staffTile && (
            <div
              className={`relative aspect-video rounded-xl border-2 border-violet-500/40 bg-slate-900 overflow-hidden ${
                staffTile.isSpeaking ? "ring-2 ring-emerald-400/60" : ""
              }`}
            >
              <video
                ref={(el) => setRemoteVideoRef(staffTile.identity, el)}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
              />
              <span className="absolute bottom-2 left-2 text-xs text-white/90 bg-black/50 px-2 py-0.5 rounded">
                {staffName ?? staffTile.name}
              </span>
            </div>
          )}

          {remoteProspectTiles.map((tile) => (
            <div
              key={tile.identity}
              className={`relative aspect-video rounded-xl border-2 border-slate-600 bg-slate-900 overflow-hidden ${
                tile.isSpeaking ? "ring-2 ring-emerald-400/60" : ""
              }`}
            >
              <video
                ref={(el) => setRemoteVideoRef(tile.identity, el)}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
              />
              <span className="absolute bottom-2 left-2 text-xs text-white/90 bg-black/50 px-2 py-0.5 rounded">
                {tile.name}
              </span>
            </div>
          ))}
        </div>

        {connected && (
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void livekit.toggleMic()}
            >
              {micEnabled ? (
                <Mic className="h-4 w-4 mr-1" />
              ) : (
                <MicOff className="h-4 w-4 mr-1" />
              )}
              {micEnabled ? "Mute" : "Unmute"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void livekit.toggleCamera()}
            >
              {cameraEnabled ? (
                <Video className="h-4 w-4 mr-1" />
              ) : (
                <VideoOff className="h-4 w-4 mr-1" />
              )}
              {cameraEnabled ? "Camera off" : "Camera on"}
            </Button>
            {staffMode && (
              <Button
                type="button"
                size="sm"
                variant={screenSharing ? "default" : "outline"}
                disabled={!screenShareSupported}
                title={
                  screenShareSupported
                    ? "Share browser tab, window, or screen"
                    : "Screen share unavailable"
                }
                onClick={() => void toggleScreenShare()}
              >
                <MonitorUp className="h-4 w-4 mr-1" />
                {screenSharing ? "Stop share" : "Share screen"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void livekit.disconnect()}
            >
              Leave room
            </Button>
          </div>
        )}

        {recordingControls}
        {!staffMode && remoteScreenShareIdentity && (
          <p className="text-[10px] text-slate-500 text-center">
            You can keep chatting and hear the presenter while viewing their screen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
