"use client";

import { HandHelping, Sparkles, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoLeadIntelligenceCard } from "@/components/demo/demo-lead-intelligence-card";
import { DemoLeadInfoPanel } from "@/components/demo/demo-lead-info-panel";
import { DemoObjectionTracker } from "@/components/demo/demo-objection-tracker";
import type { DemoQualificationProgress } from "@/lib/demo/types";

type LeadFields = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  industry?: string | null;
  service_interest?: string | null;
  budget?: string | null;
  timeline?: string | null;
  lead_category?: string | null;
  source?: string | null;
};

export function DemoLeftWorkspacePanel({
  presenterNode,
  presenterStatusChip,
  hidePrimaryPresenter,
  staffPresenterActive,
  staffPresenterName,
  joined,
  objections,
  qualificationProgress,
  leadScore,
  leadCategory,
  recommendedNextAction,
  lead,
  hasLead,
  name,
  email,
  phone,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onSaveLead,
  handoffBannerText,
  hotLeadHint,
  avatarControl,
  fallbackAgentCard,
}: {
  presenterNode: React.ReactNode;
  /** Compact status when the full presenter tile lives in the center stage. */
  presenterStatusChip?: React.ReactNode;
  hidePrimaryPresenter?: boolean;
  staffPresenterActive?: boolean;
  staffPresenterName?: string | null;
  joined?: boolean;
  objections?: string[];
  qualificationProgress?: DemoQualificationProgress | null;
  leadScore?: number | null;
  leadCategory?: string | null;
  recommendedNextAction?: string | null;
  lead: LeadFields | null;
  hasLead: boolean;
  name: string;
  email: string;
  phone: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onSaveLead: () => void;
  handoffBannerText?: string | null;
  hotLeadHint?: boolean;
  avatarControl?: React.ReactNode;
  fallbackAgentCard?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {(presenterStatusChip || (!hidePrimaryPresenter && presenterNode)) && (
        <PanelSection label="AI presenter">
          {presenterStatusChip ?? presenterNode}
        </PanelSection>
      )}

      {staffPresenterActive && (
        <Card className="border-violet-500/40 bg-violet-950/25">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30">
                <User className="h-6 w-6 text-violet-300" />
              </div>
              <div>
                <p className="font-semibold text-white">{staffPresenterName ?? "Team member"}</p>
                <p className="text-xs text-violet-200/80">Active presenter</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {avatarControl}
      {fallbackAgentCard}

      <PanelSection label="Lead intelligence">
        <Card className="border-slate-800/80 bg-slate-900/40 shadow-md shadow-black/10">
          <CardContent className="pt-4">
            <DemoLeadInfoPanel
              lead={lead}
              joined={Boolean(joined)}
              hasLead={hasLead}
              name={name}
              email={email}
              phone={phone}
              onNameChange={onNameChange}
              onEmailChange={onEmailChange}
              onPhoneChange={onPhoneChange}
              onSaveLead={onSaveLead}
            />
          </CardContent>
        </Card>
      </PanelSection>

      {joined && (
        <PanelSection label="Qualification score">
          <Card className="border-slate-800/80 bg-slate-900/40 shadow-md shadow-black/10">
            <CardContent className="pt-4">
              <DemoLeadIntelligenceCard
                progress={qualificationProgress}
                leadScore={leadScore}
                leadCategory={leadCategory}
              />
            </CardContent>
          </Card>
        </PanelSection>
      )}

      <PanelSection label="Objection tracker">
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardContent className="pt-4">
            <DemoObjectionTracker objections={objections} />
          </CardContent>
        </Card>
      </PanelSection>

      <PanelSection label="Recommended next action">
        <Card className="border-cyan-500/20 bg-cyan-950/15 min-h-[72px]">
          <CardContent className="pt-4">
            {recommendedNextAction ? (
              <p className="text-sm text-slate-200 leading-relaxed flex gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-cyan-400/80 mt-0.5" />
                <span>{recommendedNextAction}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">
                AI ready to begin — next steps will appear as the demo progresses.
              </p>
            )}
          </CardContent>
        </Card>
      </PanelSection>

      {hotLeadHint && (
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-100">
          Hot lead — booking recommended. Our team has been notified.
        </div>
      )}

      {handoffBannerText && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <HandHelping className="h-4 w-4 inline mr-2" />
          {handoffBannerText}
        </div>
      )}
    </div>
  );
}

function PanelSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-0.5">
        {label}
      </p>
      {children}
    </div>
  );
}
