"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { DemoReviewStatus } from "@/lib/demo/types";

type Props = {
  sessionId: string;
  initial: {
    demo_quality_score?: number | null;
    lead_quality_score?: number | null;
    ai_performance_rating?: number | null;
    human_takeover_rating?: number | null;
    review_notes?: string | null;
    manager_notes?: string | null;
    review_status?: DemoReviewStatus | string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
  };
  canReview: boolean;
};

export function DemoManagerReview({ sessionId, initial, canReview }: Props) {
  const [demoQuality, setDemoQuality] = useState(
    initial.demo_quality_score?.toString() ?? ""
  );
  const [leadQuality, setLeadQuality] = useState(
    initial.lead_quality_score?.toString() ?? ""
  );
  const [aiRating, setAiRating] = useState(
    initial.ai_performance_rating?.toString() ?? ""
  );
  const [humanRating, setHumanRating] = useState(
    initial.human_takeover_rating?.toString() ?? ""
  );
  const [notes, setNotes] = useState(initial.review_notes ?? "");
  const [managerNotes, setManagerNotes] = useState(initial.manager_notes ?? "");
  const [reviewStatus, setReviewStatus] = useState<string>(
    initial.review_status ?? "not_reviewed"
  );
  const [saving, setSaving] = useState(false);

  if (!canReview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manager review</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {initial.review_status && initial.review_status !== "not_reviewed" && (
            <Badge variant="outline" className="capitalize">
              {String(initial.review_status).replace(/_/g, " ")}
            </Badge>
          )}
          {initial.reviewed_at ? (
            <p>
              Reviewed by {initial.reviewed_by ?? "—"} on{" "}
              {new Date(initial.reviewed_at).toLocaleString()}
            </p>
          ) : (
            <p>Not reviewed yet.</p>
          )}
          {initial.manager_notes && (
            <p className="whitespace-pre-wrap">{initial.manager_notes}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  async function save(opts: {
    markReviewed?: boolean;
    markNeedsAttention?: boolean;
    status?: DemoReviewStatus;
  }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/demo/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          manager_review: {
            demo_quality_score: demoQuality ? Number(demoQuality) : undefined,
            lead_quality_score: leadQuality ? Number(leadQuality) : undefined,
            ai_performance_rating: aiRating ? Number(aiRating) : undefined,
            human_takeover_rating: humanRating ? Number(humanRating) : undefined,
            review_notes: notes,
            manager_notes: managerNotes,
            review_status: opts.status ?? reviewStatus,
            mark_reviewed: opts.markReviewed,
            mark_needs_attention: opts.markNeedsAttention,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (opts.markReviewed) setReviewStatus("reviewed");
      if (opts.markNeedsAttention) setReviewStatus("needs_attention");
      toast.success(
        opts.markReviewed
          ? "Marked as reviewed"
          : opts.markNeedsAttention
            ? "Flagged for attention"
            : "Review saved"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manager review</CardTitle>
        {initial.reviewed_at && (
          <p className="text-xs text-muted-foreground">
            Last update {new Date(initial.reviewed_at).toLocaleString()}
            {initial.reviewed_by ? ` · ${initial.reviewed_by}` : ""}
          </p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Review status</Label>
          <Select value={reviewStatus} onValueChange={setReviewStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_reviewed">Not reviewed</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="needs_attention">Needs attention</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Demo quality (1–5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={demoQuality}
            onChange={(e) => setDemoQuality(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Lead quality (1–5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={leadQuality}
            onChange={(e) => setLeadQuality(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>AI performance (1–5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={aiRating}
            onChange={(e) => setAiRating(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Human takeover (1–5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={humanRating}
            onChange={(e) => setHumanRating(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Manager notes</Label>
          <Textarea
            value={managerNotes}
            onChange={(e) => setManagerNotes(e.target.value)}
            rows={3}
            placeholder="Coaching, quality issues, next steps for the team…"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Review notes (internal)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save({})}>
            Save draft
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void save({ markReviewed: true, status: "reviewed" })}
          >
            Mark reviewed
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={() =>
              void save({ markNeedsAttention: true, status: "needs_attention" })
            }
          >
            Needs attention
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
