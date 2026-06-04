"use client";

import { ChevronLeft, ChevronRight, Monitor, Sparkles } from "lucide-react";
import { DemoSlideHero } from "@/components/demo/demo-slide-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlideBrandingMap } from "@/lib/demo/slide-branding";
import {
  demoProgressPercent,
  extractTalkingPoints,
  formatDemoStageLabel,
} from "@/lib/demo/demo-room-ui";
import type { useDemoLivekitRoom } from "@/hooks/use-demo-livekit-room";
import { cn } from "@/lib/utils";

type StageAsset = {
  id: string;
  title: string;
  content: string;
  asset_type: string;
};

type LiveKitHook = ReturnType<typeof useDemoLivekitRoom>;

type Props = {
  livekit?: LiveKitHook | null;
  useLiveKitVideo?: boolean;
  screenShareActive?: boolean;
  currentDemoStage?: string | null;
  demoPathTitle?: string | null;
  slideBranding?: SlideBrandingMap;
  companyName?: string | null;
  activeAsset: StageAsset | null;
  assets: StageAsset[];
  assetIndex: number;
  showBookingCta?: boolean;
  recommendedCta?: string | null;
  onOpenBooking?: () => void;
  staffMode?: boolean;
  onPrevAsset?: () => void;
  onNextAsset?: () => void;
  presenterNote?: string | null;
  floatingPresenter?: React.ReactNode;
  /** Primary presenter overlay on the slide card (non–screen-share). */
  slideOverlayPresenter?: React.ReactNode;
  children?: React.ReactNode;
};

export function DemoCenterStage({
  livekit,
  useLiveKitVideo,
  screenShareActive,
  currentDemoStage,
  demoPathTitle,
  slideBranding,
  companyName,
  activeAsset,
  assets,
  assetIndex,
  showBookingCta,
  recommendedCta,
  onOpenBooking,
  staffMode,
  onPrevAsset,
  onNextAsset,
  presenterNote,
  floatingPresenter,
  slideOverlayPresenter,
  children,
}: Props) {
  const remoteScreen =
    livekit?.remoteScreenShareIdentity ||
    (staffMode && livekit?.screenSharing) ||
    screenShareActive;

  const showScreenStage =
    useLiveKitVideo &&
    (livekit?.screenSharing ||
      livekit?.remoteScreenShareIdentity ||
      screenShareActive);

  const hasPath = Boolean(demoPathTitle?.trim());
  const stageLabel = formatDemoStageLabel(currentDemoStage);
  const progressPct = demoProgressPercent(currentDemoStage);
  const slideNum = assets.length > 0 ? assetIndex + 1 : 0;
  const slideTotal = assets.length;
  const nextAsset = assets[assetIndex + 1] ?? null;
  const talkingPoints = activeAsset
    ? extractTalkingPoints(activeAsset.content)
    : [];

  return (
    <div className="space-y-4">
      {showScreenStage && livekit && (
        <div className="relative w-full aspect-video rounded-xl border-2 border-amber-500/50 bg-black overflow-hidden shadow-xl">
          <video
            ref={livekit.screenVideoRef}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
          />
          <span className="absolute top-2 left-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded">
            {staffMode && livekit.screenSharing
              ? "You are sharing your screen"
              : remoteScreen
                ? "Shared screen"
                : "Shared screen"}
          </span>
          {floatingPresenter && (
            <div className="absolute bottom-3 right-3 z-10 w-[min(100%,240px)] max-w-[85vw]">
              {floatingPresenter}
            </div>
          )}
        </div>
      )}

      {!showScreenStage && (
        <Card className="border-slate-800/80 bg-slate-900/40 min-h-[400px] shadow-lg shadow-black/20 overflow-hidden relative">
          <div className="border-b border-slate-800/60 bg-slate-950/40 px-4 py-3 space-y-2">
            {hasPath ? (
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div>
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">
                    Selected path
                  </p>
                  <p className="text-violet-200 font-medium mt-0.5">{demoPathTitle}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">
                    Current asset
                  </p>
                  <p className="text-white font-medium mt-0.5">
                    {activeAsset?.title ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">Stage</p>
                  <p className="text-cyan-200/90 mt-0.5">{stageLabel}</p>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px]">
                      Demo progress
                    </p>
                    <p className="text-slate-200 font-mono mt-0.5">{progressPct}%</p>
                  </div>
                  {slideTotal > 0 && (
                    <Badge variant="outline" className="text-[10px] border-slate-700">
                      Slide {slideNum}/{slideTotal}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-2">
                Ask the prospect what they want to explore.
              </p>
            )}
            {hasPath && (
              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-600/80 to-violet-500/80 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>

          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Badge
                variant="outline"
                className="text-[10px] mb-2 border-cyan-500/30 text-cyan-200/90 capitalize"
              >
                {stageLabel}
              </Badge>
              <CardTitle className="text-xl sm:text-2xl text-white leading-tight">
                {activeAsset?.title ?? (hasPath ? "Presentation" : "Guided demo")}
              </CardTitle>
              {recommendedCta && hasPath && (
                <p className="text-xs text-cyan-300/80 mt-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  Recommended CTA: {recommendedCta}
                </p>
              )}
            </div>
            {assets.length > 1 && (
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-700"
                  disabled={assetIndex <= 0}
                  onClick={onPrevAsset}
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-700"
                  disabled={assetIndex >= assets.length - 1}
                  onClick={onNextAsset}
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-2 space-y-4">
            {activeAsset ? (
              <>
                {talkingPoints.length > 0 && (
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Key talking points
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-300">
                      {talkingPoints.map((pt, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-cyan-500/80 shrink-0">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <DemoSlideHero
                  pathTitle={demoPathTitle}
                  slideBranding={slideBranding}
                  assetTitle={activeAsset.title}
                  assetContent={activeAsset.content}
                  assetType={activeAsset.asset_type}
                  companyName={companyName}
                  slideIndex={assetIndex}
                  slideTotal={assets.length}
                />

                {presenterNote && (
                  <div className="rounded-lg border border-violet-500/25 bg-violet-950/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80 mb-1">
                      AI presenter note
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed">{presenterNote}</p>
                  </div>
                )}

                {nextAsset && (
                  <div className="rounded-lg border border-dashed border-slate-700/80 bg-slate-950/30 px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Up next
                      </p>
                      <p className="text-sm text-slate-300 truncate">{nextAsset.title}</p>
                    </div>
                    {!staffMode && onNextAsset && assetIndex < assets.length - 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-xs"
                        onClick={onNextAsset}
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : hasPath ? (
              <p className="text-slate-500 text-sm py-8 text-center">
                Demo slides appear as the conversation progresses.
              </p>
            ) : (
              <div className="py-12 text-center space-y-2">
                <Monitor className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  No demo path selected yet. Ask the prospect what they want to explore to
                  personalize the presentation.
                </p>
              </div>
            )}

            {showBookingCta && (
              <div
                className={cn(
                  "rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-4 text-center"
                )}
              >
                <p className="text-sm text-cyan-100">
                  {recommendedCta ?? "Book a strategy consultation"}
                </p>
                {onOpenBooking && (
                  <Button
                    size="sm"
                    className="mt-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                    onClick={onOpenBooking}
                  >
                    Book consultation
                  </Button>
                )}
              </div>
            )}
          </CardContent>
          {slideOverlayPresenter && (
            <div className="absolute bottom-3 right-3 z-10 w-[min(100%,260px)] max-w-[85vw] pointer-events-none">
              <div className="pointer-events-auto">{slideOverlayPresenter}</div>
            </div>
          )}
        </Card>
      )}

      {children}
    </div>
  );
}
