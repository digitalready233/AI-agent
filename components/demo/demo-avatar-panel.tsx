"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AvatarSessionStatus } from "@/lib/avatar/types";
import { AVATAR_PROVIDER_LABELS, type AvatarProviderId } from "@/lib/avatar/types";

type Props = {
  provider?: string | null;
  status?: AvatarSessionStatus | string | null;
  streamUrl?: string | null;
  joinUrl?: string | null;
  conversationUrl?: string | null;
  error?: string | null;
  displayName?: string;
  compact?: boolean;
  staffView?: boolean;
  className?: string;
};

function resolveEmbedUrl(
  streamUrl?: string | null,
  joinUrl?: string | null,
  conversationUrl?: string | null
): string | null {
  const url = conversationUrl ?? streamUrl ?? joinUrl;
  if (!url?.trim()) return null;
  if (url.includes("<")) return null;
  return url;
}

function isDailyOrTavusUrl(url: string): boolean {
  return (
    url.includes("daily.co") ||
    url.includes("tavus") ||
    url.includes("conversation")
  );
}

export function DemoAvatarPanel({
  provider,
  status,
  streamUrl,
  joinUrl,
  conversationUrl,
  error,
  displayName = "AI presenter",
  compact,
  staffView,
  className,
}: Props) {
  const [loadError, setLoadError] = useState(false);
  const label =
    provider && provider in AVATAR_PROVIDER_LABELS
      ? AVATAR_PROVIDER_LABELS[provider as AvatarProviderId]
      : provider ?? "Avatar";

  const active = ["active", "speaking", "listening", "starting"].includes(status ?? "");
  const embedUrl = resolveEmbedUrl(streamUrl, joinUrl, conversationUrl);
  const useIframe = Boolean(embedUrl && isDailyOrTavusUrl(embedUrl));
  const showVideo = Boolean(embedUrl) && !loadError && active;

  return (
    <Card
      className={cn(
        "border-cyan-500/30 bg-slate-950/90 overflow-hidden",
        status === "failed" && "border-red-500/40",
        compact && "shadow-lg shadow-black/50",
        className
      )}
    >
      <CardContent className={cn("p-0", compact && "p-0")}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/80 bg-slate-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <Video className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="text-sm font-medium text-white truncate">{displayName}</span>
            {provider === "tavus" && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                Tavus CVI
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] capitalize shrink-0">
            {status?.replace(/_/g, " ") ?? "—"}
          </Badge>
        </div>

        <div
          className={cn(
            "relative bg-black flex items-center justify-center",
            compact ? "aspect-video min-h-[120px]" : "aspect-video min-h-[200px]"
          )}
        >
          {showVideo && embedUrl ? (
            useIframe ? (
              <iframe
                title="Tavus avatar conversation"
                src={embedUrl}
                className="w-full h-full border-0"
                allow="camera; microphone; autoplay; fullscreen; display-capture"
                onError={() => setLoadError(true)}
              />
            ) : (
              <video
                src={embedUrl}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                muted={!staffView}
                onError={() => setLoadError(true)}
              />
            )
          ) : status === "starting" ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-xs">Starting {label} avatar…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500 px-4 text-center">
              <Video className="h-10 w-10 opacity-40" />
              <p className="text-xs">{error || "Waiting for avatar stream…"}</p>
            </div>
          )}
        </div>

        {embedUrl && (loadError || !showVideo) && active && (
          <div className="px-3 py-2 border-t border-slate-800/80 flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="text-xs">
                  Open Tavus avatar demo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4">
                  <DialogTitle>{displayName} — Tavus conversation</DialogTitle>
                </DialogHeader>
                <iframe
                  title="Tavus avatar full"
                  src={embedUrl}
                  className="w-full aspect-video min-h-[360px] border-0"
                  allow="camera; microphone; autoplay; fullscreen"
                />
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" className="text-xs" asChild>
              <a href={embedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                New tab
              </a>
            </Button>
          </div>
        )}

        {staffView && (error || loadError) && (
          <div className="px-3 py-2 text-xs text-amber-200/90 bg-amber-950/30 border-t border-amber-500/20 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {loadError
                ? "Avatar embed blocked or failed. Use Open Tavus avatar demo or new tab."
                : error}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
