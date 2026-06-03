"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AVATAR_PROVIDER_LABELS,
  type AvatarProviderId,
} from "@/lib/avatar/types";

type ProviderCard = {
  id: string;
  label: string;
  status: string;
  configured: boolean;
  masked_api_key: string | null;
  default_avatar_id: string | null;
  default_voice_id: string | null;
  default_replica_id?: string | null;
  default_persona_id?: string | null;
  can_manage_credentials: boolean;
  config?: {
    allowed_domains?: string[] | null;
    client_key_masked?: string | null;
    client_key_updated_at?: string | null;
  };
};

export function AvatarProviderSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enableAiAvatar, setEnableAiAvatar] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<AvatarProviderId>("internal_card");
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<
    Record<string, { avatar?: string; voice?: string; replica?: string; persona?: string }>
  >({});
  const [didAllowedDomains, setDidAllowedDomains] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/settings/avatar", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setEnableAiAvatar(Boolean(data.settings?.enable_ai_avatar));
      setDefaultProvider(data.settings?.default_avatar_provider ?? "internal_card");
      setProviders(data.providers ?? []);
      const didRow = (data.providers ?? []).find(
        (p: ProviderCard) => p.id === "did"
      ) as ProviderCard | undefined;
      const domains = didRow?.config?.allowed_domains;
      if (domains?.length) {
        setDidAllowedDomains(domains.join(", "));
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

  async function saveGlobal() {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/settings/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enable_ai_avatar: enableAiAvatar,
          default_avatar_provider: defaultProvider,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      toast.success("Avatar settings saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveProvider(provider: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/settings/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          api_key: apiKeys[provider] || undefined,
          default_avatar_id: defaults[provider]?.avatar ?? null,
          default_voice_id: defaults[provider]?.voice ?? null,
          default_replica_id:
            provider === "tavus" ? defaults[provider]?.replica ?? null : undefined,
          default_persona_id:
            provider === "tavus" ? defaults[provider]?.persona ?? null : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      toast.success(`${AVATAR_PROVIDER_LABELS[provider as AvatarProviderId] ?? provider} saved`);
      setApiKeys((prev) => ({ ...prev, [provider]: "" }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testProvider(provider: string) {
    try {
      const res = await fetch("/api/avatar/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          avatar_id: defaults[provider]?.avatar,
          avatar_persona_id:
            provider === "tavus"
              ? defaults[provider]?.persona ?? defaults[provider]?.avatar
              : defaults[provider]?.avatar,
          avatar_replica_id:
            provider === "tavus"
              ? defaults[provider]?.replica ?? defaults[provider]?.avatar
              : defaults[provider]?.avatar,
          avatar_voice_id: defaults[provider]?.voice,
        }),
      });
      const data = await res.json();
      if (data.ok) toast.success(data.message ?? "Connection OK");
      else toast.error(data.message ?? "Connection failed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading avatar settings…</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Compare providers, routing rules, and performance analytics.
          </p>
          <Button size="sm" variant="secondary" asChild>
            <a href="/dashboard/settings/avatar-providers">Open avatar providers hub</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI talking avatar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={enableAiAvatar}
              onChange={(e) => setEnableAiAvatar(e.target.checked)}
            />
            Enable external AI avatar providers
          </label>
          <div className="space-y-2">
            <Label>Default provider</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value as AvatarProviderId)}
            >
              {Object.entries(AVATAR_PROVIDER_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Fallback is always the internal animated presenter card when a provider fails or
            credentials are missing.
          </p>
          <Button onClick={() => void saveGlobal()} disabled={saving}>
            {saving ? "Saving…" : "Save global avatar settings"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <Card key={p.id} className={p.id === "internal_card" ? "border-dashed" : ""}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{p.label}</CardTitle>
              <Badge
                variant="outline"
                className={
                  p.status === "connected"
                    ? "text-emerald-600"
                    : p.status === "needs_attention"
                      ? "text-amber-600"
                      : ""
                }
              >
                {p.status.replace(/_/g, " ")}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {p.id === "internal_card" ? (
                <p className="text-muted-foreground text-xs">
                  Built-in animated presenter — no API key required.
                </p>
              ) : (
                <>
                  {p.masked_api_key && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Key: {p.masked_api_key}
                    </p>
                  )}
                  {p.can_manage_credentials && (
                    <div className="space-y-2">
                      <Label>API key</Label>
                      <Input
                        type="password"
                        placeholder={p.configured ? "Replace API key…" : "Paste API key"}
                        value={apiKeys[p.id] ?? ""}
                        onChange={(e) =>
                          setApiKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                      />
                    </div>
                  )}
                  {p.id === "tavus" ? (
                    <>
                      <div className="space-y-2">
                        <Label>Default replica ID</Label>
                        <Input
                          placeholder="r…"
                          value={
                            defaults[p.id]?.replica ??
                            p.default_replica_id ??
                            p.default_avatar_id ??
                            ""
                          }
                          onChange={(e) =>
                            setDefaults((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], replica: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default persona ID</Label>
                        <Input
                          placeholder="p…"
                          value={
                            defaults[p.id]?.persona ?? p.default_persona_id ?? ""
                          }
                          onChange={(e) =>
                            setDefaults((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], persona: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label>Default avatar / agent ID</Label>
                      <Input
                        value={defaults[p.id]?.avatar ?? p.default_avatar_id ?? ""}
                        onChange={(e) =>
                          setDefaults((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], avatar: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                  {(p.id === "did" || p.id === "heygen") && (
                    <div className="space-y-2">
                      <Label>Default voice ID (if applicable)</Label>
                      <Input
                        value={defaults[p.id]?.voice ?? p.default_voice_id ?? ""}
                        onChange={(e) =>
                          setDefaults((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], voice: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                  {p.id === "did" && (
                    <>
                      <div className="space-y-2">
                        <Label>Allowed domains (comma-separated)</Label>
                        <Input
                          placeholder="localhost, your-app.vercel.app"
                          value={didAllowedDomains}
                          onChange={(e) => setDidAllowedDomains(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Used when creating the D-ID client key for frontend WebRTC.
                        </p>
                      </div>
                      {p.config?.client_key_masked && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Client key: {p.config.client_key_masked}
                          {p.config.client_key_updated_at
                            ? ` · updated ${new Date(p.config.client_key_updated_at).toLocaleDateString()}`
                            : ""}
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {p.can_manage_credentials && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void saveProvider(p.id)}
                        disabled={saving}
                      >
                        Save
                      </Button>
                    )}
                    {p.can_manage_credentials && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void testProvider(p.id)}
                      >
                        Test connection
                      </Button>
                    )}
                    {p.id === "did" && p.can_manage_credentials && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const domains = didAllowedDomains
                                .split(",")
                                .map((d) => d.trim())
                                .filter(Boolean);
                              const res = await fetch("/api/avatar/did/client-key/create", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({
                                  allowed_domains: domains.length ? domains : undefined,
                                  regenerate: true,
                                }),
                              });
                              const data = await res.json();
                              if (data.ok) {
                                toast.success(data.message ?? "Client key created");
                                void load();
                              } else toast.error(data.error ?? "Failed");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Client key failed"
                              );
                            }
                          }}
                        >
                          Create client key
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/avatar/did/session/test", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({
                                  agent_id:
                                    defaults.did?.avatar ?? p.default_avatar_id ?? undefined,
                                }),
                              });
                              const data = await res.json();
                              if (data.ok) toast.success(data.message ?? "Test OK");
                              else toast.error(data.message ?? "Test failed");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Test session failed"
                              );
                            }
                          }}
                        >
                          Test session
                        </Button>
                      </>
                    )}
                    {p.id === "tavus" && p.can_manage_credentials && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/avatar/tavus/conversation/test", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({
                                replica_id:
                                  defaults.tavus?.replica ??
                                  p.default_replica_id ??
                                  undefined,
                                persona_id:
                                  defaults.tavus?.persona ??
                                  p.default_persona_id ??
                                  undefined,
                              }),
                            });
                            const data = await res.json();
                            if (data.ok) toast.success(data.message ?? "Test conversation OK");
                            else toast.error(data.message ?? "Test failed");
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Test conversation failed"
                            );
                          }
                        }}
                      >
                        Test conversation
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
