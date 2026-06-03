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
import { cn } from "@/lib/utils";

export function DemoBottomControlBar({
  staffMode,
  ended,
  handoffLoading,
  handoffRequired,
  ending,
  bookingRecommended,
  aiPaused,
  busy,
  onRequestHuman,
  onBook,
  onEnd,
  onTakeOver,
  onPauseAi,
  onResumeAi,
  onShowBookingCta,
  onMarkQualified,
  onMarkOpportunity,
  onCreateFollowUp,
}: {
  staffMode: boolean;
  ended?: boolean;
  handoffLoading?: boolean;
  handoffRequired?: boolean;
  ending?: boolean;
  bookingRecommended?: boolean;
  aiPaused?: boolean;
  busy?: boolean;
  onRequestHuman: () => void;
  onBook: () => void;
  onEnd: () => void;
  onTakeOver?: () => void;
  onPauseAi?: () => void;
  onResumeAi?: () => void;
  onShowBookingCta?: () => void;
  onMarkQualified?: () => void;
  onMarkOpportunity?: () => void;
  onCreateFollowUp?: () => void;
}) {
  if (ended) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 rounded-xl border shadow-lg backdrop-blur-md",
        staffMode
          ? "border-violet-500/25 bg-slate-950/95"
          : "border-slate-800/80 bg-slate-950/95"
      )}
    >
      <div className="px-3 py-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 text-center">
          {staffMode ? "Staff controls" : "Your actions"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {staffMode ? (
            <>
              <Button
                type="button"
                size="sm"
                className="bg-violet-600 hover:bg-violet-500"
                disabled={busy || aiPaused}
                onClick={onTakeOver}
              >
                <HandHelping className="h-4 w-4 mr-1" />
                Take Over
              </Button>
              {!aiPaused ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={onPauseAi}
                >
                  <Bot className="h-4 w-4 mr-1" />
                  Pause AI
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/40"
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
                disabled={busy}
                onClick={onShowBookingCta}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Show Booking CTA
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onMarkQualified}
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Mark Qualified
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onMarkOpportunity}
              >
                <Target className="h-4 w-4 mr-1" />
                Create Opportunity
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onCreateFollowUp}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Create Follow-Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={ending}
                onClick={onEnd}
              >
                End Demo
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRequestHuman}
                disabled={handoffLoading || handoffRequired}
              >
                <HandHelping className="h-4 w-4 mr-1" />
                Request Human
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onBook}
                disabled={!bookingRecommended}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Book Consultation
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onEnd}
                disabled={ending}
              >
                {ending ? "Ending…" : "End Demo"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
