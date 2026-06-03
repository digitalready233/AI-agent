"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import {
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  parseFollowUpRules,
} from "@/lib/platform/campaign-types";
import type { MessageTemplate } from "@/lib/platform/campaign-types";
import type { Agent, Campaign, CampaignStatus, Lead } from "@/lib/platform/types";
import {
  CampaignStepsEditor,
  defaultSteps,
  type CampaignStepDraft,
} from "@/components/platform/campaign-steps-editor";
import { VoiceCampaignWorkflow } from "@/components/platform/voice-campaign-workflow";

type FormState = {
  name: string;
  agent_id: string;
  campaign_type: string;
  status: CampaignStatus;
  scheduled_at: string;
  message_template: string;
  delay_hours: string;
  max_attempts: string;
  retry_delay_minutes: string;
  max_concurrent_calls: string;
  human_transfer_phone: string;
  voicemail_behavior: "leave_message" | "hangup" | "retry";
  channel_mode: "whatsapp" | "email" | "both" | "auto" | "";
  whatsapp_template_id: string;
  outbound_channel: string;
  use_sequence: boolean;
  lead_status_filter: string;
  lead_ids: string[];
  steps: CampaignStepDraft[];
};

type WhatsAppTemplateOption = {
  id: string;
  name: string;
  meta_template_name: string | null;
  language: string;
  body_preview: string;
};

function campaignToForm(campaign: Campaign, leadIds: string[]): FormState {
  const rules = parseFollowUpRules(campaign.follow_up_rules);
  const vs =
    (campaign.voice_settings as import("@/lib/voice/types").OutboundVoiceCampaignSettings) ??
    rules.voice_settings ??
    {};
  return {
    name: campaign.name,
    agent_id: campaign.agent_id ?? "",
    campaign_type: campaign.campaign_type ?? "follow_up",
    status: campaign.status,
    scheduled_at: campaign.scheduled_at
      ? new Date(campaign.scheduled_at).toISOString().slice(0, 16)
      : "",
    message_template: rules.message_template ?? "",
    delay_hours: rules.delay_hours != null ? String(rules.delay_hours) : "24",
    max_attempts: rules.max_attempts != null ? String(rules.max_attempts) : "3",
    retry_delay_minutes:
      rules.retry_delay_minutes != null
        ? String(rules.retry_delay_minutes)
        : rules.delay_hours != null
          ? String(rules.delay_hours * 60)
          : "240",
    max_concurrent_calls:
      rules.max_concurrent_calls != null ? String(rules.max_concurrent_calls) : "2",
    human_transfer_phone: vs.human_transfer_phone ?? "",
    voicemail_behavior: vs.voicemail_behavior ?? "retry",
    channel_mode:
      rules.channel === "sms"
        ? ""
        : (rules.channel as FormState["channel_mode"]) ?? "",
    whatsapp_template_id: rules.whatsapp_template_id ?? "",
    outbound_channel: campaign.channel ?? "whatsapp",
    use_sequence: campaign.use_sequence ?? false,
    lead_status_filter: "",
    lead_ids: leadIds,
    steps: defaultSteps(),
  };
}

const defaultForm = (): FormState => ({
  name: "",
  agent_id: "",
  campaign_type: "follow_up",
  status: "draft",
  scheduled_at: "",
  message_template: "",
  delay_hours: "24",
  max_attempts: "3",
  retry_delay_minutes: "240",
  max_concurrent_calls: "2",
  human_transfer_phone: "",
  voicemail_behavior: "retry",
  channel_mode: "",
  whatsapp_template_id: "",
  outbound_channel: "whatsapp",
  use_sequence: true,
  lead_status_filter: "",
  lead_ids: [],
  steps: defaultSteps(),
});

