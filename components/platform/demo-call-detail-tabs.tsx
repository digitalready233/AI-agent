"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoAiTeamAnalysis } from "@/components/platform/demo-ai-team-analysis";

export function DemoCallDetailTabs({
  sessionId,
  multiAgentEnabled,
  demoStatus,
  lastTurn,
  children,
}: {
  sessionId: string;
  multiAgentEnabled?: boolean;
  demoStatus: string;
  lastTurn?: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState("overview");
  const liveDemo = demoStatus === "in_progress" || demoStatus === "waiting";

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="bg-slate-900/60 border border-slate-800">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="multi-agent" className="gap-1.5">
          Multi-agent team
          {multiAgentEnabled && liveDemo && (
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-6 mt-0">
        {children}
      </TabsContent>
      <TabsContent value="multi-agent" className="mt-0">
        <p className="text-xs text-muted-foreground mb-4">
          Internal outputs from qualification, objection, booking, handoff, CRM, and
          follow-up agents. Not shown to prospects.
          {liveDemo && tab === "multi-agent" && (
            <> Updates every 5s while the demo is live.</>
          )}
        </p>
        <DemoAiTeamAnalysis
          sessionId={sessionId}
          multiAgentEnabled={multiAgentEnabled}
          lastTurn={lastTurn}
          pollIntervalMs={tab === "multi-agent" && liveDemo ? 5000 : undefined}
        />
      </TabsContent>
    </Tabs>
  );
}
