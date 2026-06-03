"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreateDemoMultiAgentFields,
  createDemoMultiAgentPayload,
  emptyMultiAgentState,
  type CreateDemoMultiAgentState,
} from "@/components/platform/create-demo-multi-agent-fields";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Plus } from "lucide-react";

/** Above dialog (z-50) so dropdowns are not trapped under the overlay. */
const MODAL_SELECT_CONTENT_CLASS = "z-[100]";

type AgentOption = {
  id: string;
  name: string;
  operational_role?: string | null;
};
type LeadOption = { id: string; full_name: string | null; email: string | null };

export function CreateDemoSessionModal({
  agents,
  leads,
  onCreated,
}: {
  agents: AgentOption[];
  leads: LeadOption[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("Product demo");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [leadId, setLeadId] = useState<string>("none");
  const [demoType, setDemoType] = useState("product");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [multiAgent, setMultiAgent] = useState<CreateDemoMultiAgentState>(() =>
    emptyMultiAgentState(agents[0]?.id ?? "")
  );
  const [orgMultiAgentEnabled, setOrgMultiAgentEnabled] = useState<boolean | null>(
    null
  );

  const resetForm = useCallback(() => {
    const defaultAgent = agents[0]?.id ?? "";
    setShareUrl(null);
    setTitle("Product demo");
    setAgentId(defaultAgent);
    setLeadId("none");
    setDemoType("product");
    setScheduledAt("");
    setNotes("");
    setMultiAgent(emptyMultiAgentState(defaultAgent));
    setSaving(false);
  }, [agents]);

  useEffect(() => {
    if (!open) return;
    setOrgMultiAgentEnabled(null);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/platform/settings/demo-room", {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        setOrgMultiAgentEnabled(
          res.ok && data.settings?.multi_agent?.enabled === true
        );
      } catch {
        if (!cancelled) setOrgMultiAgentEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      resetForm();
      return;
    }
    if (!saving) {
      resetForm();
      setOrgMultiAgentEnabled(null);
    }
  }

  async function handleCreate() {
    if (!agentId) {
      toast.error("Select an AI agent");
      return;
    }
    setSaving(true);
    setShareUrl(null);
    try {
      const body: Record<string, string | boolean> = {
        agent_id: agentId,
        title: title.trim() || "Product demo",
        demo_type: demoType,
      };
      if (leadId !== "none") body.lead_id = leadId;
      if (scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString();
      if (notes.trim()) body.admin_notes = notes.trim();
      Object.assign(body, createDemoMultiAgentPayload(multiAgent));

      const res = await fetch("/api/platform/demo/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");

      const url =
        data.share_url ??
        (typeof window !== "undefined"
          ? `${window.location.origin}${data.room_url}`
          : data.room_url);
      setShareUrl(url);
      toast.success("Demo session created");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    toast.success("Demo link copied");
  }

  function close() {
    setOpen(false);
    resetForm();
    setOrgMultiAgentEnabled(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" onClick={() => handleOpenChange(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Create demo session
      </Button>
      <DialogContent
        showCloseButton
        className="z-[60] max-h-[min(90vh,720px)] border-slate-700 bg-slate-900 p-0 gap-0 overflow-hidden sm:max-w-lg"
        onPointerDownOutside={(e) => {
          if (saving) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (saving) e.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-slate-800 px-6 py-4 text-left">
          <DialogTitle className="text-white">
            {shareUrl ? "Demo link ready" : "Create demo session"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto overscroll-contain px-6 py-4 space-y-4 max-h-[calc(min(90vh,720px)-5rem)]">
          {shareUrl ? (
            <>
              <p className="text-sm text-slate-400">
                Share this link. Status is <strong>scheduled</strong>.
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="bg-slate-950 border-slate-700 text-xs"
                />
                <Button type="button" variant="outline" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(shareUrl, "_blank")}
                >
                  Open demo room
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-violet-500/40"
                  onClick={() => {
                    const base = shareUrl.startsWith("http")
                      ? shareUrl
                      : `${window.location.origin}${shareUrl.startsWith("/") ? shareUrl : `/${shareUrl}`}`;
                    const u = new URL(base);
                    u.searchParams.set("staff", "1");
                    window.open(u.toString(), "_blank");
                  }}
                >
                  Open as admin (staff)
                </Button>
                <Button type="button" onClick={close}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Demo title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-950 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label>AI agent</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="bg-slate-950 border-slate-700">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent className={MODAL_SELECT_CONTENT_CLASS}>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead (optional)</Label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger className="bg-slate-950 border-slate-700">
                    <SelectValue placeholder="No lead linked" />
                  </SelectTrigger>
                  <SelectContent className={MODAL_SELECT_CONTENT_CLASS}>
                    <SelectItem value="none">No lead linked</SelectItem>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.full_name ?? l.email ?? l.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Demo type</Label>
                  <Select value={demoType} onValueChange={setDemoType}>
                    <SelectTrigger className="bg-slate-950 border-slate-700">
                      <SelectValue placeholder="Demo type" />
                    </SelectTrigger>
                    <SelectContent className={MODAL_SELECT_CONTENT_CLASS}>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scheduled</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="bg-slate-950 border-slate-700"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-950 border-slate-700 min-h-[80px]"
                />
              </div>
              <CreateDemoMultiAgentFields
                agents={agents}
                primaryAgentId={agentId}
                value={multiAgent}
                onChange={setMultiAgent}
                orgMultiAgentEnabled={orgMultiAgentEnabled}
              />
              <Button
                className="w-full"
                onClick={() => void handleCreate()}
                disabled={saving || orgMultiAgentEnabled === null}
              >
                {saving ? "Creating…" : "Create & get link"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
