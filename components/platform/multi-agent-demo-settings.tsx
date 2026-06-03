"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  DEMO_ROLE_LABELS,
  type DemoAgentRole,
  type MultiAgentDemoSettings,
} from "@/lib/demo/multi-agent/types";

type AgentOption = { id: string; name: string; operational_role?: string | null };

const ROLE_KEYS: DemoAgentRole[] = [
  "presenter_agent",
  "qualification_agent",
  "objection_agent",
  "booking_agent",
  "crm_summary_agent",
  "handoff_agent",
  "follow_up_agent",
];

export function MultiAgentDemoSettingsPanel({
  agents: agentsProp,
}: {
  agents?: AgentOption[];
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<MultiAgentDemoSettings | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>(agentsProp ?? []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, agentsRes] = await Promise.all([
        fetch("/api/platform/settings/demo-room", { credentials: "include" }),
        agentsProp
          ? Promise.resolve(null)
          : fetch("/api/platform/agents", { credentials: "include" }),
      ]);
      const data = await settingsRes.json();
      if (!settingsRes.ok) throw new Error(data.error ?? "Failed to load");
      setSettings(data.settings?.multi_agent ?? null);
      if (agentsRes) {
        const agentData = await agentsRes.json();
        if (agentsRes.ok) {
          setAgents(
            (agentData.agents ?? []).map(
              (a: { id: string; name: string; operational_role?: string }) => ({
                id: a.id,
                name: a.name,
                operational_role: a.operational_role,
              })
            )
          );
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/settings/demo-room", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ multi_agent: settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data.settings?.multi_agent ?? settings);
      toast.success("Multi-agent settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading multi-agent settings…</p>;
  }

  const s = settings ?? {
    enabled: false,
    execution_mode: "sequential" as const,
    save_internal_reasoning: true,
    show_team_analysis_to_admins: true,
    default_team: {},
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Multi-agent demo mode</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => setSettings({ ...s, enabled: e.target.checked })}
          />
          Enable multi-agent demo mode
        </label>
        <div className="space-y-2">
          <Label>Execution mode</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={s.execution_mode}
            onChange={(e) =>
              setSettings({
                ...s,
                execution_mode: e.target.value as MultiAgentDemoSettings["execution_mode"],
              })
            }
          >
            <option value="sequential">Sequential (recommended)</option>
            <option value="parallel_future" disabled>
              Parallel (coming soon)
            </option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={s.save_internal_reasoning}
            onChange={(e) =>
              setSettings({ ...s, save_internal_reasoning: e.target.checked })
            }
          />
          Save internal agent reasoning in events
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={s.show_team_analysis_to_admins}
            onChange={(e) =>
              setSettings({ ...s, show_team_analysis_to_admins: e.target.checked })
            }
          />
          Show AI team analysis to admins
        </label>
        <div className="space-y-3 pt-2 border-t border-border/60">
          <p className="text-sm font-medium">Default demo agent team</p>
          <p className="text-xs text-muted-foreground">
            Assign specialist agents by operational role. Leave blank to use smart assignment
            (first enabled agent per role).
          </p>
          {ROLE_KEYS.map((role) => (
            <div key={role} className="space-y-1">
              <Label className="text-xs">{DEMO_ROLE_LABELS[role]}</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={s.default_team[role] ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...s,
                    default_team: {
                      ...s.default_team,
                      [role]: e.target.value || null,
                    },
                  })
                }
              >
                <option value="">Smart assign</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.operational_role ? ` (${a.operational_role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save multi-agent settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
