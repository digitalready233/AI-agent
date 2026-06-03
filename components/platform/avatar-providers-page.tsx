"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AVATAR_PROVIDER_LABELS,
  type AvatarProviderId,
} from "@/lib/avatar/types";

type ProviderCard = {
  id: AvatarProviderId;
  label: string;
  status: string;
  configured: boolean;
  is_default: boolean;
  demos_started: number;
  failures: number;
  fallbacks: number;
  bookings: number;
  handoffs: number;
  avg_start_time_ms: number | null;
  success_rate: number;
  failure_rate: number;
  conversion_rate: number;
  last_tested_at: string | null;
};

type RoutingRule = {
  id: string;
  name: string;
  priority: number;
  conditions: Record<string, unknown>;
  provider: string;
  fallback_provider: string;
  status: string;
};

export function AvatarProvidersPage() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [mostReliable, setMostReliable] = useState<string | null>(null);
  const [bestConverting, setBestConverting] = useState<string | null>(null);
  const [smartRouting, setSmartRouting] = useState(true);
  const [ruleName, setRuleName] = useState("");
  const [ruleProvider, setRuleProvider] = useState<AvatarProviderId>("tavus");
  const [rulePathId, setRulePathId] = useState("");
  const [rulePriority, setRulePriority] = useState("10");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, rulesRes] = await Promise.all([
        fetch("/api/platform/avatar/providers", { credentials: "include" }),
        fetch("/api/platform/avatar/routing-rules", { credentials: "include" }),
      ]);
      const provData = await provRes.json();
      const rulesData = await rulesRes.json();
      if (!provRes.ok) throw new Error(provData.error ?? "Failed to load providers");
      setProviders(provData.providers ?? []);
      setMostReliable(provData.most_reliable ?? null);
      setBestConverting(provData.best_converting ?? null);
      setSmartRouting(provData.settings?.enable_smart_routing !== false);
      setRules(rulesData.rules ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setDefault(provider: AvatarProviderId) {
    const res = await fetch("/api/platform/avatar/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ default_avatar_provider: provider }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed");
      return;
    }
    toast.success(`${AVATAR_PROVIDER_LABELS[provider]} set as default`);
    void load();
  }

  async function testProvider(provider: AvatarProviderId) {
    const res = await fetch("/api/platform/avatar/providers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(
        `${AVATAR_PROVIDER_LABELS[provider]} OK (${data.response_time_ms ?? "?"}ms)`
      );
    } else {
      toast.error(data.message ?? "Test failed");
    }
    void load();
  }

  async function saveSmartRouting(enabled: boolean) {
    const res = await fetch("/api/platform/avatar/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ enable_smart_routing: enabled }),
    });
    if (!res.ok) {
      toast.error("Failed to update routing");
      return;
    }
    setSmartRouting(enabled);
    toast.success(enabled ? "Smart routing enabled" : "Smart routing disabled");
  }

  async function addRule() {
    if (!ruleName.trim()) {
      toast.error("Rule name required");
      return;
    }
    const res = await fetch("/api/platform/avatar/routing-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: ruleName.trim(),
        priority: parseInt(rulePriority, 10) || 100,
        provider: ruleProvider,
        fallback_provider: "internal_card",
        conditions: rulePathId.trim()
          ? { demo_path_id: rulePathId.trim() }
          : {},
        status: "active",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to save rule");
      return;
    }
    toast.success("Routing rule saved");
    setRuleName("");
    setRulePathId("");
    void load();
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/platform/avatar/routing-rules/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Rule removed");
    void load();
  }

  async function testRouting() {
    const res = await fetch("/api/platform/avatar/routing-rules/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        demo_path_id: rulePathId.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(
        `Would use ${data.provider} (fallback: ${data.fallback_provider}) — ${data.source}`
      );
    } else {
      toast.error(data.error ?? "Routing test failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading avatar providers…</p>;
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Avatar providers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare providers, set defaults, and configure smart routing for demo calls.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/demo-room">Demo room credentials</Link>
        </Button>
      </div>

      {(mostReliable || bestConverting) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {mostReliable && (
            <Badge variant="secondary">
              Most reliable: {AVATAR_PROVIDER_LABELS[mostReliable as AvatarProviderId] ?? mostReliable}
            </Badge>
          )}
          {bestConverting && (
            <Badge variant="outline">
              Best converting:{" "}
              {AVATAR_PROVIDER_LABELS[bestConverting as AvatarProviderId] ?? bestConverting}
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Smart routing</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smartRouting}
              onChange={(e) => void saveSmartRouting(e.target.checked)}
            />
            Enable routing rules for agents in smart routing mode
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <Card key={p.id} className={p.is_default ? "border-primary/50" : ""}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{p.label}</CardTitle>
                <Badge variant="outline" className="mt-1 text-[10px] capitalize">
                  {p.status.replace(/_/g, " ")}
                  {p.is_default ? " · default" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="grid grid-cols-2 gap-2">
                <span>Demos: {p.demos_started}</span>
                <span>Success: {p.success_rate}%</span>
                <span>Failures: {p.failure_rate}%</span>
                <span>Fallbacks: {p.fallbacks}</span>
                <span>Bookings: {p.bookings}</span>
                <span>Conv.: {p.conversion_rate}%</span>
                <span>Handoffs: {p.handoffs}</span>
                <span>
                  Avg start:{" "}
                  {p.avg_start_time_ms != null ? `${p.avg_start_time_ms}ms` : "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.id !== "internal_card" &&
                  p.id !== "heygen" &&
                  p.id !== "custom_future" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void testProvider(p.id)}
                      >
                        Test connection
                      </Button>
                      {!p.is_default && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void setDefault(p.id)}
                        >
                          Set as default
                        </Button>
                      )}
                    </>
                  )}
                {p.id === "internal_card" && !p.is_default && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void setDefault("internal_card")}
                  >
                    Set as default
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routing rules</CardTitle>
          <p className="text-xs text-muted-foreground">
            Lower priority number = evaluated first. Agent fixed provider overrides rules.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No routing rules yet.</p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    <strong>{r.name}</strong> → {r.provider} (fallback:{" "}
                    {r.fallback_provider}) · priority {r.priority}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void deleteRule(r.id)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2 border-t pt-4">
            <div className="space-y-2">
              <Label>Rule name</Label>
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Priority (lower = first)</Label>
              <Input
                type="number"
                value={rulePriority}
                onChange={(e) => setRulePriority(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ruleProvider}
                onChange={(e) =>
                  setRuleProvider(e.target.value as AvatarProviderId)
                }
              >
                <option value="tavus">Tavus</option>
                <option value="did">D-ID</option>
                <option value="internal_card">Internal presenter</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Demo path ID (optional)</Label>
              <Input
                placeholder="UUID of demo path"
                value={rulePathId}
                onChange={(e) => setRulePathId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void addRule()}>
              Add rule
            </Button>
            <Button size="sm" variant="outline" onClick={() => void testRouting()}>
              Test routing match
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
