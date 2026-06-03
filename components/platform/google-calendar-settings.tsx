"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { CalendarSettings, StaffAvailabilityBlock } from "@/lib/calendar/types";
import { DEFAULT_MEETING_TYPES } from "@/lib/calendar/meeting-types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function GoogleCalendarSettings() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [availability, setAvailability] = useState<StaffAvailabilityBlock[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/calendar/status");
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load calendar status");
      setConnected(data.status?.connected ?? false);
      setConnectedEmail(data.status?.connected_email ?? null);
      setOauthConfigured(data.status?.oauth_configured ?? false);
      setSettings(data.settings);
      setAvailability(data.settings?.staff_availability ?? []);
    } catch {
      toast.error("Could not load Google Calendar settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const connectedParam = searchParams.get("connected");
    const errorParam = searchParams.get("error");
    if (connectedParam) toast.success("Google Calendar connected");
    if (errorParam) toast.error(`Google connection failed: ${errorParam}`);
  }, [load, searchParams]);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/calendar/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: settings.timezone,
          calendar_id: settings.calendar_id,
          slot_interval_minutes: settings.slot_interval_minutes,
          buffer_minutes: settings.buffer_minutes,
          meeting_types: settings.meeting_types,
          staff_availability: availability,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Calendar settings saved");
      await load();
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/platform/calendar/oauth/disconnect", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Disconnect failed");
      toast.success("Google Calendar disconnected");
      await load();
    } catch {
      toast.error("Could not disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  function addAvailabilityBlock() {
    setAvailability((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        profile_id: null,
        day_of_week: 1,
        start_time: "09:00",
        end_time: "17:00",
        timezone: settings?.timezone ?? "UTC",
        available: true,
      },
    ]);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading Google Calendar settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/integrations" className="text-cyan-400 hover:underline">
          Integrations
        </Link>
        <span>/</span>
        <span>Google Calendar</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!oauthConfigured ? (
            <p className="text-sm text-amber-200/90">
              Server OAuth is not configured. Add{" "}
              <code className="text-xs">GOOGLE_OAUTH_CLIENT_ID</code> and{" "}
              <code className="text-xs">GOOGLE_OAUTH_CLIENT_SECRET</code> to your environment
              (never expose them in the browser).
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={connected ? "success" : "secondary"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
            {connectedEmail ? (
              <span className="text-sm text-slate-400">{connectedEmail}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {oauthConfigured && !connected ? (
              <Button asChild>
                <a href="/api/platform/calendar/oauth/connect">Connect Google Calendar</a>
              </Button>
            ) : null}
            {connected ? (
              <Button
                variant="outline"
                onClick={() => void disconnect()}
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {settings ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scheduling</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tz">Timezone</Label>
                <Input
                  id="tz"
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="cal">Calendar ID</Label>
                <Input
                  id="cal"
                  value={settings.calendar_id}
                  onChange={(e) =>
                    setSettings({ ...settings, calendar_id: e.target.value })
                  }
                  placeholder="primary"
                />
              </div>
              <div>
                <Label htmlFor="interval">Slot interval (minutes)</Label>
                <Input
                  id="interval"
                  type="number"
                  min={15}
                  max={120}
                  value={settings.slot_interval_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      slot_interval_minutes: Number(e.target.value) || 30,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="buffer">Buffer between slots (minutes)</Label>
                <Input
                  id="buffer"
                  type="number"
                  min={0}
                  max={60}
                  value={settings.buffer_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      buffer_minutes: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meeting types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(settings.meeting_types.length
                ? settings.meeting_types
                : DEFAULT_MEETING_TYPES
              ).map((m) => (
                <div
                  key={m.key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 p-3"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={(e) => {
                        setSettings({
                          ...settings,
                          meeting_types: settings.meeting_types.map((t) =>
                            t.key === m.key ? { ...t, enabled: e.target.checked } : t
                          ),
                        });
                      }}
                    />
                    {m.label}
                  </label>
                  <span className="text-xs text-slate-500">{m.duration_minutes} min</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Staff availability</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addAvailabilityBlock}>
                Add block
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {availability.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No custom hours — default Mon–Fri 9:00–17:00 is used for slot generation.
                </p>
              ) : (
                availability.map((block, idx) => (
                  <div
                    key={block.id}
                    className="grid gap-2 sm:grid-cols-4 items-end rounded-lg border border-slate-800 p-3"
                  >
                    <div>
                      <Label>Day</Label>
                      <select
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                        value={block.day_of_week}
                        onChange={(e) => {
                          const next = [...availability];
                          next[idx] = {
                            ...block,
                            day_of_week: Number(e.target.value),
                          };
                          setAvailability(next);
                        }}
                      >
                        {DAY_LABELS.map((label, i) => (
                          <option key={label} value={i}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Start</Label>
                      <Input
                        type="time"
                        value={block.start_time}
                        onChange={(e) => {
                          const next = [...availability];
                          next[idx] = { ...block, start_time: e.target.value };
                          setAvailability(next);
                        }}
                      />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input
                        type="time"
                        value={block.end_time}
                        onChange={(e) => {
                          const next = [...availability];
                          next[idx] = { ...block, end_time: e.target.value };
                          setAvailability(next);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setAvailability((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
