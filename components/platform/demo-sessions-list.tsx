"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, MonitorPlay } from "lucide-react";
import { DemoSessionActions } from "@/components/platform/demo-session-actions";
import type { DemoSession } from "@/lib/demo/types";
import { DEMO_STATUSES } from "@/lib/demo/types";
import { CreateDemoSessionModal } from "@/components/platform/create-demo-session-modal";

type SessionRow = DemoSession & {
  lead_name: string | null;
  agent_name: string | null;
};

type AgentOption = {
  id: string;
  name: string;
  operational_role?: string | null;
};
type LeadOption = { id: string; full_name: string | null; email: string | null };

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function DemoSessionsList({
  agents,
  leads,
}: {
  agents: AgentOption[];
  leads: LeadOption[];
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [agentId, setAgentId] = useState<string>("all");
  const [leadCategory, setLeadCategory] = useState<string>("all");
  const [handoffOnly, setHandoffOnly] = useState(false);
  const [bookingOnly, setBookingOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const searchParams = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (agentId !== "all") params.set("agent_id", agentId);
      if (leadCategory !== "all") params.set("lead_category", leadCategory);
      if (handoffOnly) params.set("handoff_required", "true");
      if (bookingOnly) params.set("booking_recommended", "true");
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }
      const res = await fetch(`/api/platform/demo/sessions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setSessions(data.sessions ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [status, agentId, leadCategory, handoffOnly, bookingOnly, dateFrom, dateTo]);

  useEffect(() => {
    if (searchParams.get("handoff") === "1") {
      setHandoffOnly(true);
    }
    void load();
  }, [load, searchParams]);

  return (
    <div className="space-y-4">
      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <CreateDemoSessionModal agents={agents} leads={leads} onCreated={() => void load()} />
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2 min-w-[140px]">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-slate-950/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {DEMO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[160px]">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="bg-slate-950/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[140px]">
              <Label>Lead category</Label>
              <Select value={leadCategory} onValueChange={setLeadCategory}>
                <SelectTrigger className="bg-slate-950/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-950/80 w-[150px]"
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-950/80 w-[150px]"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-400">
            <label className="flex items-center gap-2">
              <Input
                type="checkbox"
                className="h-4 w-4"
                checked={handoffOnly}
                onChange={(e) => setHandoffOnly(e.target.checked)}
              />
              Handoff required
            </label>
            <label className="flex items-center gap-2">
              <Input
                type="checkbox"
                className="h-4 w-4"
                checked={bookingOnly}
                onChange={(e) => setBookingOnly(e.target.checked)}
              />
              Booking recommended
            </label>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading demos…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-500">
          No demo sessions yet. Create a session and share the demo room link with a prospect.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="border-slate-800/80 bg-slate-900/50 hover:border-cyan-500/20 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                      <MonitorPlay className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{s.title}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {s.lead_name ?? "No lead"} · {s.agent_name ?? "Agent"} ·{" "}
                        {s.demo_type}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{s.status.replace(/_/g, " ")}</Badge>
                        {s.lead_category && (
                          <Badge variant="outline">{s.lead_category}</Badge>
                        )}
                        {s.handoff_required && (
                          <Badge variant="destructive">Handoff</Badge>
                        )}
                        {s.booking_recommended && (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                            Book
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        Duration {formatDuration(s.duration_seconds)} · Created{" "}
                        {new Date(s.created_at).toLocaleString()}
                        {s.recommended_next_action && (
                          <> · Next: {s.recommended_next_action}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/demo-calls/${s.id}`}>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View demo
                      </Link>
                    </Button>
                    <DemoSessionActions
                      sessionId={s.id}
                      status={s.status}
                      handoffRequired={s.handoff_required}
                      onUpdated={() => void load()}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
