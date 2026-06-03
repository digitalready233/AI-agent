"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { VoiceSimulateResult } from "@/lib/voice/types";

type AgentOption = { id: string; name: string };

export function VoiceSimulatePanel({ agents }: { agents: AgentOption[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceSimulateResult | null>(null);

  async function runSimulate() {
    if (!agentId || !message.trim()) {
      toast.error("Choose an agent and enter a test line");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/platform/voice/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          message: message.trim(),
          conversation_id: conversationId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulate failed");
      if (data.conversation_id) setConversationId(data.conversation_id);
      setResult(data as VoiceSimulateResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="text-lg text-white">Simulate voice call</CardTitle>
        <p className="text-sm text-slate-500">
          Test inbound voice logic without Twilio. Type what a caller would say.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Agent</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="bg-slate-950/80">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Caller says</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi, I'm interested in your marketing services…"
            className="min-h-[80px] bg-slate-950/80"
          />
        </div>
        <Button onClick={() => void runSimulate()} disabled={loading}>
          {loading ? "Running…" : "Simulate turn"}
        </Button>

        {result && (
          <div className="space-y-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-4 text-sm">
            <p className="text-slate-300 whitespace-pre-wrap">{result.reply}</p>
            <div className="flex flex-wrap gap-2">
              {result.detected_intent && (
                <Badge variant="outline">Intent: {result.detected_intent}</Badge>
              )}
              {result.lead_category && (
                <Badge variant="outline">Lead: {result.lead_category}</Badge>
              )}
              {result.lead_score != null && (
                <Badge variant="outline">Score: {result.lead_score}</Badge>
              )}
              {result.handoff_triggered && (
                <Badge className="bg-amber-500/20 text-amber-200">Handoff</Badge>
              )}
              {result.booking_recommended && (
                <Badge className="bg-cyan-500/20 text-cyan-200">Book meeting</Badge>
              )}
            </div>
            {result.recommended_next_action && (
              <p className="text-xs text-slate-500">
                Next: {result.recommended_next_action}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
