"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CallRecord } from "@/lib/voice/types";

type AgentOption = { id: string; name: string };

function formatDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CallsList({ agents }: { agents: AgentOption[] }) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState("");
  const [direction, setDirection] = useState("");
  const [handoffOnly, setHandoffOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (agentId) params.set("agent_id", agentId);
    if (direction) params.set("direction", direction);
    if (handoffOnly) params.set("handoff_required", "true");
    try {
      const res = await fetch(`/api/platform/calls?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load calls");
      setCalls(data.calls ?? []);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [status, agentId, direction, handoffOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Card className="border-slate-800/60 bg-slate-900/40">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="human_needed">Human needed</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Agent</Label>
            <Select value={agentId || "all"} onValueChange={(v) => setAgentId(v === "all" ? "" : v)}>
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select
              value={direction || "all"}
              onValueChange={(v) => setDirection(v === "all" ? "" : v)}
            >
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={handoffOnly}
                onChange={(e) => setHandoffOnly(e.target.checked)}
              />
              Handoff required
            </label>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading calls…</p>
      ) : calls.length === 0 ? (
        <p className="text-sm text-slate-500">No calls match your filters.</p>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <Link key={call.id} href={`/dashboard/calls/${call.id}`}>
              <Card className="border-slate-800/60 bg-slate-900/40 transition hover:border-cyan-500/30">
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10">
                    {call.direction === "outbound" ? (
                      <PhoneOutgoing className="h-5 w-5 text-cyan-400" />
                    ) : (
                      <PhoneIncoming className="h-5 w-5 text-cyan-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">
                      {call.from_number ?? "Unknown caller"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(call.created_at).toLocaleString()} ·{" "}
                      {formatDuration(call.duration_seconds)}
                    </p>
                  </div>
                  <Badge variant="outline">{call.status}</Badge>
                  {call.lead_category && (
                    <Badge className="bg-slate-800">{call.lead_category}</Badge>
                  )}
                  {call.handoff_required && (
                    <Badge className="bg-amber-500/20 text-amber-200">Handoff</Badge>
                  )}
                  {call.detected_intent && (
                    <span className="text-xs text-slate-500">{call.detected_intent}</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
