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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoiceIntegration } from "@/lib/voice/types";

type AgentOption = { id: string; name: string };

export function VoiceSettingsPanel({ agents }: { agents: AgentOption[] }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<VoiceIntegration | null>(null);
  const [authToken, setAuthToken] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/voice/settings");
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load");
      setSettings(data.settings);
    } catch {
      toast.error("Could not load voice settings");
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
      const res = await fetch("/api/platform/voice/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twilio_account_sid: settings.twilio_account_sid,
          twilio_auth_token: authToken.trim() || undefined,
          twilio_phone_number: settings.twilio_phone_number,
          default_agent_id: settings.default_agent_id,
          default_voice: settings.default_voice,
          human_transfer_phone: settings.human_transfer_phone,
          recording_enabled: settings.recording_enabled,
          transcription_enabled: settings.transcription_enabled,
          business_hours: settings.business_hours,
          after_hours_behavior: settings.after_hours_behavior,
          media_stream_ws_url: settings.media_stream_ws_url,
          use_media_stream: settings.use_media_stream,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Voice settings saved");
      setAuthToken("");
      await load();
    } catch {
      toast.error("Could not save voice settings");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/platform/voice/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Connection test failed");
      } else {
        toast.success("Twilio voice connection verified");
      }
      await load();
    } catch {
      toast.error("Could not run connection test");
    } finally {
      setTesting(false);
    }
  }

  if (loading || !settings) {
    return (
      <Card className="border-slate-800/60 bg-slate-900/40">
        <CardContent className="p-8 text-sm text-slate-500">Loading voice settings…</CardContent>
      </Card>
    );
  }

  const statusColor =
    settings.connection_status === "connected"
      ? "bg-emerald-500/20 text-emerald-300"
      : settings.connection_status === "error"
        ? "bg-rose-500/20 text-rose-300"
        : "bg-slate-500/20 text-slate-300";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/dashboard/integrations" className="text-cyan-400 hover:underline">
          Integrations
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-400">Voice (Twilio)</span>
      </div>

      <Card className="border-slate-800/60 bg-slate-900/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-white">Connection</CardTitle>
          <Badge className={statusColor}>{settings.connection_status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-400">
          <p>
            Configure Twilio Voice for inbound AI calls. Auth tokens are stored server-side only.
          </p>
          <div className="grid gap-2 rounded-lg border border-slate-800/80 bg-slate-950/50 p-4 font-mono text-xs">
            <p>
              <span className="text-slate-500">Inbound webhook: </span>
              {settings.inbound_webhook_url}
            </p>
            <p>
              <span className="text-slate-500">Status callback: </span>
              {settings.status_callback_url}
            </p>
            <p>
              <span className="text-slate-500">Media stream WS: </span>
              {settings.media_stream_ws_url}
            </p>
          </div>
          {settings.last_tested_at && (
            <p className="text-xs">
              Last tested: {new Date(settings.last_tested_at).toLocaleString()}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => void testConnection()}
            disabled={testing}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800/60 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-lg text-white">Twilio credentials</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Account SID</Label>
            <Input
              value={settings.twilio_account_sid ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, twilio_account_sid: e.target.value })
              }
              placeholder="ACxxxxxxxx"
              className="bg-slate-950/80"
            />
          </div>
          <div className="space-y-2">
            <Label>Auth token {settings.has_auth_token ? "(saved)" : ""}</Label>
            <Input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={settings.has_auth_token ? "••••••••" : "Enter to save"}
              className="bg-slate-950/80"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Twilio phone number (E.164)</Label>
            <Input
              value={settings.twilio_phone_number ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, twilio_phone_number: e.target.value })
              }
              placeholder="+15551234567"
              className="bg-slate-950/80"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800/60 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-lg text-white">AI agent & transfer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default AI agent</Label>
            <Select
              value={settings.default_agent_id ?? "none"}
              onValueChange={(v) =>
                setSettings({
                  ...settings,
                  default_agent_id: v === "none" ? null : v,
                })
              }
            >
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>OpenAI Realtime voice</Label>
            <Input
              value={settings.default_voice}
              onChange={(e) =>
                setSettings({ ...settings, default_voice: e.target.value })
              }
              placeholder="alloy"
              className="bg-slate-950/80"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Human transfer number</Label>
            <Input
              value={settings.human_transfer_phone ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, human_transfer_phone: e.target.value })
              }
              placeholder="+15559876543"
              className="bg-slate-950/80"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800/80 p-3">
            <Label>Recording enabled</Label>
            <input
              type="checkbox"
              checked={settings.recording_enabled}
              onChange={(e) =>
                setSettings({ ...settings, recording_enabled: e.target.checked })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800/80 p-3">
            <Label>Transcription enabled</Label>
            <input
              type="checkbox"
              checked={settings.transcription_enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  transcription_enabled: e.target.checked,
                })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800/80 p-3 sm:col-span-2">
            <div>
              <Label>Use media stream (OpenAI Realtime)</Label>
              <p className="text-xs text-slate-500 mt-1">
                Run npm run voice:ws locally or set VOICE_MEDIA_WS_PUBLIC_URL in production.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.use_media_stream}
              onChange={(e) =>
                setSettings({ ...settings, use_media_stream: e.target.checked })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Media stream WebSocket URL</Label>
            <Input
              value={settings.media_stream_ws_url ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, media_stream_ws_url: e.target.value })
              }
              className="bg-slate-950/80 font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label>After hours</Label>
            <Select
              value={settings.after_hours_behavior}
              onValueChange={(v) =>
                setSettings({
                  ...settings,
                  after_hours_behavior: v as VoiceIntegration["after_hours_behavior"],
                })
              }
            >
              <SelectTrigger className="bg-slate-950/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai_only">AI only</SelectItem>
                <SelectItem value="voicemail">Voicemail message</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="message">Play message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void save()} disabled={saving} className="rounded-xl">
        {saving ? "Saving…" : "Save voice settings"}
      </Button>
    </div>
  );
}
