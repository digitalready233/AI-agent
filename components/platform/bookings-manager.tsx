"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Booking } from "@/lib/platform/types";

export function BookingsManager({
  bookings: initial,
  profiles = [],
}: {
  bookings: Booking[];
  profiles?: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initial);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState({
    title: "",
    customer_name: "",
    customer_email: "",
    meeting_date: "",
    meeting_time: "",
    service_needed: "",
    status: "scheduled",
  });

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      customer_name: "",
      customer_email: "",
      meeting_date: "",
      meeting_time: "",
      service_needed: "",
      status: "scheduled",
    });
    setShowForm(true);
  }

  function openEdit(b: Booking) {
    setEditing(b);
    setForm({
      title: b.title,
      customer_name: b.customer_name ?? "",
      customer_email: b.customer_email ?? "",
      meeting_date: b.meeting_date ?? "",
      meeting_time: b.meeting_time ?? "",
      service_needed: b.service_needed ?? "",
      status: b.status,
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const res = await fetch("/api/platform/bookings", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: editing?.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Failed to save booking");
      return;
    }
    toast.success(editing ? "Booking updated" : "Booking created");
    setShowForm(false);
    if (editing) {
      setBookings((prev) => prev.map((b) => (b.id === data.booking.id ? data.booking : b)));
    } else {
      setBookings((prev) => [data.booking, ...prev]);
    }
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this booking?")) return;
    const res = await fetch(`/api/platform/bookings?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    setBookings((prev) => prev.filter((b) => b.id !== id));
    toast.success("Booking deleted");
    router.refresh();
  }

  async function cancelBooking(id: string) {
    const res = await fetch(`/api/platform/bookings?id=${id}&cancel=true`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Cancel failed");
      return;
    }
    const data = await res.json();
    setBookings((prev) => prev.map((b) => (b.id === id ? data.booking : b)));
    toast.success("Booking cancelled");
    router.refresh();
  }

  const filtered = bookings.filter((b) => {
    if (providerFilter !== "all" && (b.provider ?? "internal") !== providerFilter) {
      return false;
    }
    if (staffFilter !== "all" && b.assigned_to !== staffFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (dateFilter) {
      const d = b.starts_at?.slice(0, 10) ?? b.meeting_date ?? "";
      if (d !== dateFilter) return false;
    }
    return true;
  });

  const profileName = new Map(profiles.map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" className="w-[150px]" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          {profiles.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Staff</Label>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New booking
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? "Edit booking" : "New booking"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer name</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer email</Label>
              <Input
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.meeting_date}
                onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={form.meeting_time}
                onChange={(e) => setForm({ ...form, meeting_time: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Service</Label>
              <Input
                value={form.service_needed}
                onChange={(e) => setForm({ ...form, service_needed: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={save}>Save</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && !showForm ? (
        <p className="text-sm text-slate-500 text-center py-8">No bookings yet.</p>
      ) : (
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Provider</th>
                <th>Type</th>
                <th>Customer</th>
                <th>When</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium text-slate-100">
                    {b.title}
                    {b.meeting_link ? (
                      <a
                        href={b.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-cyan-400 hover:underline"
                      >
                        Join meeting
                      </a>
                    ) : null}
                    {(b.external_event_id || b.google_calendar_event_id) && (
                      <p className="text-xs text-slate-600 font-mono truncate max-w-[200px]">
                        {b.external_event_id ?? b.google_calendar_event_id}
                      </p>
                    )}
                    {b.conversation_id ? (
                      <a
                        href={`/dashboard/conversations?id=${b.conversation_id}`}
                        className="block text-xs text-slate-500 hover:text-cyan-400"
                      >
                        View conversation
                      </a>
                    ) : null}
                  </td>
                  <td>
                    <Badge variant="outline">
                      {b.provider === "internal" || !b.provider
                        ? "Internal"
                        : b.provider}
                    </Badge>
                  </td>
                  <td className="text-slate-400 text-sm">
                    {b.meeting_type?.replace(/_/g, " ") ?? b.service_needed ?? "—"}
                  </td>
                  <td className="text-slate-300">
                    {b.customer_name ?? "—"}
                    {b.customer_email && (
                      <p className="text-xs text-slate-500">{b.customer_email}</p>
                    )}
                    {b.lead_id && (
                      <a href={`/dashboard/leads`} className="block text-xs text-cyan-400 hover:underline">
                        View lead
                      </a>
                    )}
                    {b.assigned_to && profileName.get(b.assigned_to) && (
                      <p className="text-xs text-slate-500">{profileName.get(b.assigned_to)}</p>
                    )}
                  </td>
                  <td className="text-slate-300">
                    {b.starts_at
                      ? new Date(b.starts_at).toLocaleString()
                      : [b.meeting_date, b.meeting_time].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td>
                    <Badge
                      variant={
                        b.status === "confirmed" || b.status === "completed"
                          ? "success"
                          : b.status === "cancelled"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                        Edit
                      </Button>
                      {b.status !== "cancelled" && (
                        <Button size="sm" variant="secondary" onClick={() => void cancelBooking(b.id)}>
                          Cancel
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
