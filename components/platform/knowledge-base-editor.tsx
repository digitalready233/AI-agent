"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { ReadybotKnowledgeSeedButton } from "@/components/platform/readybot-knowledge-seed";
import {
  KNOWLEDGE_ENTRY_CATEGORIES,
  knowledgeEntryCategoryLabel,
} from "@/lib/platform/knowledge-categories";
import { READYBOT_KB_TEMPLATES } from "@/lib/platform/readybot-kb-templates";
import type { KnowledgeBase, KnowledgeEntry } from "@/lib/platform/types";

export function KnowledgeBaseEditor({
  knowledgeBase: initialKb,
  entries: initialEntries,
}: {
  knowledgeBase: KnowledgeBase;
  entries: KnowledgeEntry[];
}) {
  const router = useRouter();
  const [kb, setKb] = useState({
    title: initialKb.title,
    description: initialKb.description ?? "",
    status: initialKb.status,
  });
  const [entries, setEntries] = useState(initialEntries);
  const [savingKb, setSavingKb] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    title: "",
    category: "general",
    content: "",
  });

  async function saveKnowledgeBase() {
    if (!kb.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSavingKb(true);
    try {
      const res = await fetch("/api/platform/knowledge-bases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialKb.id,
          title: kb.title.trim(),
          description: kb.description.trim() || undefined,
          status: kb.status,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Knowledge base updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingKb(false);
    }
  }

  function startEditEntry(entry: KnowledgeEntry) {
    setEditingEntryId(entry.id);
    setEntryForm({
      title: entry.title,
      category: entry.category,
      content: entry.content,
    });
  }

  function startNewEntry() {
    setEditingEntryId(null);
    setEntryForm({ title: "", category: "general", content: "" });
  }

  function openStandardArticle(template: { title: string; category: string }) {
    const match = entries.find(
      (e) => e.title.trim().toLowerCase() === template.title.trim().toLowerCase()
    );
    if (match) {
      startEditEntry(match);
      return;
    }
    setEditingEntryId(null);
    setEntryForm({
      title: template.title,
      category: template.category,
      content: "",
    });
  }

  async function saveEntry() {
    if (!entryForm.title.trim() || !entryForm.content.trim()) {
      toast.error("Entry title and content are required");
      return;
    }
    setSavingEntry(true);
    try {
      const isEdit = Boolean(editingEntryId);
      const res = await fetch("/api/platform/knowledge-bases", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "entry",
          ...(isEdit ? { id: editingEntryId } : {}),
          knowledge_base_id: initialKb.id,
          title: entryForm.title.trim(),
          category: entryForm.category,
          content: entryForm.content.trim(),
        }),
      });
      const data = (await res.json()) as { entry?: KnowledgeEntry; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      const saved = data.entry!;
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      toast.success(isEdit ? "Entry updated" : "Entry added");
      startNewEntry();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save entry");
    } finally {
      setSavingEntry(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    try {
      const res = await fetch(
        `/api/platform/knowledge-bases?id=${encodeURIComponent(id)}&type=entry`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (editingEntryId === id) startNewEntry();
      toast.success("Entry deleted");
      router.refresh();
    } catch {
      toast.error("Could not delete entry");
    }
  }

  async function deleteKnowledgeBase() {
    if (!confirm(`Delete “${kb.title}” and all its entries?`)) return;
    try {
      const res = await fetch(
        `/api/platform/knowledge-bases?id=${encodeURIComponent(initialKb.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Knowledge base deleted");
      router.push("/dashboard/knowledge");
      router.refresh();
    } catch {
      toast.error("Could not delete knowledge base");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-base">Knowledge base details</CardTitle>
            <ReadybotKnowledgeSeedButton
              knowledgeBaseId={initialKb.id}
              knowledgeBaseTitle={kb.title}
              variant="secondary"
              size="sm"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={kb.title}
              onChange={(e) => setKb({ ...kb, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={kb.description}
              onChange={(e) => setKb({ ...kb, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={kb.status}
              onValueChange={(v) => setKb({ ...kb, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveKnowledgeBase()} disabled={savingKb}>
              {savingKb ? "Saving…" : "Save details"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={() => void deleteKnowledgeBase()}
            >
              Delete base
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Entries ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Click an entry to edit it.{" "}
            <span className="text-slate-400">
              Seed ReadyBot only adds missing standard articles — it will not overwrite
              your saved text.
            </span>
          </p>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No entries yet. Add one below or seed ReadyBot articles.</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => startEditEntry(e)}
                  >
                    <p className="text-sm font-medium text-white">{e.title}</p>
                    <p className="text-xs text-slate-500">{e.category}</p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-slate-500 hover:text-red-400"
                    onClick={() => void deleteEntry(e.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingEntryId ? "Edit entry" : "Add entry"}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Open a standard Digital Ready article to edit the seeded copy, or add your
            own entry below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-400">Standard articles</Label>
            <div className="flex flex-wrap gap-1.5">
              {READYBOT_KB_TEMPLATES.map((t) => {
                const exists = entries.some(
                  (e) =>
                    e.title.trim().toLowerCase() === t.title.trim().toLowerCase()
                );
                return (
                  <Button
                    key={t.title}
                    type="button"
                    variant={exists ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openStandardArticle(t)}
                  >
                    {exists ? "Edit" : "Add"}:{" "}
                    {t.title.length > 36 ? `${t.title.slice(0, 34)}…` : t.title}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={entryForm.title}
              onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={entryForm.category}
              onValueChange={(v) => setEntryForm({ ...entryForm, category: v })}
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
              rows={8}
              value={entryForm.content}
              onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveEntry()} disabled={savingEntry}>
              {savingEntry ? "Saving…" : editingEntryId ? "Update entry" : "Add entry"}
            </Button>
            {editingEntryId && (
              <Button type="button" variant="outline" onClick={startNewEntry}>
                Cancel edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
