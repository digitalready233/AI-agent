"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEMO_ASSET_TYPES, type DemoAsset } from "@/lib/demo/types";

type AgentOption = { id: string; name: string };
type KbOption = { id: string; name: string };

const emptyForm = () => ({
  title: "",
  content: "",
  asset_type: "slide" as string,
  sort_order: 0,
  demo_path_id: "" as string,
  attached_agent_id: "" as string,
  attached_knowledge_base_id: "" as string,
  status: "active" as "draft" | "active" | "archived",
});

export function DemoAssetsManager({
  agents,
  knowledgeBases,
}: {
  agents: AgentOption[];
  knowledgeBases: KbOption[];
}) {
  const [assets, setAssets] = useState<DemoAsset[]>([]);
  const [paths, setPaths] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/demo/assets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAssets(data.assets ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const aid = form.attached_agent_id || agents[0]?.id;
    if (!aid) {
      setPaths([]);
      return;
    }
    void fetch(`/api/platform/demo/paths?agent_id=${encodeURIComponent(aid)}&status=all`)
      .then((r) => r.json())
      .then((d) => setPaths((d.paths ?? []).map((p: { id: string; title: string }) => ({
        id: p.id,
        title: p.title,
      }))))
      .catch(() => setPaths([]));
  }, [form.attached_agent_id, agents]);

  function startEdit(asset: DemoAsset) {
    setEditingId(asset.id);
    setForm({
      title: asset.title,
      content: asset.content,
      asset_type: asset.asset_type,
      sort_order: asset.sort_order,
      demo_path_id: asset.demo_path_id ?? "",
      attached_agent_id: asset.attached_agent_id ?? "",
      attached_knowledge_base_id: asset.attached_knowledge_base_id ?? "",
      status: asset.status,
    });
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        content: form.content,
        asset_type: form.asset_type,
        sort_order: form.sort_order,
        attached_agent_id: form.attached_agent_id || null,
        attached_knowledge_base_id: form.attached_knowledge_base_id || null,
        status: form.status,
      };
      const res = await fetch(
        editingId ? `/api/platform/demo/assets/${editingId}` : "/api/platform/demo/assets",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editingId ? "Asset updated" : "Asset created");
      setEditingId(null);
      setForm(emptyForm());
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this demo asset?")) return;
    try {
      const res = await fetch(`/api/platform/demo/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      toast.success("Deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function seedDefaults() {
    const aid = form.attached_agent_id || agents[0]?.id;
    if (!aid) {
      toast.error("Select an agent to attach defaults");
      return;
    }
    setSeeding(true);
    try {
      const res = await fetch("/api/platform/demo/assets/seed-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: aid,
          knowledge_base_id: form.attached_knowledge_base_id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seed failed");
      const pa = data.pathAssets as { created?: number } | undefined;
      toast.success(
        `Paths: ${data.paths?.created ?? 0} · Path slides: ${pa?.created ?? 0} · Legacy: ${data.legacy?.created ?? 0}`
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-white">Demo assets</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Slides, service cards, product steps, pricing, case studies, and FAQs for the demo
              room.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={seeding || agents.length === 0}
            onClick={() => void seedDefaults()}
          >
            {seeding ? "Seeding…" : "Seed paths & slides"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-slate-500">No assets yet.</p>
          ) : (
            assets.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-800/80 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-200">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {a.asset_type} · order {a.sort_order} · {a.status}
                    {a.demo_path_id
                      ? ` · ${paths.find((p) => p.id === a.demo_path_id)?.title ?? "path"}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(a)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-400"
                    onClick={() => void remove(a.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800/80 bg-slate-900/40 h-fit">
        <CardHeader>
          <CardTitle className="text-base text-white">
            {editingId ? "Edit asset" : "New asset"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="bg-slate-950/80"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.asset_type}
              onValueChange={(v) => setForm((f) => ({ ...f, asset_type: v }))}
            >
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEMO_ASSET_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="min-h-[120px] bg-slate-950/80"
              placeholder="Markdown or plain text for the demo slide/card…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))
                }
                className="bg-slate-950/80"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as typeof form.status }))
                }
              >
                <SelectTrigger className="bg-slate-950/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Demo path</Label>
            <Select
              value={form.demo_path_id || "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, demo_path_id: v === "none" ? "" : v }))
              }
            >
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue placeholder="Link to a path" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No path (global)</SelectItem>
                {paths.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Attach to agent (optional)</Label>
            <Select
              value={form.attached_agent_id || "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, attached_agent_id: v === "none" ? "" : v }))
              }
            >
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All agents</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </Button>
            {editingId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
