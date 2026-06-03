"use client";

import {
  Bot,
  Calendar,
  HandHelping,
  Sparkles,
  Target,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DemoStaffControlBar({
  aiPaused,
  busy,
  controlMode,
  className,
  onTakeOver,
  onPauseAi,
  onResumeAi,
  onShowBookingCta,
  onMarkQualified,
  onMarkOpportunity,
  onCreateFollowUp,
  onEndDemo,
}: {
  aiPaused?: boolean;
  busy?: boolean;
  controlMode?: string | null;
  className?: string;
  onTakeOver: () => void;
  onPauseAi: () => void;
  onResumeAi: () => void;
  onShowBookingCta: () => void;
  onMarkQualified: () => void;
  onMarkOpportunity: () => void;
  onCreateFollowUp: () => void;
  onEndDemo: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-violet-500/25 bg-violet-950/25 px-3 py-2.5",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
          Demo control
        </p>
        {controlMode && (
          <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-200">
            {controlMode.replace(/_/g, " ")}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-8 bg-violet-600 hover:bg-violet-500 text-xs"
          disabled={busy || aiPaused}
          onClick={onTakeOver}
        >
          <HandHelping className="h-3.5 w-3.5 mr-1" />
          Take over
        </Button>
        {!aiPaused ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-700"
            disabled={busy}
            onClick={onPauseAi}
          >
            <Bot className="h-3.5 w-3.5 mr-1" />
            Pause AI
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs border-emerald-500/40"
            disabled={busy}
            onClick={onResumeAi}
          >
            Resume AI
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={onShowBookingCta}
        >
          <Calendar className="h-3.5 w-3.5 mr-1" />
          Booking CTA
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={onMarkQualified}
        >
          <UserCheck className="h-3.5 w-3.5 mr-1" />
          Qualified
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={onMarkOpportunity}
        >
          <Target className="h-3.5 w-3.5 mr-1" />
          Opportunity
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={onCreateFollowUp}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Follow-up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="h-8 text-xs"
          disabled={busy}
          onClick={onEndDemo}
        >
          End demo
        </Button>
      </div>
    </div>
  );
}
