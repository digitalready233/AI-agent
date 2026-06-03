"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEMO_ROLE_LABELS, type DemoAgentRole } from "@/lib/demo/multi-agent/types";

type Assignment = {
  agent_role: string;
  agent_id: string;
  status: string;
};

type MultiAgentEventRow = {
  id: string;
  agent_role: string;
  event_type: string;
  output: Record<string, unknown>;
  created_at: string;
};

type LastTurn = {
  qualification?: Record<string, unknown> | null;
  objection?: Record<string, unknown> | null;
  booking?: Record<string, unknown> | null;
  handoff?: Record<string, unknown> | null;
  crmSummary?: Record<string, unknown> | null;
  followUp?: Record<string, unknown> | null;
  errors?: Record<string, string>;
};

function JsonBlock({ data }: { data: unknown }) {
  if (!data || (typeof data === "object" && Object.keys(data as object).length === 0)) {
    return <p className="text-xs text-muted-foreground">No output recorded.</p>;
  }
  return (
    <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto max-h-48">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function DemoAiTeamAnalysis({
  sessionId,
  multiAgentEnabled,
  lastTurn,
  pollIntervalMs,
}: {
  sessionId: string;
  multiAgentEnabled?: boolean;
  lastTurn?: LastTurn | null;
  /** When set, refetches assignments and events on this interval (e.g. live demo tab). */
  pollIntervalMs?: number;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<MultiAgentEventRow[]>([]);
  const [liveLastTurn, setLiveLastTurn] = useState<LastTurn | null | undefined>(
    lastTurn
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setLiveLastTurn(lastTurn);
  }, [lastTurn]);

  async function loadData(isPoll = false) {
    if (isPoll) setRefreshing(true);
    try {
      const res = await fetch(
        `/api/platform/demo/sessions/${sessionId}/multi-agent`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAssignments(data.assignments ?? []);
      setEvents(data.events ?? []);
      if (data.last_turn != null) {
        setLiveLastTurn(data.last_turn as LastTurn);
      }
    } catch {
      if (!isPoll) {
        setAssignments([]);
        setEvents([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void loadData(false);
  }, [sessionId]);

  useEffect(() => {
    if (!pollIntervalMs || !multiAgentEnabled) return;
    const id = window.setInterval(() => void loadData(true), pollIntervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData is stable enough for polling
  }, [sessionId, pollIntervalMs, multiAgentEnabled]);

  if (!multiAgentEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Multi-agent mode is off for this session. Enable it under Demo room settings.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading AI team analysis…</p>;
  }

  const roleLabel = (r: string) =>
    r in DEMO_ROLE_LABELS ? DEMO_ROLE_LABELS[r as DemoAgentRole] : r.replace(/_/g, " ");

  return (
    <div className="space-y-4">
      {refreshing && (
        <p className="text-xs text-violet-400/80">Refreshing specialist activity…</p>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Agents on this demo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments recorded yet.</p>
          ) : (
            assignments.map((a) => (
              <Badge key={a.agent_role} variant="outline" className="capitalize">
                {roleLabel(a.agent_role)}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      {liveLastTurn && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest turn — qualification</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonBlock data={liveLastTurn.qualification} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest turn — objections</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonBlock data={liveLastTurn.objection} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest turn — booking</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonBlock data={liveLastTurn.booking} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest turn — handoff</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonBlock data={liveLastTurn.handoff} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest turn — CRM summary</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonBlock data={liveLastTurn.crmSummary} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest turn — follow-up</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonBlock data={liveLastTurn.followUp} />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Specialist events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No specialist events yet.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="border-l-2 border-violet-500/40 pl-3 text-sm">
                <p className="font-medium capitalize">
                  {roleLabel(ev.agent_role)} · {ev.event_type.replace(/_/g, " ")}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(ev.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
