"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KNOWLEDGE_ENTRY_CATEGORIES,
  knowledgeEntryCategoryLabel,
} from "@/lib/platform/knowledge-categories";

export function KnowledgeForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [kb, setKb] = useState({ title: "", description: "" });
  const [entry, setEntry] = useState({
    title: "",
    category: "general",
    content: "",
  });
  const [kbId, setKbId] = useState<string | null>(null);

  async function createBase() {
    if (!kb.title.trim()) {
      toast.error("Knowledge base title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/platform/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kb),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to create knowledge base");
      setKbId(data.knowledgeBase.id);
      toast.success("Knowledge base created — add entries below");
    } catch {
      toast.error("Could not create knowledge base");
    } finally {
      setSaving(false);
    }
  }

  async function addEntry() {
    if (!kbId) {
      toast.error("Create the knowledge base first");
      return;
    }
    if (!entry.title.trim() || !entry.content.trim()) {
      toast.error("Entry title and content are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/platform/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "entry",
          knowledge_base_id: kbId,
          ...entry,
        }),
      });
      if (!res.ok) throw new Error("Failed to add entry");
      toast.success("Entry added");
      setEntry({ title: "", category: entry.category, content: "" });
      router.refresh();
    } catch {
      toast.error("Could not add entry");
    } finally {
      setSaving(false);
    }
  }

  function done() {
    router.push("/dashboard/knowledge");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge base</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Create a collection your agents can search for accurate answers.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={kb.title}
              onChange={(e) => setKb({ ...kb, title: e.target.value })}
              disabled={Boolean(kbId)}
              placeholder="Product FAQ"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={kb.description}
              onChange={(e) => setKb({ ...kb, description: e.target.value })}
              disabled={Boolean(kbId)}
            />
          </div>
          {!kbId && (
            <Button onClick={createBase} disabled={saving}>
              {saving ? "Creating…" : "Create knowledge base"}
            </Button>
          )}
        </CardContent>
      </Card>

      {kbId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Entry title *</Label>
              <Input
                value={entry.title}
                onChange={(e) => setEntry({ ...entry, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={entry.category}
                onValueChange={(v) => setEntry({ ...entry, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWLEDGE_ENTRY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {knowledgeEntryCategoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea
                rows={6}
                value={entry.content}
                onChange={(e) => setEntry({ ...entry, content: e.target.value })}
                placeholder="Paste FAQ, product details, or policies your agent should use."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addEntry} disabled={saving}>
                {saving ? "Saving…" : "Add entry"}
              </Button>
              <Button variant="outline" onClick={done}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
