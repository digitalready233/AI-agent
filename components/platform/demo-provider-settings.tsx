"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { DemoProviderSettings } from "@/lib/platform/settings-types";
import {
  DEFAULT_AI_PRESENTER_ORG_SETTINGS,
  type AiPresenterUiMode,
} from "@/lib/demo/ai-presenter-types";
import { AvatarProviderSettingsPanel } from "@/components/platform/avatar-provider-settings";
import { MultiAgentDemoSettingsPanel } from "@/components/platform/multi-agent-demo-settings";

export function DemoProviderSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DemoProviderSettings | null>(null);
  const [env, setEnv] = useState<{
    livekit_configured?: boolean;
    openai_configured?: boolean;
    app_url?: string | null;
  }>({});

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/platform/settings/demo-room");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setSettings(data.settings);
        setEnv(data.env ?? {});
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/settings/demo-room", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data.settings);
      setEnv(data.env ?? env);
      toast.success("Demo provider settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return <p className="text-sm text-muted-foreground">Loading demo settings…</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Demo / video provider</CardTitle>
          <p className="text-sm text-muted-foreground">
            LiveKit credentials stay in server environment variables only — never exposed to the
            browser.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Connection</span>
            <Badge variant="outline" className="capitalize">
              {settings.connection_status.replace(/_/g, " ")}
            </Badge>
            {env.livekit_configured && (
              <Badge className="bg-emerald-600/20 text-emerald-300">LiveKit env OK</Badge>
            )}
            {env.openai_configured && (
              <Badge className="bg-cyan-600/20 text-cyan-300">OpenAI voice OK</Badge>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(v) =>
                  setSettings({
                    ...settings,
                    provider: v as DemoProviderSettings["provider"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (browser)</SelectItem>
                  <SelectItem value="livekit_future">LiveKit</SelectItem>
                  <SelectItem value="daily_future">Daily (planned)</SelectItem>
                  <SelectItem value="zoom_future">Zoom (planned)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default provider</Label>
              <Select
                value={settings.default_demo_provider}
                onValueChange={(v) =>
                  setSettings({
                    ...settings,
                    default_demo_provider: v as DemoProviderSettings["default_demo_provider"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="livekit_future">LiveKit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enable_voice_demo}
              onChange={(e) =>
                setSettings({ ...settings, enable_voice_demo: e.target.checked })
              }
            />
            Enable voice demo
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enable_human_takeover}
              onChange={(e) =>
                setSettings({ ...settings, enable_human_takeover: e.target.checked })
              }
            />
            Enable human takeover
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={
                settings.enable_recording ?? settings.enable_recording_placeholder ?? false
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  enable_recording: e.target.checked,
                  enable_recording_placeholder: e.target.checked,
                })
              }
            />
            Enable demo recording
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.auto_record_demos ?? false}
              onChange={(e) =>
                setSettings({ ...settings, auto_record_demos: e.target.checked })
              }
            />
            Auto-record demos (staff room)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={
                settings.require_recording_consent ??
                settings.record_only_with_consent ??
                true
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  require_recording_consent: e.target.checked,
                  record_only_with_consent: e.target.checked,
                })
              }
            />
            Require recording consent before start
          </label>
          <div className="space-y-2">
            <Label>Recording provider</Label>
            <Select
              value={settings.recording_provider ?? "none"}
              onValueChange={(v) =>
                setSettings({
                  ...settings,
                  recording_provider: v as DemoProviderSettings["recording_provider"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="livekit_egress">LiveKit Egress</SelectItem>
                <SelectItem value="none">None (transcript only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Storage location</Label>
            <Input
              value={settings.recording_storage_location ?? "livekit_cloud"}
              onChange={(e) =>
                setSettings({ ...settings, recording_storage_location: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Retention (days)</Label>
            <Input
              type="number"
              min={1}
              max={3650}
              value={settings.recording_retention_days ?? 90}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  recording_retention_days: Number(e.target.value) || 90,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Recording consent message</Label>
            <Input
              value={
                settings.recording_consent_message ??
                "This demo may be recorded for quality, training, and follow-up purposes. Do you agree to continue?"
              }
              onChange={(e) =>
                setSettings({ ...settings, recording_consent_message: e.target.value })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.auto_send_follow_up ?? false}
              onChange={(e) =>
                setSettings({ ...settings, auto_send_follow_up: e.target.checked })
              }
            />
            Auto-send customer follow-up (when enabled)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enable_transcript}
              onChange={(e) =>
                setSettings({ ...settings, enable_transcript: e.target.checked })
              }
            />
            Enable transcript
          </label>

          <div className="space-y-2">
            <Label>Session timeout (minutes)</Label>
            <Input
              type="number"
              min={15}
              max={480}
              value={settings.demo_session_timeout_minutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  demo_session_timeout_minutes: Number(e.target.value) || 90,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Welcome title (branding)</Label>
            <Input
              value={settings.demo_room_branding.welcome_title ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  demo_room_branding: {
                    ...settings.demo_room_branding,
                    welcome_title: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className="border-t border-border/60 pt-4 space-y-3">
            <p className="text-sm font-medium">AI visual presenter</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={
                  settings.ai_presenter?.enable_ai_presenter ??
                  DEFAULT_AI_PRESENTER_ORG_SETTINGS.enable_ai_presenter
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai_presenter: {
                      ...DEFAULT_AI_PRESENTER_ORG_SETTINGS,
                      ...settings.ai_presenter,
                      enable_ai_presenter: e.target.checked,
                    },
                  })
                }
              />
              Enable AI presenter card in demo room
            </label>
            <div className="space-y-2">
              <Label>Presenter mode</Label>
              <Select
                value={
                  settings.ai_presenter?.presenter_ui_mode ??
                  DEFAULT_AI_PRESENTER_ORG_SETTINGS.presenter_ui_mode
                }
                onValueChange={(v) =>
                  setSettings({
                    ...settings,
                    ai_presenter: {
                      ...DEFAULT_AI_PRESENTER_ORG_SETTINGS,
                      ...settings.ai_presenter,
                      presenter_ui_mode: v as AiPresenterUiMode,
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="animated_card">Animated card</SelectItem>
                  <SelectItem value="static_card">Static card</SelectItem>
                  <SelectItem value="avatar_future">Future avatar (placeholder)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default avatar image URL</Label>
              <Input
                value={settings.ai_presenter?.default_avatar_url ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai_presenter: {
                      ...DEFAULT_AI_PRESENTER_ORG_SETTINGS,
                      ...settings.ai_presenter,
                      default_avatar_url: e.target.value || null,
                    },
                  })
                }
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label>Brand color</Label>
              <Input
                value={
                  settings.ai_presenter?.brand_color ??
                  DEFAULT_AI_PRESENTER_ORG_SETTINGS.brand_color
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai_presenter: {
                      ...DEFAULT_AI_PRESENTER_ORG_SETTINGS,
                      ...settings.ai_presenter,
                      brand_color: e.target.value,
                    },
                  })
                }
              />
            </div>
            {(
              [
                ["show_waveform", "Show waveform animation"],
                ["show_demo_stage", "Show demo stage on presenter"],
                ["show_demo_path", "Show selected demo path"],
                ["show_booking_badge", "Show booking recommended badge"],
                ["show_handoff_badge", "Show handoff badge"],
                ["compact_mode", "Compact mode (floating tile)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    settings.ai_presenter?.[key] ??
                    DEFAULT_AI_PRESENTER_ORG_SETTINGS[key]
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ai_presenter: {
                        ...DEFAULT_AI_PRESENTER_ORG_SETTINGS,
                        ...settings.ai_presenter,
                        [key]: e.target.checked,
                      },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save demo settings"}
          </Button>
        </CardContent>
      </Card>

      <MultiAgentDemoSettingsPanel />

      <AvatarProviderSettingsPanel />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Server environment (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1 font-mono">
          <p>LIVEKIT_API_KEY — {env.livekit_configured ? "set" : "not set"}</p>
          <p>LIVEKIT_API_SECRET — {env.livekit_configured ? "set" : "not set"}</p>
          <p>LIVEKIT_URL — {env.livekit_configured ? "set" : "not set"}</p>
          <p>OPENAI_API_KEY — {env.openai_configured ? "set" : "not set"}</p>
          <p>NEXT_PUBLIC_APP_URL — {env.app_url ?? "not set"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
