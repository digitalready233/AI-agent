"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  sessionId: string;
  initialNotes: string;
  canEdit: boolean;
};

export function DemoFollowUpNotes({ sessionId, initialNotes, canEdit }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  if (!canEdit && !notes) return null;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/demo/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agent_follow_up_notes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Follow-up notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent follow-up notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="agent-follow-up-notes">Notes for next touch</Label>
              <Textarea
                id="agent-follow-up-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Call context, objections, promised next steps…"
              />
            </div>
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              Save notes
            </Button>
          </>
        ) : (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {notes || "No agent notes."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
