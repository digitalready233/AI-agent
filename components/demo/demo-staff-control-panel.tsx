"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  HandHelping,
  Loader2,
  MonitorUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDemoPresentationControl } from "@/hooks/use-demo-presentation-control";
import type { PresentationControlMode } from "@/lib/demo/types";

type DemoPathOption = { id: string; title: string };
type DemoAssetOption = { id: string; title: string };

type Props = {
  sessionId: string;
  agentId?: string | null;
  controlMode?: PresentationControlMode | string;
  aiPaused?: boolean;
  screenShareActive?: boolean;
  presenterType?: string | null;
  leadScore?: number | null;
  leadCategory?: string | null;
  objections?: string[];
  recommendedNextAction?: string | null;
  demoPathId?: string | null;
  currentAssetId?: string | null;
  assets: DemoAssetOption[];
  pendingAiAction?: Record<string, unknown> | null;
  onSessionUpdated?: () => void;
  onEndDemo?: () => void;
  onMarkQualified?: () => void;
  onMarkOpportunity?: () => void;
  livekitScreenSharing?: boolean;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
};

const MODE_LABELS: Record<PresentationControlMode, string> = {
  ai_controlled: "AI controlled",
  staff_controlled: "Staff controlled",
  shared_control: "Shared control",
};

export function DemoStaffControlPanel({
  sessionId,
  agentId,
  controlMode = "ai_controlled",
  aiPaused,
  screenShareActive,
  presenterType,
  leadScore,
  leadCategory,
  objections = [],
  recommendedNextAction,
  demoPathId,
  currentAssetId,
  assets,
  pendingAiAction,
  onSessionUpdated,
  onEndDemo,
  onMarkQualified,
  onMarkOpportunity,
  livekitScreenSharing,
  onStartScreenShare,
  onStopScreenShare,
}: Props) {
  const ctrl = useDemoPresentationControl(sessionId);
  const [paths, setPaths] = useState<DemoPathOption[]>([]);

  useEffect(() => {
    if (!agentId) return;
    void fetch(`/api/platform/demo/paths?agent_id=${encodeURIComponent(agentId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.paths)) {
          setPaths(
            d.paths.map((p: { id: string; title: string }) => ({
              id: p.id,
              title: p.title,
            }))
          );
        }
      })
      .catch(() => {});
  }, [agentId]);

  async function afterCommand(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      toast.success(success);
      onSessionUpdated?.();
    } catch {
      /* toast via hook */
    }
  }

  const mode = (controlMode as PresentationControlMode) || "ai_controlled";
  const sharing = livekitScreenSharing || screenShareActive;

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-950/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs border-violet-500/40">
          {MODE_LABELS[mode] ?? mode}
        </Badge>
        <Badge variant="outline" className="text-xs capitalize">
          Presenter: {presenterType ?? (aiPaused ? "staff" : "ai")}
        </Badge>
        {leadCategory && (
          <Badge variant="outline" className="text-xs">
            {leadCategory}
            {leadScore != null ? ` · ${leadScore}` : ""}
          </Badge>
        )}
      </div>

      {recommendedNextAction && (
        <p className="text-xs text-violet-200/90">{recommendedNextAction}</p>
      )}

      {objections.length > 0 && (
        <p className="text-[10px] text-slate-500">
          Objections: {objections.slice(0, 4).join(", ")}
        </p>
      )}

      <Select
        value={mode}
        onValueChange={(v) =>
          void afterCommand(
            () => ctrl.setControlMode(v as PresentationControlMode),
            "Control mode updated"
          )
        }
        disabled={ctrl.busy}
      >
        <SelectTrigger className="h-8 text-xs bg-slate-950/80 border-violet-700/50">
          <SelectValue placeholder="Control mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ai_controlled">AI controlled</SelectItem>
          <SelectItem value="staff_controlled">Staff controlled</SelectItem>
          <SelectItem value="shared_control">Shared control</SelectItem>
        </SelectContent>
      </Select>

      {paths.length > 0 && (
        <Select
          value={demoPathId ?? ""}
          onValueChange={(v) =>
            void afterCommand(() => ctrl.selectPath(v), "Demo path updated")
          }
          disabled={ctrl.busy}
        >
          <SelectTrigger className="h-8 text-xs bg-slate-950/80 border-violet-700/50">
            <SelectValue placeholder="Demo path" />
          </SelectTrigger>
          <SelectContent>
            {paths.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {assets.length > 0 && (
        <Select
          value={currentAssetId ?? ""}
          onValueChange={(v) =>
            void afterCommand(() => ctrl.selectAsset(v), "Slide updated")
          }
          disabled={ctrl.busy}
        >
          <SelectTrigger className="h-8 text-xs bg-slate-950/80 border-violet-700/50">
            <SelectValue placeholder="Demo slide" />
          </SelectTrigger>
          <SelectContent>
            {assets.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {pendingAiAction && mode === "shared_control" && (
        <div className="rounded border border-cyan-500/30 bg-cyan-950/30 p-2 text-xs text-cyan-100">
          <p className="flex items-center gap-1 font-medium">
            <Sparkles className="h-3 w-3" />
            AI recommends: {(pendingAiAction as { type?: string }).type}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2 h-7 text-xs w-full"
            disabled={ctrl.busy}
            onClick={() =>
              void afterCommand(() => ctrl.applyPendingAi(), "AI suggestion applied")
            }
          >
            Apply suggestion
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={ctrl.busy}
          onClick={() =>
            void afterCommand(
              () => ctrl.previousAsset(demoPathId ?? undefined),
              "Previous slide"
            )
          }
        >
          <ChevronLeft className="h-3 w-3 mr-0.5" />
          Prev
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={ctrl.busy}
          onClick={() =>
            void afterCommand(() => ctrl.nextAsset(demoPathId ?? undefined), "Next slide")
          }
        >
          Next
          <ChevronRight className="h-3 w-3 ml-0.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={ctrl.busy}
          onClick={() => void afterCommand(() => ctrl.showBookingCta(), "Booking CTA shown")}
        >
          <Calendar className="h-3 w-3 mr-0.5" />
          Show booking
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {!aiPaused ? (
          <>
            <Button
              type="button"
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 text-xs"
              disabled={ctrl.busy}
              onClick={() => void afterCommand(() => ctrl.takeOver(), "You took over")}
            >
              <HandHelping className="h-3 w-3 mr-0.5" />
              Take over
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={ctrl.busy}
              onClick={() => void afterCommand(() => ctrl.pauseAi(), "AI paused")}
            >
              <Bot className="h-3 w-3 mr-0.5" />
              Pause AI
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-emerald-500/40 text-xs"
            disabled={ctrl.busy}
            onClick={() =>
              void afterCommand(() => ctrl.returnToAi("ai_controlled"), "AI resumed")
            }
          >
            Return control to AI
          </Button>
        )}
        {sharing ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="text-xs"
            disabled={ctrl.busy}
            onClick={() => onStopScreenShare?.()}
          >
            <MonitorUp className="h-3 w-3 mr-0.5" />
            Stop share
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={ctrl.busy}
            onClick={() => onStartScreenShare?.()}
          >
            <MonitorUp className="h-3 w-3 mr-0.5" />
            Share screen
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-violet-800/40">
        {onMarkQualified && (
          <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={onMarkQualified}>
            Mark qualified
          </Button>
        )}
        {onMarkOpportunity && (
          <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={onMarkOpportunity}>
            Mark opportunity
          </Button>
        )}
        {onEndDemo && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="text-xs ml-auto"
            onClick={onEndDemo}
          >
            End demo
          </Button>
        )}
      </div>

      {ctrl.busy && (
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </p>
      )}
      {ctrl.error && (
        <p className="text-[10px] text-red-300">{ctrl.error}</p>
      )}
    </div>
  );
}
