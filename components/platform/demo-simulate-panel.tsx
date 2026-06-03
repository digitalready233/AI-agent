"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { DemoSimulateResult } from "@/lib/demo/types";

const E2E_QUALIFICATION_TURNS = [
  "I need social media management for my real estate company in Accra.",
  "My budget is GHS 5,000 and I want to start this month.",
];

const PRESETS = [
  {
    label: "Social media (real estate)",
    message:
      "I need social media management for my real estate company in Accra.",
  },
  {
    label: "Pricing question",
    message: "How much does your social media package cost per month?",
  },
  {
    label: "Budget GHS 5,000",
    message: "My budget is GHS 5,000 and I want to start this month.",
  },
  {
    label: "Request human",
    message: "I'd like to speak with someone on your sales team please.",
  },
  {
    label: "Book consultation",
    message: "This looks good — I'd like to book a consultation call.",
  },
  {
    label: "Outside knowledge",
    message: "Do you offer TikTok Shop setup and influencer contracts in Nigeria?",
  },
];

export function DemoSimulatePanel({ agentId }: { agentId: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<DemoSimulateResult | null>(null);

  async function runSimulate(text?: string) {
    const msg = (text ?? message).trim();
    if (!msg) {
      toast.error("Enter a message or pick a preset");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/platform/demo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          demo_session_id: demoSessionId ?? undefined,
          message: msg,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulate failed");
      if (data.demo_session_id) setDemoSessionId(data.demo_session_id);
      setResult({
        reply: data.reply,
        current_demo_stage: data.current_demo_stage,
        detected_intent: data.detected_intent,
        lead_score: data.lead_score,
        lead_category: data.lead_category,
        booking_recommended: data.booking_recommended,
        handoff_required: data.handoff_required,
        recommended_next_action: data.recommended_next_action,
        next_asset_title: data.next_asset_title,
      });
      if (text) setMessage(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setLoading(false);
    }
  }

  async function runE2eQualification() {
    setLoading(true);
    setResult(null);
    try {
      let last: DemoSimulateResult | null = null;
      for (const turn of E2E_QUALIFICATION_TURNS) {
        const res = await fetch("/api/platform/demo/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            demo_session_id: demoSessionId ?? undefined,
            message: turn,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Simulate failed");
        if (data.demo_session_id) setDemoSessionId(data.demo_session_id);
        last = {
          reply: data.reply,
          current_demo_stage: data.current_demo_stage,
          detected_intent: data.detected_intent,
          lead_score: data.lead_score,
          lead_category: data.lead_category,
          booking_recommended: data.booking_recommended,
          handoff_required: data.handoff_required,
          recommended_next_action: data.recommended_next_action,
          next_asset_title: data.next_asset_title,
        };
        setResult(last);
        setMessage(turn);
        await new Promise((r) => setTimeout(r, 400));
      }
      if (last?.lead_category === "hot") {
        toast.success("E2E complete — Hot Lead. Check notifications & booking flags.");
      } else {
        toast.info(
          `E2E finished — category: ${last?.lead_category ?? "—"}. Verify LLM scored budget/timeline.`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "E2E run failed");
    } finally {
      setLoading(false);
    }
  }

  async function endAndSummarize() {
    if (!demoSessionId) {
      toast.error("Run at least one turn first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/demo/sessions/${demoSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end_demo: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Demo summary generated");
      setResult((r) =>
        r
          ? {
              ...r,
              reply: data.summary ?? r.reply,
            }
          : r
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="default"
        className="bg-cyan-600 hover:bg-cyan-500"
        disabled={loading}
        onClick={() => void runE2eQualification()}
      >
        Run full qualification E2E
      </Button>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void runSimulate(p.message)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        <Label>Prospect says</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What would the prospect say in the demo?"
          className="min-h-[80px] bg-slate-950/80"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void runSimulate()} disabled={loading}>
          {loading ? "Running…" : "Simulate turn"}
        </Button>
        <Button variant="secondary" onClick={() => void endAndSummarize()} disabled={loading}>
          Generate demo summary
        </Button>
      </div>

      {result && (
        <div className="space-y-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-4 text-sm">
          <p className="text-slate-200 whitespace-pre-wrap">{result.reply}</p>
          <div className="flex flex-wrap gap-2">
            {result.current_demo_stage && (
              <Badge variant="outline">Stage: {result.current_demo_stage}</Badge>
            )}
            {result.detected_intent && (
              <Badge variant="outline">Intent: {result.detected_intent}</Badge>
            )}
            {result.lead_category && (
              <Badge variant="outline">{result.lead_category}</Badge>
            )}
            {result.lead_score != null && (
              <Badge variant="outline">Score: {result.lead_score}</Badge>
            )}
            {result.booking_recommended && <Badge variant="success">Booking recommended</Badge>}
            {result.handoff_required && <Badge variant="destructive">Handoff</Badge>}
            {result.next_asset_title && (
              <Badge variant="outline">Asset: {result.next_asset_title}</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
