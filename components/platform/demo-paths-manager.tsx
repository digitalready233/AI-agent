"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { SLIDE_BRANDING_ACCENTS, getPathSlideBrandingMap } from "@/lib/demo/slide-branding";
import type { SlideBranding, SlideBrandingMap } from "@/lib/demo/slide-branding";
import type { DemoPath } from "@/lib/demo/types";
import { Loader2, Palette, Sparkles } from "lucide-react";

type AgentOption = { id: string; name: string };

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr: string[]): string {
  return arr.join("\n");
}

const emptyPathForm = () => ({
  agent_id: "",
  title: "",
  description: "",
  service_category: "",
  target_industry: "general",
  path_key: "",
  recommended_cta: "",
  status: "active" as "active" | "draft" | "archived",
  qualification_questions: "",
  demo_asset_sequence: "",
});

export function DemoPathsManager({ agents }: { agents: AgentOption[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [paths, setPaths] = useState<DemoPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPathForm());
  const [slideBranding, setSlideBranding] = useState<SlideBrandingMap>({});
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const sequenceTitles = useMemo(
    () => linesToArray(form.demo_asset_sequence),
    [form.demo_asset_sequence]
  );

  const load = useCallback(async () => {
    if (!agentId) {
      setPaths([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/platform/demo/paths?agent_id=${encodeURIComponent(agentId)}&status=all`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load paths");
      setPaths(data.paths ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(path: DemoPath) {
    setEditingId(path.id);
    setForm({
      agent_id: path.agent_id ?? agentId,
      title: path.title,
      description: path.description ?? "",
      service_category: path.service_category ?? "",
      target_industry: path.target_industry ?? "general",
      path_key: path.path_key ?? "",
      recommended_cta: path.recommended_cta ?? "",
      status: path.status,
      qualification_questions: arrayToLines(path.qualification_questions ?? []),
      demo_asset_sequence: arrayToLines(path.demo_asset_sequence ?? []),
    });
    setSlideBranding(getPathSlideBrandingMap(path));
  }

  function startCreate() {
    setEditingId("new");
    setForm({ ...emptyPathForm(), agent_id: agentId });
    setSlideBranding({});
  }

  function updateSlideBrand(slideTitle: string, patch: Partial<SlideBranding>) {
    setSlideBranding((prev) => ({
      ...prev,
      [slideTitle]: { ...prev[slideTitle], ...patch },
    }));
  }

  async function save() {
    if (!form.title.trim() || !form.agent_id) {
      toast.error("Title and agent are required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        agent_id: form.agent_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        service_category: form.service_category.trim() || null,
        target_industry: form.target_industry.trim() || null,
        path_key: form.path_key.trim() || null,
        recommended_cta: form.recommended_cta.trim() || null,
        status: form.status,
        qualification_questions: linesToArray(form.qualification_questions),
        demo_asset_sequence: linesToArray(form.demo_asset_sequence),
        slide_branding: slideBranding,
      };

      const res = await fetch(
        editingId && editingId !== "new"
          ? `/api/platform/demo/paths/${editingId}`
          : "/api/platform/demo/paths",
        {
          method: editingId && editingId !== "new" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editingId === "new" ? "Path created" : "Path updated");
      setEditingId(null);
      setForm(emptyPathForm());
      setSlideBranding({});
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function seedDefaults() {
    if (!agentId) return;
    setSeeding(true);
    try {
      const res = await fetch(
        `/api/platform/demo/paths?seed=defaults&agent_id=${encodeURIComponent(agentId)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seed failed");
      toast.success(`Seeded ${data.created ?? 0} paths (${data.skipped ?? 0} skipped)`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-base">Agent & paths</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label>Sales agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
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
          <Button variant="outline" onClick={() => void seedDefaults()} disabled={seeding || !agentId}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Seed Digital Ready paths
          </Button>
          <Button onClick={startCreate} disabled={!agentId}>
            New demo path
          </Button>
        </CardContent>
      </Card>

      {editingId && (
        <Card className="border-cyan-500/30 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-cyan-400" />
              {editingId === "new" ? "Create demo path" : "Edit demo path & slide branding"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Path key</Label>
                <Input
                  placeholder="social_media"
                  value={form.path_key}
                  onChange={(e) => setForm((f) => ({ ...f, path_key: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Service category</Label>
                <Input
                  value={form.service_category}
                  onChange={(e) => setForm((f) => ({ ...f, service_category: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as typeof f.status }))
                  }
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
              <div className="space-y-2 sm:col-span-2">
                <Label>Recommended CTA</Label>
                <Input
                  value={form.recommended_cta}
                  onChange={(e) => setForm((f) => ({ ...f, recommended_cta: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Qualification questions (one per line)</Label>
                <Textarea
                  value={form.qualification_questions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, qualification_questions: e.target.value }))
                  }
                  rows={4}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Demo asset sequence (slide titles, one per line)</Label>
                <Textarea
                  value={form.demo_asset_sequence}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, demo_asset_sequence: e.target.value }))
                  }
                  rows={5}
                  placeholder="Company Introduction&#10;Social Media Management Overview"
                />
              </div>
            </div>

            {sequenceTitles.length > 0 && (
              <div className="space-y-4 border-t border-slate-800 pt-6">
                <p className="text-sm text-slate-400">
                  Hero branding per slide (shown at the top of each presentation slide in the demo room).
                </p>
                {sequenceTitles.map((slideTitle) => {
                  const b = slideBranding[slideTitle] ?? {};
                  return (
                    <div
                      key={slideTitle}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 space-y-3"
                    >
                      <p className="text-sm font-medium text-white">{slideTitle}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Eyebrow</Label>
                          <Input
                            className="h-8 text-sm"
                            value={b.eyebrow ?? ""}
                            onChange={(e) =>
                              updateSlideBrand(slideTitle, { eyebrow: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Badge</Label>
                          <Input
                            className="h-8 text-sm"
                            value={b.badge ?? ""}
                            onChange={(e) =>
                              updateSlideBrand(slideTitle, { badge: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Headline</Label>
                          <Input
                            value={b.headline ?? ""}
                            onChange={(e) =>
                              updateSlideBrand(slideTitle, { headline: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Subhead</Label>
                          <Textarea
                            rows={2}
                            className="text-sm"
                            value={b.subhead ?? ""}
                            onChange={(e) =>
                              updateSlideBrand(slideTitle, { subhead: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Accent color</Label>
                          <Select
                            value={b.accent ?? "cyan"}
                            onValueChange={(v) =>
                              updateSlideBrand(slideTitle, {
                                accent: v as SlideBranding["accent"],
                              })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SLIDE_BRANDING_ACCENTS.map((a) => (
                                <SelectItem key={a} value={a}>
                                  {a}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save path"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setSlideBranding({});
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-base">Demo paths ({paths.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : paths.length === 0 ? (
            <p className="text-sm text-slate-500">
              No paths yet. Seed defaults or create a path for this agent.
            </p>
          ) : (
            <ul className="space-y-2">
              {paths.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/60 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{p.title}</p>
                    <p className="text-xs text-slate-500">
                      {p.path_key ?? "—"} · {(p.demo_asset_sequence ?? []).length} slides ·{" "}
                      {Object.keys(getPathSlideBrandingMap(p)).length} branded heroes
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {p.status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
