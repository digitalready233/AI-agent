"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEMPLATE_VARIABLES } from "@/lib/platform/campaign-types";
import type { MessageTemplate, MessageTemplateStatus } from "@/lib/platform/campaign-types";

export function MessageTemplatesManager() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState(
    "Hi {{full_name}}, this is {{company_name}} following up on {{service_interest}}."
  );
  const [channel, setChannel] = useState("whatsapp");
  const [whatsappName, setWhatsappName] = useState("");
  const [status, setStatus] = useState<MessageTemplateStatus>("draft");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/platform/message-templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      toast.error("Name and body are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/platform/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          body: body.trim(),
          channel,
          whatsapp_template_name: whatsappName.trim() || null,
          status,
          variables: [...TEMPLATE_VARIABLES],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Template saved");
      setName("");
      setWhatsappName("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New message template</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="voice">Voice (outbound calls)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as MessageTemplateStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp template name (Meta)</Label>
              <Input
                value={whatsappName}
                onChange={(e) => setWhatsappName(e.target.value)}
                placeholder="hello_world"
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-slate-500">{TEMPLATE_VARIABLES.join(" ")}</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save template"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500">No templates yet.</p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium text-white">{t.name}</p>
                  <span className="text-xs text-slate-500 uppercase">{t.status}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {t.channel}
                  {t.whatsapp_template_name ? ` · ${t.whatsapp_template_name}` : ""}
                </p>
                <p className="text-sm text-slate-400 mt-2 line-clamp-3">{t.body}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
