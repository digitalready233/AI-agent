"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { WhatsAppMessageTemplate, WhatsAppSettings } from "@/lib/whatsapp/types";

type AgentOption = { id: string; name: string };

export function WhatsAppSettingsPanel({ agents }: { agents: AgentOption[] }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    webhook_url: string;
    webhook_url_alt?: string;
    has_access_token: boolean;
    has_verify_token?: boolean;
    connection_status?: string;
    last_tested_at?: string | null;
    business_phone_number?: string | null;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [templateForm, setTemplateForm] = useState({
    name: "",
    meta_template_name: "",
    body_preview: "",
    category: "marketing" as const,
  });
  const [addingTemplate, setAddingTemplate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/whatsapp/status");
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load WhatsApp settings");
      setStatus(data.status);
      setSettings(data.settings);
    } catch {
      toast.error("Could not load WhatsApp settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!settings?.phone_number_id.trim()) {
      toast.error("Phone number ID is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/platform/whatsapp/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number_id: settings.phone_number_id,
          waba_id: settings.waba_id,
          business_phone_number: settings.business_phone_number,
          default_agent_id: settings.default_agent_id,
          webhook_verify_token: settings.webhook_verify_token,
          webhook_callback_url: settings.webhook_callback_url,
          access_token: accessToken.trim() || undefined,
          verify_token: verifyToken.trim() || undefined,
          message_templates: settings.message_templates,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("WhatsApp settings saved");
      setAccessToken("");
      setVerifyToken("");
      await load();
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/platform/whatsapp/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Connection test failed");
      } else {
        toast.success("WhatsApp connection verified");
      }
      if (data.status) setStatus(data.status);
      if (data.settings) setSettings(data.settings);
    } catch {
      toast.error("Could not run connection test");
    } finally {
      setTesting(false);
    }
  }

  async function addTemplate() {
    if (!templateForm.name.trim() || !templateForm.body_preview.trim()) {
      toast.error("Template name and body preview are required");
      return;
    }
    setAddingTemplate(true);
    try {
      const res = await fetch("/api/platform/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...templateForm,
          meta_template_name: templateForm.meta_template_name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to add template");
      setSettings((s) =>
        s ? { ...s, message_templates: data.templates as WhatsAppMessageTemplate[] } : s
      );
      setTemplateForm({
        name: "",
        meta_template_name: "",
        body_preview: "",
        category: "marketing",
      });
      toast.success("Template draft saved");
    } catch {
      toast.error("Could not add template");
    } finally {
      setAddingTemplate(false);
    }
  }

  async function updateTemplate(
    id: string,
    patch: { status?: WhatsAppMessageTemplate["status"]; meta_template_name?: string | null }
  ) {
    const res = await fetch("/api/platform/whatsapp/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      toast.error("Could not update template");
      return;
    }
    const data = await res.json();
    setSettings((s) =>
      s ? { ...s, message_templates: data.templates as WhatsAppMessageTemplate[] } : s
    );
    toast.success("Template updated");
  }

  async function removeTemplate(id: string) {
    const res = await fetch(`/api/platform/whatsapp/templates?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove template");
      return;
    }
    const data = await res.json();
    setSettings((s) =>
      s ? { ...s, message_templates: data.templates as WhatsAppMessageTemplate[] } : s
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading WhatsApp settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/integrations" className="text-cyan-400 hover:underline">
          Integrations
        </Link>
        <span>/</span>
        <span>WhatsApp</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-400">
          <p>
            In Meta Developer Console, set your webhook URL and verify token. Set{" "}
            <code className="text-cyan-300">WHATSAPP_APP_SECRET</code> in your server env so
            inbound POSTs are verified via <code className="text-cyan-300">X-Hub-Signature-256</code>
            . Credentials stay server-side only.
          </p>
          <div>
            <Label className="text-slate-500">Callback URL (primary)</Label>
            <code className="mt-1 block rounded-lg bg-slate-900/80 px-3 py-2 text-xs text-cyan-200 break-all">
              {status?.webhook_url ?? "/api/whatsapp/webhook"}
            </code>
          </div>
          {status?.webhook_url_alt && (
            <div>
              <Label className="text-slate-500">Alternate URL (alias)</Label>
              <code className="mt-1 block rounded-lg bg-slate-900/80 px-3 py-2 text-xs text-slate-400 break-all">
                {status.webhook_url_alt}
              </code>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                status?.connection_status === "connected"
                  ? "success"
                  : status?.connection_status === "error"
                    ? "destructive"
                    : "secondary"
              }
            >
              {status?.connection_status === "connected"
                ? "Connected"
                : status?.connection_status === "error"
                  ? "Connection error"
                  : "Not connected"}
            </Badge>
            <Badge variant={status?.configured ? "success" : "secondary"}>
              {status?.configured ? "Ready for inbound" : "Incomplete setup"}
            </Badge>
          </div>
          {status?.last_tested_at && (
            <p className="text-xs text-slate-500">
              Last tested: {new Date(status.last_tested_at).toLocaleString()}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testing || !settings?.phone_number_id}
            onClick={() => void testConnection()}
          >
            {testing ? "Testing…" : "Test WhatsApp connection"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API credentials</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Access token</Label>
            <Input
              type="password"
              placeholder={
                status?.has_access_token ? "•••••••• (leave blank to keep)" : "Permanent token from Meta"
              }
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <div>
            <Label>Phone number ID</Label>
            <Input
              value={settings?.phone_number_id ?? ""}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, phone_number_id: e.target.value } : s))
              }
            />
          </div>
          <div>
            <Label>Business phone number</Label>
            <Input
              placeholder="+1 555 0100 or filled by connection test"
              value={settings?.business_phone_number ?? ""}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, business_phone_number: e.target.value || null } : s
                )
              }
            />
          </div>
          <div>
            <Label>WhatsApp Business Account ID</Label>
            <Input
              value={settings?.waba_id ?? ""}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, waba_id: e.target.value || null } : s))
              }
            />
          </div>
          <div>
            <Label>Webhook verify token</Label>
            <Input
              type="password"
              placeholder="Same value as in Meta webhook setup"
              value={settings?.webhook_verify_token ?? verifyToken}
              onChange={(e) => {
                setVerifyToken(e.target.value);
                setSettings((s) =>
                  s ? { ...s, webhook_verify_token: e.target.value } : s
                );
              }}
            />
          </div>
          <div>
            <Label>Default AI agent</Label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={settings?.default_agent_id ?? ""}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? { ...s, default_agent_id: e.target.value || null }
                    : s
                )
              }
            >
              <option value="">Auto (first WhatsApp-enabled agent)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save credentials"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Message templates (campaigns)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Link drafts to Meta-approved template names for campaign sends. Set status to approved
            and add the template id to campaign follow-up rules as whatsapp_template_id.
          </p>
          {settings?.message_templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3"
            >
              <div>
                <p className="font-medium text-slate-200">{t.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {t.category} · {t.language} · {t.status}
                  {t.meta_template_name ? ` · Meta: ${t.meta_template_name}` : ""}
                </p>
                <p className="text-xs text-slate-600 mt-1 font-mono">id: {t.id}</p>
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">{t.body_preview}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {t.status !== "approved" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void updateTemplate(t.id, { status: "approved" })}
                  >
                    Mark approved
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeTemplate(t.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-2 border-t border-slate-800 pt-4">
            <div>
              <Label>Display name</Label>
              <Input
                value={templateForm.name}
                onChange={(e) =>
                  setTemplateForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Promo follow-up"
              />
            </div>
            <div>
              <Label>Meta template name</Label>
              <Input
                value={templateForm.meta_template_name}
                onChange={(e) =>
                  setTemplateForm((f) => ({ ...f, meta_template_name: e.target.value }))
                }
                placeholder="promo_follow_up"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Body preview</Label>
              <Input
                value={templateForm.body_preview}
                onChange={(e) =>
                  setTemplateForm((f) => ({ ...f, body_preview: e.target.value }))
                }
                placeholder="Hi {{name}}, thanks for your interest…"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={addingTemplate}
              onClick={() => void addTemplate()}
            >
              {addingTemplate ? "Adding…" : "Add template draft"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
