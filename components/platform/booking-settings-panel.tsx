"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  BookingProviderStatus,
  CalendarSettings,
  StaffAvailabilityBlock,
} from "@/lib/calendar/types";
import { DEFAULT_MEETING_TYPES } from "@/lib/calendar/meeting-types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ProfileOption = {
  id: string;
  full_name: string;
  role?: string;
  booking_email?: string | null;
};

const BOOKABLE_ROLES = new Set([
  "sales_agent",
  "sales_manager",
  "company_admin",
  "super_admin",
]);

export function BookingSettingsPanel({
  profiles,
  canManage,
}: {
  profiles: ProfileOption[];
  canManage: boolean;
}) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testingCalendly, setTestingCalendly] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [providers, setProviders] = useState<BookingProviderStatus | null>(null);
  const [availability, setAvailability] = useState<StaffAvailabilityBlock[]>([]);
  const [calendlyToken, setCalendlyToken] = useState("");
  const [calendlySigningKey, setCalendlySigningKey] = useState("");
  const [bookingEmails, setBookingEmails] = useState<Record<string, string>>({});

  const bookableProfiles = profiles.filter(
    (p) => !p.role || BOOKABLE_ROLES.has(p.role)
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/settings");
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load");
      setSettings(data.settings);
      setProviders(data.providers);
      setAvailability(data.settings?.staff_availability ?? []);
      const emails: Record<string, string> = {};
      for (const p of profiles) {
        if (p.booking_email) emails[p.id] = p.booking_email;
      }
      setBookingEmails(emails);
    } catch {
      toast.error("Could not load booking settings");
    } finally {
      setLoading(false);
    }
  }, [profiles]);

  useEffect(() => {
    void load();
    if (searchParams.get("connected")) toast.success("Google Calendar connected");
    if (searchParams.get("error")) toast.error(`Connection failed: ${searchParams.get("error")}`);
  }, [load, searchParams]);

  async function save() {
    if (!settings || !canManage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bookings/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          staff_availability: availability,
          calendly_access_token: calendlyToken.trim() || undefined,
          calendly_webhook_signing_key: calendlySigningKey.trim() || undefined,
          profile_booking_emails: Object.fromEntries(
            Object.entries(bookingEmails).map(([id, email]) => [
              id,
              email.trim() || null,
            ])
          ),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setSettings(data.settings);
      setProviders(data.providers);
      setCalendlyToken("");
      setCalendlySigningKey("");
      toast.success("Booking settings saved");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function testGoogle() {
    setTestingGoogle(true);
    try {
      const res = await fetch("/api/bookings/google/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      toast.success("Google Calendar connection OK");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingGoogle(false);
    }
  }

  async function testCalendly() {
    setTestingCalendly(true);
    try {
      const res = await fetch("/api/bookings/calendly/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      toast.success(`Calendly connected${data.email ? ` (${data.email})` : ""}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingCalendly(false);
    }
  }

  async function disconnectGoogle() {
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
    return <p className="text-sm text-slate-500">Loading booking settings…</p>;
  }

  if (!settings) return null;

  const google = providers?.google;
  const calendly = providers?.calendly;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Default booking provider</Label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={settings.default_booking_provider}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_booking_provider: e.target.value as CalendarSettings["default_booking_provider"],
                })
              }
            >
              <option value="google_calendar">Google Calendar</option>
              <option value="calendly">Calendly</option>
              <option value="both">Both (prefer Google when available)</option>
            </select>
          </div>
          <div>
            <Label>Timezone</Label>
            <Input
              value={settings.timezone}
              disabled={!canManage}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            />
          </div>
          <div>
            <Label>Default meeting duration (min)</Label>
            <Input
              type="number"
              min={15}
              max={240}
              value={settings.default_meeting_duration_minutes}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_meeting_duration_minutes: Number(e.target.value) || 30,
                })
              }
            />
          </div>
          <div>
            <Label>Default assigned staff</Label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={settings.default_assigned_profile_id ?? ""}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_assigned_profile_id: e.target.value || null,
                })
              }
            >
              <option value="">Round-robin / auto</option>
              {bookableProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Leave empty to rotate among round-robin staff below (or all sales roles).
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Round-robin staff pool</Label>
            <p className="mb-2 text-xs text-slate-500">
              Order matters — bookings rotate through checked staff when no default assignee is set.
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-800 p-3">
              {bookableProfiles.length === 0 ? (
                <p className="text-sm text-slate-500">No bookable staff profiles found.</p>
              ) : (
                bookableProfiles.map((p) => {
                  const checked = (settings.round_robin_profile_ids ?? []).includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canManage}
                        onChange={(e) => {
                          const ids = settings.round_robin_profile_ids ?? [];
                          const next = e.target.checked
                            ? [...ids, p.id]
                            : ids.filter((id) => id !== p.id);
                          setSettings({ ...settings, round_robin_profile_ids: next });
                        }}
                      />
                      <span>{p.full_name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Staff calendar emails</Label>
            <p className="mb-2 text-xs text-slate-500">
              Added as attendees on Google Calendar bookings for the assigned rep.
            </p>
            <div className="space-y-2">
              {bookableProfiles.map((p) => (
                <div key={p.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-[8rem] text-sm text-slate-300">{p.full_name}</span>
                  <Input
                    type="email"
                    placeholder="rep@company.com"
                    className="flex-1"
                    disabled={!canManage}
                    value={bookingEmails[p.id] ?? ""}
                    onChange={(e) =>
                      setBookingEmails((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Buffer before (min)</Label>
            <Input
              type="number"
              min={0}
              value={settings.buffer_before_minutes}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  buffer_before_minutes: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <div>
            <Label>Buffer after (min)</Label>
            <Input
              type="number"
              min={0}
              value={settings.buffer_after_minutes}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  buffer_after_minutes: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <div>
            <Label>Minimum notice (hours)</Label>
            <Input
              type="number"
              min={0}
              value={settings.minimum_notice_hours}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minimum_notice_hours: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <div>
            <Label>Max days ahead</Label>
            <Input
              type="number"
              min={1}
              value={settings.maximum_days_ahead}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maximum_days_ahead: Number(e.target.value) || 60,
                })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={settings.enable_google_calendar}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({ ...settings, enable_google_calendar: e.target.checked })
              }
            />
            Enable Google Calendar
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={settings.enable_calendly}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({ ...settings, enable_calendly: e.target.checked })
              }
            />
            Enable Calendly
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={google?.connected ? "success" : "secondary"}>
              {google?.connected ? "Connected" : "Not connected"}
            </Badge>
            {google?.connected_email ? (
              <span className="text-sm text-slate-400">{google.connected_email}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {google?.oauth_configured && !google?.connected && canManage ? (
              <Button asChild>
                <a href="/api/platform/calendar/oauth/connect">Connect Google Calendar</a>
              </Button>
            ) : null}
            {google?.connected ? (
              <>
                <Button variant="outline" onClick={() => void testGoogle()} disabled={testingGoogle}>
                  {testingGoogle ? "Testing…" : "Test connection"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void disconnectGoogle()}
                  disabled={disconnecting || !canManage}
                >
                  Disconnect
                </Button>
              </>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Calendar ID</Label>
              <Input
                value={settings.calendar_id}
                disabled={!canManage}
                onChange={(e) => setSettings({ ...settings, calendar_id: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm pt-6">
              <input
                type="checkbox"
                checked={settings.enable_google_meet}
                disabled={!canManage}
                onChange={(e) =>
                  setSettings({ ...settings, enable_google_meet: e.target.checked })
                }
              />
              Add Google Meet link
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calendly</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={calendly?.connected ? "success" : "secondary"}>
              {calendly?.connected ? "Connected" : "Not connected"}
            </Badge>
            {calendly?.scheduling_url ? (
              <span className="text-sm text-slate-400 truncate max-w-md">
                {calendly.scheduling_url}
              </span>
            ) : null}
          </div>
          {canManage ? (
            <>
              <div>
                <Label>Personal access token</Label>
                <Input
                  type="password"
                  placeholder={
                    calendly?.token_configured ? "•••••••• (leave blank to keep)" : "Calendly PAT"
                  }
                  value={calendlyToken}
                  onChange={(e) => setCalendlyToken(e.target.value)}
                />
              </div>
              <div>
                <Label>Default scheduling URL</Label>
                <Input
                  value={settings.calendly_scheduling_url ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      calendly_scheduling_url: e.target.value || null,
                    })
                  }
                  placeholder="https://calendly.com/your-team/30min"
                />
              </div>
              <div>
                <Label>Webhook signing key</Label>
                <Input
                  type="password"
                  placeholder="From Calendly webhook subscription"
                  value={calendlySigningKey}
                  onChange={(e) => setCalendlySigningKey(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Webhook URL: <code className="text-cyan-300">/api/webhooks/calendly</code>
                </p>
              </div>
              <Button variant="outline" onClick={() => void testCalendly()} disabled={testingCalendly}>
                {testingCalendly ? "Testing…" : "Test Calendly connection"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Meeting types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(settings.meeting_types.length ? settings.meeting_types : DEFAULT_MEETING_TYPES).map(
            (m) => (
              <div
                key={m.key}
                className="rounded-lg border border-slate-800 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      disabled={!canManage}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          meeting_types: settings.meeting_types.map((t) =>
                            t.key === m.key ? { ...t, enabled: e.target.checked } : t
                          ),
                        })
                      }
                    />
                    {m.label}
                  </label>
                  <span className="text-xs text-slate-500">{m.duration_minutes} min</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <select
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                    value={m.provider}
                    disabled={!canManage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        meeting_types: settings.meeting_types.map((t) =>
                          t.key === m.key
                            ? {
                                ...t,
                                provider: e.target.value as typeof m.provider,
                              }
                            : t
                        ),
                      })
                    }
                  >
                    <option value="both">Both</option>
                    <option value="google_calendar">Google</option>
                    <option value="calendly">Calendly</option>
                  </select>
                  <Input
                    placeholder="Calendly event URL"
                    value={m.calendly_event_type_url ?? ""}
                    disabled={!canManage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        meeting_types: settings.meeting_types.map((t) =>
                          t.key === m.key
                            ? {
                                ...t,
                                calendly_event_type_url: e.target.value || null,
                              }
                            : t
                        ),
                      })
                    }
                  />
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Staff availability</CardTitle>
          {canManage ? (
            <Button type="button" variant="outline" size="sm" onClick={addAvailabilityBlock}>
              Add block
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {availability.map((block, idx) => (
            <div
              key={block.id}
              className="grid gap-2 sm:grid-cols-6 items-end rounded-lg border border-slate-800 p-3"
            >
              <div>
                <Label>Day</Label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  value={block.day_of_week}
                  disabled={!canManage}
                  onChange={(e) => {
                    const next = [...availability];
                    next[idx] = { ...block, day_of_week: Number(e.target.value) };
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
                  disabled={!canManage}
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
                  disabled={!canManage}
                  onChange={(e) => {
                    const next = [...availability];
                    next[idx] = { ...block, end_time: e.target.value };
                    setAvailability(next);
                  }}
                />
              </div>
              <label className="flex items-center gap-2 text-sm pb-2">
                <input
                  type="checkbox"
                  checked={block.available !== false}
                  disabled={!canManage}
                  onChange={(e) => {
                    const next = [...availability];
                    next[idx] = { ...block, available: e.target.checked };
                    setAvailability(next);
                  }}
                />
                Available
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {canManage ? (
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save booking settings"}
        </Button>
      ) : null}
    </div>
  );
}
