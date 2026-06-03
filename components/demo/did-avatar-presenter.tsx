"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Loader2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DidAvatarPresenterHandle = {
  speak: (text: string) => Promise<void>;
  disconnect: () => Promise<void>;
};

type Props = {
  agentId: string;
  clientKey: string;
  demoSessionId: string;
  displayName?: string;
  status?: string | null;
  compact?: boolean;
  staffView?: boolean;
  className?: string;
  onConnected?: (info: { streamId?: string; chatId?: string }) => void;
  onError?: (message: string) => void;
  onFallback?: (reason: string) => void;
};

export const DidAvatarPresenter = forwardRef<DidAvatarPresenterHandle, Props>(
  function DidAvatarPresenter(
    {
      agentId,
      clientKey,
      demoSessionId,
      displayName = "AI presenter",
      status,
      compact,
      staffView,
      className,
      onConnected,
      onError,
      onFallback,
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const agentRef = useRef<{
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      speak: (text: string) => Promise<unknown>;
      chat: (text: string) => Promise<unknown>;
    } | null>(null);
    const connectedReportedRef = useRef(false);
    const [connectionState, setConnectionState] = useState<
      "idle" | "loading_sdk" | "connecting" | "connected" | "error" | "no_sdk"
    >("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const reportConnected = useCallback(
      async (streamId?: string, chatId?: string) => {
        if (connectedReportedRef.current) return;
        connectedReportedRef.current = true;
        try {
          await fetch(`/api/demo-room/${demoSessionId}/avatar/did-connected`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stream_id: streamId, chat_id: chatId }),
          });
        } catch {
          /* non-fatal */
        }
        onConnected?.({ streamId, chatId });
      },
      [demoSessionId, onConnected]
    );

    const initSdk = useCallback(async () => {
      if (!agentId || !clientKey) {
        setConnectionState("error");
        setErrorMessage("D-ID agent or client key missing.");
        onError?.("D-ID configuration incomplete");
        return;
      }

      setConnectionState("loading_sdk");
      try {
        const { createAgentManager } = await import("@d-id/client-sdk");
        setConnectionState("connecting");

        const manager = await createAgentManager(agentId, {
          auth: { type: "key", clientKey },
          callbacks: {
            onSrcObjectReady: (stream: MediaStream) => {
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
                void videoRef.current.play().catch(() => undefined);
              }
              setConnectionState("connected");
              void reportConnected();
            },
            onConnectionStateChange: (state: string) => {
              if (state === "connected") {
                setConnectionState("connected");
              }
              if (state === "disconnected" || state === "closed") {
                setConnectionState("idle");
              }
            },
            onStreamCreated: (stream: {
              stream_id?: string;
              session_id?: string;
            }) => {
              void reportConnected(stream.stream_id, stream.session_id);
            },
            onError: (err: Error) => {
              const msg = err?.message ?? "D-ID connection error";
              setConnectionState("error");
              setErrorMessage(msg);
              onError?.(msg);
            },
          },
          streamOptions: { fluent: true, streamWarmup: true },
        });

        agentRef.current = manager;
        await manager.connect();
      } catch (e) {
        const msg =
          e instanceof Error && e.message.includes("Cannot find module")
            ? "D-ID SDK not installed. Run: npm install @d-id/client-sdk"
            : e instanceof Error
              ? e.message
              : "D-ID SDK failed to load";
        setConnectionState(msg.includes("not installed") ? "no_sdk" : "error");
        setErrorMessage(msg);
        onError?.(msg);
        onFallback?.(msg);
      }
    }, [agentId, clientKey, onError, onFallback, reportConnected]);

    useEffect(() => {
      connectedReportedRef.current = false;
      void initSdk();
      return () => {
        void agentRef.current?.disconnect().catch(() => undefined);
        agentRef.current = null;
      };
    }, [initSdk]);

    useImperativeHandle(ref, () => ({
      speak: async (text: string) => {
        if (!agentRef.current) return;
        try {
          await agentRef.current.speak(text);
        } catch {
          try {
            await agentRef.current.chat(text);
          } catch {
            /* server route may still deliver speech */
          }
        }
      },
      disconnect: async () => {
        await agentRef.current?.disconnect().catch(() => undefined);
        agentRef.current = null;
      },
    }));

    const showVideo = connectionState === "connected";

    return (
      <Card
        className={cn(
          "border-violet-500/30 bg-slate-950/90 overflow-hidden",
          connectionState === "error" && "border-red-500/40",
          compact && "shadow-lg shadow-black/50",
          className
        )}
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/80 bg-slate-900/80">
            <div className="flex items-center gap-2 min-w-0">
              <Video className="h-4 w-4 text-violet-400 shrink-0" />
              <span className="text-sm font-medium text-white truncate">{displayName}</span>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                D-ID Agents
              </Badge>
            </div>
            <Badge variant="outline" className="text-[10px] capitalize shrink-0">
              {(status ?? connectionState).replace(/_/g, " ")}
            </Badge>
          </div>

          <div
            className={cn(
              "relative bg-black flex items-center justify-center",
              compact ? "aspect-video min-h-[120px]" : "aspect-video min-h-[200px]"
            )}
          >
            <video
              ref={videoRef}
              className={cn(
                "w-full h-full object-contain",
                !showVideo && "hidden"
              )}
              autoPlay
              playsInline
              muted={!staffView}
            />
            {!showVideo && (
              <div className="flex flex-col items-center gap-2 text-slate-400 px-4 text-center">
                {connectionState === "loading_sdk" ||
                connectionState === "connecting" ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                    <p className="text-xs">Connecting D-ID avatar…</p>
                  </>
                ) : connectionState === "no_sdk" ? (
                  <>
                    <AlertTriangle className="h-8 w-8 text-amber-400" />
                    <p className="text-xs text-amber-200/90">{errorMessage}</p>
                  </>
                ) : (
                  <>
                    <Video className="h-10 w-10 opacity-40" />
                    <p className="text-xs">{errorMessage ?? "Waiting for D-ID stream…"}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {staffView && errorMessage && (
            <div className="px-3 py-2 text-xs text-amber-200/90 bg-amber-950/30 border-t border-amber-500/20 flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