export function CampaignBuilderForm({
  campaign,
  initialLeadIds = [],
  agents,
  leads,
  defaultVoice = false,
}: {
  campaign?: Campaign | null;
  initialLeadIds?: string[];
  agents: Agent[];
  leads: Lead[];
  /** Pre-select voice channel (SalesCloser outbound calls) */
  defaultVoice?: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(campaign?.id);
  const [form, setForm] = useState<FormState>(() => {
    if (campaign) return campaignToForm(campaign, initialLeadIds);
    const base = defaultForm();
    if (defaultVoice) {
      return {
        ...base,
        outbound_channel: "voice",
        campaign_type: "outbound_voice_campaign",
        message_template:
          "Hi {{full_name}}, this is {{company_name}} calling about {{service_interest}}. Do you have a moment to chat?",
      };
    }
    return base;
  });
  const [leadSearch, setLeadSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<MessageTemplate[]>([]);
  const [audiencePreview, setAudiencePreview] = useState<number | null>(null);

  const isVoiceChannel =
    form.outbound_channel === "voice" || form.outbound_channel === "voice_future";

  const showWhatsAppTemplate =
    !isVoiceChannel &&
    (form.outbound_channel === "whatsapp" ||
      form.channel_mode === "whatsapp" ||
      form.channel_mode === "both" ||
      form.channel_mode === "");

  useEffect(() => {
    if (!showWhatsAppTemplate) return;
    let cancelled = false;
    setWaTemplatesLoading(true);
    void fetch("/api/platform/campaigns/whatsapp-templates")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.templates)) {
          setWaTemplates(data.templates);
        }
      })
      .catch(() => {
        if (!cancelled) setWaTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setWaTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showWhatsAppTemplate]);

  useEffect(() => {
    void fetch("/api/platform/message-templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.templates)) setSavedTemplates(data.templates);
      })
      .catch(() => setSavedTemplates([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !campaign?.id) return;
    void fetch(`/api/platform/campaigns/${campaign.id}/steps`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.steps) && data.steps.length) {
          setForm((p) => ({
            ...p,
            use_sequence: true,
            steps: data.steps.map(
              (s: {
                step_order: number;
                delay_amount: number;
                delay_unit: CampaignStepDraft["delay_unit"];
                message_template_id?: string | null;
                message_body?: string | null;
                stop_on_reply?: boolean;
                mark_no_response?: boolean;
              }) => ({
                step_order: s.step_order,
                delay_amount: s.delay_amount,
                delay_unit: s.delay_unit,
                message_template_id: s.message_template_id ?? "",
                message_body: s.message_body ?? "",
                stop_on_reply: s.stop_on_reply ?? true,
                mark_no_response: s.mark_no_response ?? false,
              })
            ),
          }));
        }
      })
      .catch(() => undefined);
  }, [isEdit, campaign?.id]);

  const selectedWaTemplate = waTemplates.find((t) => t.id === form.whatsapp_template_id);

  const selectableAgents = useMemo(() => {
    if (!isVoiceChannel) return agents.filter((a) => a.enabled);
    return agents.filter(
      (a) =>
        a.enabled &&
        (a.channels?.includes("voice") || !a.channels?.length || a.channels.length === 0)
    );
  }, [agents, isVoiceChannel]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.toLowerCase();
    return leads.filter((l) => {
      if (l.do_not_call) return false;
      if (isVoiceChannel && (l.phone ?? "").replace(/\D/g, "").length < 9) {
        return false;
      }
      if (!q) return true;
      return (
        (l.full_name?.toLowerCase().includes(q) ?? false) ||
        (l.email?.toLowerCase().includes(q) ?? false) ||
        (l.phone?.includes(q) ?? false)
      );
    });
  }, [leads, leadSearch, isVoiceChannel]);

  function toggleLead(id: string) {
    setForm((prev) => ({
      ...prev,
      lead_ids: prev.lead_ids.includes(id)
        ? prev.lead_ids.filter((x) => x !== id)
        : [...prev.lead_ids, id],
    }));
  }

  function selectAllVisible() {
    const ids = filteredLeads.map((l) => l.id);
    setForm((prev) => ({
      ...prev,
      lead_ids: [...new Set([...prev.lead_ids, ...ids])],
    }));
  }

  function clearLeads() {
    setForm((prev) => ({ ...prev, lead_ids: [] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (!form.agent_id) {
      toast.error("Select an agent for this campaign");
      return;
    }

    if (isVoiceChannel) {
      const withPhone = leads.filter(
        (l) =>
          form.lead_ids.includes(l.id) &&
          (l.phone ?? "").replace(/\D/g, "").length >= 9
      );
      if (withPhone.length === 0) {
        toast.error("Voice campaigns need at least one lead with a valid phone number");
        return;
      }
    }

    setSaving(true);
    try {
      const body = {
        id: campaign?.id,
        name: form.name.trim(),
        agent_id: form.agent_id,
        campaign_type: form.campaign_type,
        status: form.status,
        scheduled_at: form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : null,
        channel: form.outbound_channel,
        use_sequence: form.use_sequence,
        audience_filters: {
          lead_statuses: form.lead_status_filter
            ? [form.lead_status_filter]
            : undefined,
          manual_lead_ids: form.lead_ids,
        },
        voice_settings: isVoiceChannel
          ? {
              max_attempts: form.max_attempts ? Number(form.max_attempts) : 3,
              retry_delay_minutes: form.retry_delay_minutes
                ? Number(form.retry_delay_minutes)
                : 240,
              voicemail_behavior: form.voicemail_behavior,
              human_transfer_phone: form.human_transfer_phone.trim() || null,
              max_concurrent_calls: form.max_concurrent_calls
                ? Number(form.max_concurrent_calls)
                : 2,
            }
          : undefined,
        follow_up_rules: {
          message_template: form.message_template.trim() || undefined,
          delay_hours: form.delay_hours ? Number(form.delay_hours) : undefined,
          max_attempts: form.max_attempts ? Number(form.max_attempts) : undefined,
          retry_delay_minutes: form.retry_delay_minutes
            ? Number(form.retry_delay_minutes)
            : undefined,
          max_concurrent_calls: form.max_concurrent_calls
            ? Number(form.max_concurrent_calls)
            : undefined,
          voice_settings: isVoiceChannel
            ? {
                max_attempts: form.max_attempts ? Number(form.max_attempts) : 3,
                retry_delay_minutes: form.retry_delay_minutes
                  ? Number(form.retry_delay_minutes)
                  : 240,
                voicemail_behavior: form.voicemail_behavior,
                human_transfer_phone: form.human_transfer_phone.trim() || null,
                max_concurrent_calls: form.max_concurrent_calls
                  ? Number(form.max_concurrent_calls)
                  : 2,
              }
            : undefined,
          channel:
            form.channel_mode === "email"
              ? "email"
              : form.channel_mode === "whatsapp"
                ? "whatsapp"
                : form.channel_mode === "both"
                  ? "both"
                  : form.channel_mode === "auto"
                    ? "auto"
                    : undefined,
          whatsapp_template_id: form.whatsapp_template_id || undefined,
        },
        lead_ids: form.lead_ids,
        steps: form.use_sequence
          ? form.steps.map((s) => ({
              ...s,
              message_template_id: s.message_template_id || null,
              message_body: s.message_body || null,
            }))
          : undefined,
      };

      const res = await fetch("/api/platform/campaigns", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? "Save failed");

      toast.success(isEdit ? "Campaign updated" : "Campaign created");
      router.push("/dashboard/campaigns");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      {isVoiceChannel && (
        <VoiceCampaignWorkflow
          hasLeads={form.lead_ids.length > 0}
          hasAgent={Boolean(form.agent_id)}
          campaignSaved={isEdit}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Q2 warm lead follow-up"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>AI sales agent</Label>
            <Select
              value={form.agent_id || undefined}
              onValueChange={(v) => setForm((p) => ({ ...p, agent_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {selectableAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.campaign_type}
                onValueChange={(v) => setForm((p) => ({ ...p, campaign_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, status: v as CampaignStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduled">Schedule start (optional)</Label>
              <Input
                id="scheduled"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Outbound channel</Label>
              <Select
                value={form.outbound_channel}
                onValueChange={(v) => setForm((p) => ({ ...p, outbound_channel: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isVoiceChannel && (
                <p className="text-xs text-slate-500">
                  AI calls each lead on the schedule. Opening line uses your message
                  template below. Requires Twilio voice under Integrations → Voice.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience — leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Filter by lead status</Label>
              <Select
                value={form.lead_status_filter || "any"}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    lead_status_filter: v === "any" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="opportunity_created">Opportunity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const res = await fetch("/api/platform/campaigns/audience-preview", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      channel: form.outbound_channel,
                      audience_filters: {
                        lead_statuses: form.lead_status_filter
                          ? [form.lead_status_filter]
                          : undefined,
                        manual_lead_ids: form.lead_ids,
                      },
                    }),
                  });
                  const data = await res.json();
                  setAudiencePreview(data.count ?? 0);
                }}
              >
                Preview audience
              </Button>
              {audiencePreview != null && (
                <span className="ml-3 text-sm text-slate-400">
                  ~{audiencePreview} lead{audiencePreview === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <Input
            placeholder="Search leads by name, email, phone…"
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
              Add visible ({filteredLeads.length})
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearLeads}>
              Clear selection
            </Button>
            <span className="text-slate-500 self-center">
              {form.lead_ids.length} selected
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
            {filteredLeads.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No leads match your search.</p>
            ) : (
              filteredLeads.map((lead) => (
                <label
                  key={lead.id}
                  className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-800/40"
                >
                  <input
                    type="checkbox"
                    checked={form.lead_ids.includes(lead.id)}
                    onChange={() => toggleLead(lead.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {lead.full_name ?? "Unnamed lead"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[lead.email, lead.phone, lead.lead_category].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-up sequence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.use_sequence}
              onChange={(e) =>
                setForm((p) => ({ ...p, use_sequence: e.target.checked }))
              }
            />
            Multi-step follow-up sequence
          </label>
          {form.use_sequence ? (
            <CampaignStepsEditor
              steps={form.steps}
              onChange={(steps) => setForm((p) => ({ ...p, steps }))}
              templates={savedTemplates}
            />
          ) : (
            <>
          <div className="space-y-2">
            <Label htmlFor="template">Message template</Label>
            <Textarea
              id="template"
              rows={4}
              value={form.message_template}
              onChange={(e) =>
                setForm((p) => ({ ...p, message_template: e.target.value }))
              }
              placeholder="Hi {{name}}, following up on our conversation about…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="delay">Delay between attempts (hours)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                value={form.delay_hours}
                onChange={(e) => setForm((p) => ({ ...p, delay_hours: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max attempts</Label>
              <Input
                id="max"
                type="number"
                min={1}
                max={20}
                value={form.max_attempts}
                onChange={(e) => setForm((p) => ({ ...p, max_attempts: e.target.value }))}
              />
            </div>
            {isVoiceChannel && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="retry_min">Retry delay (minutes)</Label>
                <Input
                  id="retry_min"
                  type="number"
                  min={15}
                  value={form.retry_delay_minutes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, retry_delay_minutes: e.target.value }))
                  }
                />
              </div>
            )}
            {!isVoiceChannel && (
            <div className="space-y-2">
              <Label>Delivery mode</Label>
              <Select
                value={form.channel_mode || "none"}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    channel_mode: v === "none" ? "" : (v as FormState["channel_mode"]),
                    whatsapp_template_id:
                      v === "email" ? "" : p.whatsapp_template_id,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Auto (WhatsApp if phone, else email)</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp only</SelectItem>
                  <SelectItem value="email">Email only</SelectItem>
                  <SelectItem value="both">WhatsApp + email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}
          </div>
          {showWhatsAppTemplate && (
            <div className="space-y-2">
              <Label>WhatsApp template (optional)</Label>
              <Select
                value={form.whatsapp_template_id || "none"}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    whatsapp_template_id: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      waTemplatesLoading ? "Loading templates…" : "Free-form message"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Free-form session message</SelectItem>
                  {waTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.meta_template_name ? ` (${t.meta_template_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {waTemplates.length === 0 && !waTemplatesLoading && (
                <p className="text-xs text-slate-500">
                  No approved templates yet. Add templates under Integrations → WhatsApp and mark
                  them approved.
                </p>
              )}
              {selectedWaTemplate && (
                <p className="text-xs text-slate-400 rounded-md border border-slate-800 bg-slate-900/50 p-2">
                  {selectedWaTemplate.body_preview}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Approved Meta templates are used for outbound campaign sends outside the 24-hour
                window. Leave unset to use the message template above as a session message when
                allowed.
              </p>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save campaign" : "Create campaign"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
