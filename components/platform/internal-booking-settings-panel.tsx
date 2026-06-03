"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BookingSettings } from "@/lib/booking/types";
import type { MeetingTypeRecord, StaffAvailabilityRecord } from "@/lib/booking/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ProfileOption = { id: string; full_name: string };

export function InternalBookingSettingsPanel({
  profiles,
  canManage,
}: {
  profiles: ProfileOption[];
  canManage: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeRecord[]>([]);
  const [availability, setAvailability] = useState<StaffAvailabilityRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/settings");
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load");
      setSettings(data.settings);
      setMeetingTypes(data.meetingTypes ?? []);
      setAvailability(data.staffAvailability ?? []);
    } catch {
      toast.error("Could not load booking settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!settings || !canManage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bookings/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, default_booking_provider: "internal" }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setSettings(data.settings);
      toast.success("Booking settings saved");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveMeetingType(mt: MeetingTypeRecord) {
    const res = await fetch("/api/bookings/meeting-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mt),
    });
    if (!res.ok) {
      toast.error("Could not save meeting type");
      return;
    }
    const data = await res.json();
    setMeetingTypes((prev) => {
      const idx = prev.findIndex((m) => m.id === data.meetingType.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = data.meetingType;
        return next;
      }
      return [...prev, data.meetingType];
    });
    toast.success("Meeting type saved");
  }

  async function saveAvailabilityRow(row: StaffAvailabilityRecord) {
    const res = await fetch("/api/bookings/staff-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      toast.error("Could not save availability");
      return;
    }
    const data = await res.json();
    setAvailability((prev) => {
      const idx = prev.findIndex((r) => r.id === data.availability.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = data.availability;
        return next;
      }
      return [...prev, data.availability];
    });
    toast.success("Availability saved");
  }

  function addAvailabilityBlock() {
    const staff = profiles[0];
    if (!staff || !settings) return;
    const row: StaffAvailabilityRecord = {
      id: crypto.randomUUID(),
      organization_id: settings.organization_id,
      staff_id: staff.id,
      day_of_week: 1,
      start_time: "09:00:00",
      end_time: "17:00:00",
      timezone: settings.timezone,
      is_available: true,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAvailability((prev) => [...prev, row]);
  }

  if (loading || !settings) {
    return <p className="text-sm text-slate-500">Loading booking settings…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Booking settings
            <Badge variant="secondary">Internal</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
            <Label>Slot interval (min)</Label>
            <Input
              type="number"
              min={5}
              value={settings.slot_interval_minutes}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  slot_interval_minutes: Number(e.target.value) || 30,
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
              <option value="">Auto / round-robin</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          {canManage && (
            <div className="sm:col-span-2">
              <Button onClick={() => void saveSettings()} disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {meetingTypes.map((mt) => (
            <div
              key={mt.id}
              className="grid gap-3 rounded-lg border border-slate-800 p-4 sm:grid-cols-2"
            >
              <div>
                <Label>Name</Label>
                <Input
                  value={mt.name}
                  disabled={!canManage}
                  onChange={(e) =>
                    setMeetingTypes((prev) =>
                      prev.map((m) =>
                        m.id === mt.id ? { ...m, name: e.target.value } : m
                      )
                    )
                  }
                />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={mt.duration_minutes}
                  disabled={!canManage}
                  onChange={(e) =>
                    setMeetingTypes((prev) =>
                      prev.map((m) =>
                        m.id === mt.id
                          ? { ...m, duration_minutes: Number(e.target.value) || 30 }
                          : m
                      )
                    )
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Input
                  value={mt.description ?? ""}
                  disabled={!canManage}
                  onChange={(e) =>
                    setMeetingTypes((prev) =>
                      prev.map((m) =>
                        m.id === mt.id ? { ...m, description: e.target.value } : m
                      )
                    )
                  }
                />
              </div>
              <div>
                <Label>Location</Label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={mt.location_type}
                  disabled={!canManage}
                  onChange={(e) =>
                    setMeetingTypes((prev) =>
                      prev.map((m) =>
                        m.id === mt.id
                          ? {
                              ...m,
                              location_type: e.target
                                .value as MeetingTypeRecord["location_type"],
                            }
                          : m
                      )
                    )
                  }
                >
                  <option value="phone_call">Phone call</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="office">Office</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={mt.status}
                  disabled={!canManage}
                  onChange={(e) =>
                    setMeetingTypes((prev) =>
                      prev.map((m) =>
                        m.id === mt.id
                          ? {
                              ...m,
                              status: e.target.value as MeetingTypeRecord["status"],
                            }
                          : m
                      )
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {canManage && (
                <div className="sm:col-span-2">
                  <Button size="sm" variant="outline" onClick={() => void saveMeetingType(mt)}>
                    Save {mt.name}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Staff availability</CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" onClick={addAvailabilityBlock}>
              Add block
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {availability.length === 0 ? (
            <p className="text-sm text-slate-500">
              No availability blocks yet. Add hours so customers can book slots.
            </p>
          ) : (
            availability.map((row) => (
              <div
                key={row.id}
                className="grid gap-2 rounded-lg border border-slate-800 p-3 sm:grid-cols-6"
              >
                <div>
                  <Label className="text-xs">Staff</Label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    value={row.staff_id}
                    disabled={!canManage}
                    onChange={(e) =>
                      setAvailability((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, staff_id: e.target.value } : r
                        )
                      )
                    }
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Day</Label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    value={row.day_of_week}
                    disabled={!canManage}
                    onChange={(e) =>
                      setAvailability((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? { ...r, day_of_week: Number(e.target.value) }
                            : r
                        )
                      )
                    }
                  >
                    {DAY_LABELS.map((label, i) => (
                      <option key={label} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={row.start_time.slice(0, 5)}
                    disabled={!canManage}
                    onChange={(e) =>
                      setAvailability((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? { ...r, start_time: `${e.target.value}:00` }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input
                    type="time"
                    value={row.end_time.slice(0, 5)}
                    disabled={!canManage}
                    onChange={(e) =>
                      setAvailability((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? { ...r, end_time: `${e.target.value}:00` }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.is_available}
                      disabled={!canManage}
                      onChange={(e) =>
                        setAvailability((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, is_available: e.target.checked } : r
                          )
                        )
                      }
                    />
                    Available
                  </label>
                </div>
                {canManage && (
                  <div className="flex items-end">
                    <Button size="sm" variant="outline" onClick={() => void saveAvailabilityRow(row)}>
                      Save
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
