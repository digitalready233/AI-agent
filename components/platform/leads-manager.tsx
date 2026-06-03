"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MonitorPlay, Plus } from "lucide-react";
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
import type { Lead, LeadCategory, LeadStatus, Profile } from "@/lib/platform/types";
import { formatLeadCategory, formatLeadStatus, LEAD_CATEGORY_LABELS, LEAD_STATUS_LABELS } from "@/lib/platform/sales-ops";

type AgentOption = { id: string; name: string };

export function LeadsManager({
  leads: initial,
  profiles,
  agents,
}: {
  leads: Lead[];
  profiles: Profile[];
  agents: AgentOption[];
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [demoLead, setDemoLead] = useState<Lead | null>(null);
  const [demoAgentId, setDemoAgentId] = useState(agents[0]?.id ?? "");
  const [demoLinkLoading, setDemoLinkLoading] = useState(false);
  const [lastDemoLink, setLastDemoLink] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    service_interest: "",
    lead_category: "warm",
    lead_status: "created",
    assigned_to: "",
    do_not_call: false,
  });

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (l.full_name?.toLowerCase().includes(q) ?? false) ||
        (l.email?.toLowerCase().includes(q) ?? false) ||
        (l.service_interest?.toLowerCase().includes(q) ?? false);
      const matchesCategory = category === "all" || l.lead_category === category;
      const matchesStatus = status === "all" || l.lead_status === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [leads, search, category, status]);

  function openCreate() {
    setEditing(null);
    setForm({
      full_name: "",
      email: "",
      phone: "",
      service_interest: "",
      lead_category: "warm",
      lead_status: "created",
      assigned_to: "",
      do_not_call: false,
    });
    setShowForm(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setForm({
      full_name: lead.full_name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      service_interest: lead.service_interest ?? "",
      lead_category: lead.lead_category ?? "warm",
      lead_status: lead.lead_status,
      assigned_to: lead.assigned_to ?? "",
      do_not_call: Boolean(lead.do_not_call),
    });
    setShowForm(true);
  }

  async function save() {
    const payload = {
      ...form,
      id: editing?.id,
      assigned_to: form.assigned_to || null,
    };
    const res = await fetch("/api/platform/leads", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Failed to save lead");
      return;
    }
    toast.success(editing ? "Lead updated" : "Lead created");
    setShowForm(false);
    if (editing) {
      setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)));
    } else {
      setLeads((prev) => [data.lead, ...prev]);
    }
    router.refresh();
  }

  async function sendDemoLink(lead: Lead) {
    if (!demoAgentId) {
      toast.error("Select a sales agent for the demo");
      return;
    }
    setDemoLinkLoading(true);
    setLastDemoLink(null);
    try {
      const res = await fetch(`/api/platform/leads/${lead.id}/demo-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: demoAgentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create demo link");
      const url = data.share_url ?? data.room_url;
      setLastDemoLink(url);
      try {
        await navigator.clipboard.writeText(
          url.startsWith("http") ? url : `${window.location.origin}${url}`
        );
        toast.success("Demo link copied to clipboard");
      } catch {
        toast.success("Demo link created");
      }
      setDemoLead(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create demo link");
    } finally {
      setDemoLinkLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this lead?")) return;
    const res = await fetch(`/api/platform/leads?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
    toast.success("Lead deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(Object.keys(LEAD_CATEGORY_LABELS) as LeadCategory[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {LEAD_CATEGORY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {LEAD_STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add lead
        </Button>
      </div>

      {demoLead && (
        <Card className="border-violet-500/25 bg-violet-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MonitorPlay className="h-4 w-4 text-violet-400" />
              Send demo link — {demoLead.full_name ?? "Lead"}
            </CardTitle>
            <p className="text-sm text-slate-500">
              Creates a browser demo room linked to this lead. The link is copied to your
              clipboard to paste into email or WhatsApp.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2 min-w-[200px]">
              <Label>Demo agent</Label>
              <Select value={demoAgentId} onValueChange={setDemoAgentId}>
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
            <Button
              onClick={() => void sendDemoLink(demoLead)}
              disabled={demoLinkLoading || agents.length === 0}
            >
              {demoLinkLoading ? "Creating…" : "Create & copy link"}
            </Button>
            <Button variant="outline" onClick={() => setDemoLead(null)}>
              Cancel
            </Button>
            {lastDemoLink && (
              <p className="w-full text-xs text-slate-500 break-all">
                Last link: {lastDemoLink.startsWith("http") ? lastDemoLink : `${typeof window !== "undefined" ? window.location.origin : ""}${lastDemoLink}`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? "Edit lead" : "New lead"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Service interest</Label>
              <Input
                value={form.service_interest}
                onChange={(e) => setForm({ ...form, service_interest: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.lead_category}
                onValueChange={(v) => setForm({ ...form, lead_category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEAD_CATEGORY_LABELS) as LeadCategory[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {LEAD_CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.lead_status}
                onValueChange={(v) => setForm({ ...form, lead_status: v as LeadStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {LEAD_STATUS_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select
                value={form.assigned_to || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, assigned_to: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500/40"
                  checked={form.do_not_call}
                  onChange={(e) =>
                    setForm({ ...form, do_not_call: e.target.checked })
                  }
                />
                <span>
                  <span className="text-sm font-medium text-slate-100 block">
                    Do not call
                  </span>
                  <span className="text-xs text-slate-500">
                    Blocks outbound voice campaigns and AI dialing. Also opts the
                    lead out of marketing outreach.
                  </span>
                </span>
              </label>
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

      <div className="platform-table-wrap">
        <table className="platform-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Interest</th>
              <th>Category</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No leads match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium text-slate-100">
                    <span className="inline-flex items-center gap-2 flex-wrap">
                      {l.full_name ?? "—"}
                      {l.do_not_call && (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px]">
                          DNC
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="text-slate-400">{l.service_interest ?? "—"}</td>
                  <td>
                    <Badge variant={l.lead_category === "hot" ? "destructive" : "secondary"}>
                      {formatLeadCategory(l.lead_category)}
                    </Badge>
                  </td>
                  <td className="text-slate-400">{formatLeadStatus(l.lead_status)}</td>
                  <td>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-violet-500/30 text-violet-300"
                        onClick={() => {
                          setDemoLead(l);
                          setDemoAgentId(agents[0]?.id ?? "");
                        }}
                        disabled={agents.length === 0}
                      >
                        <MonitorPlay className="h-3.5 w-3.5 mr-1" />
                        Demo link
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(l)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        Showing {filtered.length} of {leads.length} leads
      </p>
    </div>
  );
}
