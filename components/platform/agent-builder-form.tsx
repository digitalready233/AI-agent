"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AgentTestChat } from "@/components/platform/agent-test-chat";
import { ReadybotKnowledgeSeedButton } from "@/components/platform/readybot-knowledge-seed";
import { ReadybotPlaybookButton } from "@/components/platform/readybot-playbook-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent, AgentType, AgentStatus, KnowledgeBase } from "@/lib/platform/types";
import type { AgentPresenterConfig } from "@/lib/demo/ai-presenter-types";
import { AVATAR_PROVIDER_IDS, AVATAR_PROVIDER_LABELS, type AvatarProviderId } from "@/lib/avatar/types";
import {
  AGENT_TYPE_OPTIONS,
  AGENT_OPERATIONAL_ROLE_OPTIONS,
  BANT_DIMENSIONS,
  DEFAULT_BOOKING_RULES_PLACEHOLDER,
  DEFAULT_CRM_RULES_PLACEHOLDER,
  DEFAULT_HANDOFF_RULES_PLACEHOLDER,
  DEFAULT_QUALIFICATION_PLACEHOLDER,
  HANDOFF_TRIGGERS,
} from "@/lib/platform/sales-ops";
import { SUPPORTED_LANGUAGES } from "@/lib/platform/languages";
import { SALES_OPENING_STYLES, buildSystemPrompt } from "@/lib/platform/sales-conversation-openers";
import { AgentFromPromptPanel } from "@/components/platform/agent-from-prompt-panel";
import type { AgentDraftFromPrompt } from "@/lib/platform/agent-from-prompt";

const CHANNELS = ["website", "whatsapp", "phone", "email", "sms"] as const;

type FormState = {
  name: string;
  nickname: string;
  company_product_name: string;
  agent_type: AgentType;
  operational_role: string;
  position: string;
  language: string;
  tone: string;
  timezone: string;
  voice: string;
  voice_speed: number;
  welcome_message: string;
  system_prompt: string;
  qualification_prompt: string;
  objection_prompt: string;
  handoff_rules: string;
  booking_rules: string;
  crm_update_rules: string;
  lead_scoring_rules: string;
  fallback_response: string;
  channels: string[];
  status: AgentStatus;
  enabled: boolean;
  knowledge_base_ids: string[];
  presenter_avatar_url: string;
  presenter_display_name: string;
  presenter_role_title: string;
  presenter_style: string;
  presenter_welcome_phrase: string;
  presenter_voice_sync_enabled: boolean;
  presenter_fallback_initials: string;
  avatar_enabled: boolean;
  avatar_provider: AvatarProviderId;
  avatar_id: string;
  avatar_replica_id: string;
  avatar_persona_id: string;
  avatar_voice_id: string;
  avatar_style: string;
  avatar_fallback_mode: string;
  avatar_provider_mode: "org_default" | "fixed" | "smart_routing";
  avatar_preferred_provider: AvatarProviderId;
  avatar_allow_auto_switch: boolean;
};

function agentToForm(agent: Agent, knowledgeBaseIds: string[]): FormState {
  return {
    name: agent.name,
    nickname: agent.nickname ?? "",
    company_product_name: agent.company_product_name ?? "",
    agent_type: agent.agent_type,
    operational_role: agent.operational_role ?? "general_sales",
    position: agent.position ?? "",
    language: agent.language ?? "en",
    tone: agent.tone ?? "professional",
    timezone: agent.timezone ?? "Africa/Accra",
    voice: agent.voice ?? "alloy",
    voice_speed: agent.voice_speed ?? 1,
    welcome_message: agent.welcome_message ?? "",
    system_prompt: agent.system_prompt ?? "",
    qualification_prompt: agent.qualification_prompt ?? "",
    objection_prompt: agent.objection_prompt ?? "",
    handoff_rules: agent.handoff_rules ?? "",
    booking_rules: agent.booking_rules ?? "",
    crm_update_rules: agent.crm_update_rules ?? "",
    lead_scoring_rules: agent.lead_scoring_rules ?? "",
    fallback_response: agent.fallback_response ?? "",
    channels: agent.channels?.length ? agent.channels : ["website"],
    status: agent.status,
    enabled: agent.enabled,
    knowledge_base_ids: knowledgeBaseIds,
    presenter_avatar_url: (agent.presenter_config as AgentPresenterConfig)?.avatar_url ?? "",
    presenter_display_name:
      (agent.presenter_config as AgentPresenterConfig)?.display_name ?? "",
    presenter_role_title: (agent.presenter_config as AgentPresenterConfig)?.role_title ?? "",
    presenter_style:
      (agent.presenter_config as AgentPresenterConfig)?.style ?? "professional",
    presenter_welcome_phrase:
      (agent.presenter_config as AgentPresenterConfig)?.welcome_phrase ?? "",
    presenter_voice_sync_enabled:
      (agent.presenter_config as AgentPresenterConfig)?.voice_sync_enabled !== false,
    presenter_fallback_initials:
      (agent.presenter_config as AgentPresenterConfig)?.fallback_initials ?? "",
    avatar_enabled: agent.avatar_enabled ?? false,
    avatar_provider: (agent.avatar_provider as AvatarProviderId) ?? "internal_card",
    avatar_id: agent.avatar_id ?? "",
    avatar_replica_id: agent.avatar_replica_id ?? "",
    avatar_persona_id: agent.avatar_persona_id ?? "",
    avatar_voice_id: agent.avatar_voice_id ?? "",
    avatar_style: agent.avatar_style ?? "",
    avatar_fallback_mode: agent.avatar_fallback_mode ?? "internal_card",
    avatar_provider_mode:
      (agent.avatar_provider_mode as FormState["avatar_provider_mode"]) ??
      "org_default",
    avatar_preferred_provider:
      (agent.avatar_preferred_provider as AvatarProviderId) ??
      (agent.avatar_provider as AvatarProviderId) ??
      "internal_card",
    avatar_allow_auto_switch: agent.avatar_allow_auto_switch !== false,
  };
}

const defaultForm = (orgName: string): FormState => ({
  name: "",
  nickname: "",
  company_product_name: orgName,
  agent_type: "sales",
  operational_role: "general_sales",
  position: "",
  language: "en",
  tone: "professional",
  timezone: "Africa/Accra",
  voice: "alloy",
  voice_speed: 1,
  welcome_message: "",
  system_prompt: "",
  qualification_prompt: "",
  objection_prompt: "",
  handoff_rules: "",
  booking_rules: "",
  crm_update_rules: "",
  lead_scoring_rules: "",
  fallback_response: "",
  channels: ["website"],
  status: "draft",
  enabled: true,
  knowledge_base_ids: [],
  presenter_avatar_url: "",
  presenter_display_name: "",
  presenter_role_title: "",
  presenter_style: "professional",
  presenter_welcome_phrase: "",
  presenter_voice_sync_enabled: true,
  presenter_fallback_initials: "",
  avatar_enabled: false,
  avatar_provider: "internal_card",
  avatar_id: "",
  avatar_replica_id: "",
  avatar_persona_id: "",
  avatar_voice_id: "",
  avatar_style: "",
  avatar_fallback_mode: "internal_card",
  avatar_provider_mode: "org_default",
  avatar_preferred_provider: "internal_card",
  avatar_allow_auto_switch: true,
});

export function AgentBuilderForm({
  agent,
  organizationName,
  knowledgeBases = [],
  linkedKnowledgeBaseIds = [],
}: {
  agent?: Agent | null;
  organizationName: string;
  knowledgeBases?: KnowledgeBase[];
  linkedKnowledgeBaseIds?: string[];
}) {
  const router = useRouter();
  const isEdit = Boolean(agent?.id);
  const [form, setForm] = useState<FormState>(() =>
    agent ? agentToForm(agent, linkedKnowledgeBaseIds) : defaultForm(organizationName)
  );
  const [saving, setSaving] = useState(false);
  const [readybotBusy, setReadybotBusy] = useState(false);

  const primaryKnowledgeBaseId =
    knowledgeBases.find((kb) => kb.status === "active")?.id ??
    knowledgeBases[0]?.id ??
    null;
  const primaryKnowledgeBaseTitle =
    knowledgeBases.find((kb) => kb.id === primaryKnowledgeBaseId)?.title ?? null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChannel(channel: string) {
    setForm((prev) => {
      const has = prev.channels.includes(channel);
      const channels = has
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels: channels.length ? channels : ["website"] };
    });
  }

  function toggleKb(id: string) {
    setForm((prev) => {
      const has = prev.knowledge_base_ids.includes(id);
      return {
        ...prev,
        knowledge_base_ids: has
          ? prev.knowledge_base_ids.filter((k) => k !== id)
          : [...prev.knowledge_base_ids, id],
      };
    });
  }

  async function removeAgent() {
    if (!agent?.id) return;
    if (!confirm("Delete this agent permanently?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/agents?id=${agent.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Delete failed"
        );
      }
      toast.success("Agent permanently deleted");
      router.push("/dashboard/agents");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: agent?.id,
        name: form.name.trim(),
        agent_type: form.agent_type,
        operational_role: form.operational_role,
        nickname: form.nickname.trim() || undefined,
        company_product_name: form.company_product_name.trim() || undefined,
        position: form.position.trim() || undefined,
        language: form.language,
        tone: form.tone,
        timezone: form.timezone,
        voice: form.voice,
        voice_speed: form.voice_speed,
        welcome_message: form.welcome_message,
        system_prompt: form.system_prompt,
        qualification_prompt: form.qualification_prompt,
        objection_prompt: form.objection_prompt,
        handoff_rules: form.handoff_rules,
        booking_rules: form.booking_rules,
        crm_update_rules: form.crm_update_rules,
        lead_scoring_rules: form.lead_scoring_rules,
        fallback_response: form.fallback_response,
        status: form.status,
        channels: form.channels,
        enabled: form.enabled,
        knowledge_base_ids: form.knowledge_base_ids,
        presenter_config: {
          avatar_url: form.presenter_avatar_url.trim() || null,
          display_name: form.presenter_display_name.trim() || null,
          role_title: form.presenter_role_title.trim() || null,
          style: form.presenter_style,
          welcome_phrase: form.presenter_welcome_phrase.trim() || null,
          voice_sync_enabled: form.presenter_voice_sync_enabled,
          fallback_initials: form.presenter_fallback_initials.trim() || null,
        } satisfies AgentPresenterConfig,
        avatar_enabled: form.avatar_enabled,
        avatar_id: form.avatar_id.trim() || null,
        avatar_replica_id: form.avatar_replica_id.trim() || null,
        avatar_persona_id: form.avatar_persona_id.trim() || null,
        avatar_voice_id: form.avatar_voice_id.trim() || null,
        avatar_style: form.avatar_style.trim() || null,
        avatar_fallback_mode: form.avatar_fallback_mode,
        avatar_provider_mode: form.avatar_provider_mode,
        avatar_preferred_provider:
          form.avatar_provider_mode === "fixed"
            ? form.avatar_preferred_provider
            : undefined,
        avatar_allow_auto_switch: form.avatar_allow_auto_switch,
        avatar_provider:
          form.avatar_provider_mode === "fixed"
            ? form.avatar_preferred_provider
            : form.avatar_provider,
      };
      const res = await fetch("/api/platform/agents", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        agent?: { id: string };
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `Failed to save agent (${res.status})`
        );
      }
      toast.success(isEdit ? "Agent updated" : "Agent created");
      if (!isEdit && data.agent?.id) {
        router.push(`/dashboard/agents/${data.agent.id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function applyDraft(draft: AgentDraftFromPrompt) {
    setForm((prev) => ({
      ...prev,
      name: draft.name,
      company_product_name: draft.company_product_name,
      agent_type: draft.agent_type,
      position: draft.position,
      language: draft.language,
      welcome_message: draft.welcome_message,
      system_prompt: draft.system_prompt,
      qualification_prompt: draft.qualification_prompt,
      objection_prompt: draft.objection_prompt,
      handoff_rules: draft.handoff_rules,
      booking_rules: draft.booking_rules,
      crm_update_rules: draft.crm_update_rules,
      channels: draft.channels,
    }));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-6 min-w-0">
      {!isEdit ? <AgentFromPromptPanel onApply={applyDraft} /> : null}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="basic">Agent profile</TabsTrigger>
          <TabsTrigger value="presenter">Visual presenter</TabsTrigger>
          <TabsTrigger value="avatar">Talking avatar</TabsTrigger>
          <TabsTrigger value="prompt">Sales playbook</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge base</TabsTrigger>
          <TabsTrigger value="settings">Channels & status</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales agent profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Agent name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="AI Sales Assistant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  value={form.nickname}
                  onChange={(e) => update("nickname", e.target.value)}
                  placeholder="Kofi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company / product</Label>
                <Input
                  id="company"
                  value={form.company_product_name}
                  onChange={(e) => update("company_product_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Agent role</Label>
                <Select
                  value={form.agent_type}
                  onValueChange={(v) => update("agent_type", v as AgentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operational role (multi-agent demos)</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.operational_role}
                  onChange={(e) => update("operational_role", e.target.value)}
                >
                  {AGENT_OPERATIONAL_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Used when multi-agent demo mode assigns specialists (presenter,
                  qualification, booking, etc.).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position / role title</Label>
                <Input
                  id="position"
                  value={form.position}
                  onChange={(e) => update("position", e.target.value)}
                  placeholder="Senior Sales Consultant"
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => update("language", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={form.tone} onValueChange={(v) => update("tone", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="welcome">Welcome message (3 opening styles — rotate naturally)</Label>
                <Textarea
                  id="welcome"
                  rows={4}
                  value={form.welcome_message}
                  onChange={(e) => update("welcome_message", e.target.value)}
                  placeholder={SALES_OPENING_STYLES.map((s) => s.example).join("\n\n")}
                />
                <p className="text-xs text-muted-foreground">
                  Consultative, direct, and warm openers — never misleading. Agent picks what fits the channel.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Channels</Label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-medium capitalize transition-all ${
                        form.channels.includes(ch)
                          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200 shadow-sm shadow-cyan-500/10"
                          : "border-slate-700/80 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presenter">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visual presenter</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                How this agent appears as the AI demo guide in video demo rooms (animated card).
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Avatar image URL</Label>
                <Input
                  value={form.presenter_avatar_url}
                  onChange={(e) => update("presenter_avatar_url", e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <Label>Presenter display name</Label>
                <Input
                  value={form.presenter_display_name}
                  onChange={(e) => update("presenter_display_name", e.target.value)}
                  placeholder={form.name || "AI Demo Agent"}
                />
              </div>
              <div className="space-y-2">
                <Label>Presenter role / title</Label>
                <Input
                  value={form.presenter_role_title}
                  onChange={(e) => update("presenter_role_title", e.target.value)}
                  placeholder="AI Sales Presenter"
                />
              </div>
              <div className="space-y-2">
                <Label>Presenter style</Label>
                <Select
                  value={form.presenter_style}
                  onValueChange={(v) => update("presenter_style", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fallback initials</Label>
                <Input
                  value={form.presenter_fallback_initials}
                  onChange={(e) => update("presenter_fallback_initials", e.target.value)}
                  placeholder="AI"
                  maxLength={4}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Presenter welcome phrase</Label>
                <Textarea
                  rows={2}
                  value={form.presenter_welcome_phrase}
                  onChange={(e) => update("presenter_welcome_phrase", e.target.value)}
                  placeholder="Optional override for first spoken line in demo room"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.presenter_voice_sync_enabled}
                  onChange={(e) =>
                    update("presenter_voice_sync_enabled", e.target.checked)
                  }
                />
                Sync presenter animations with AI voice
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avatar">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Talking video avatar</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Connect Tavus, D-ID, or HeyGen for a live video presenter. Credentials are managed
                in Demo/Video settings. Falls back to the animated card if the provider fails.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.avatar_enabled}
                  onChange={(e) => update("avatar_enabled", e.target.checked)}
                />
                Enable talking avatar for this agent
              </label>
              <div className="space-y-2 sm:col-span-2">
                <Label>Provider selection mode</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.avatar_provider_mode}
                  onChange={(e) =>
                    update(
                      "avatar_provider_mode",
                      e.target.value as FormState["avatar_provider_mode"]
                    )
                  }
                >
                  <option value="org_default">Use organization default</option>
                  <option value="fixed">Use selected provider</option>
                  <option value="smart_routing">Use smart routing rules</option>
                </select>
              </div>
              {form.avatar_provider_mode === "fixed" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Preferred provider</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.avatar_preferred_provider}
                    onChange={(e) =>
                      update(
                        "avatar_preferred_provider",
                        e.target.value as AvatarProviderId
                      )
                    }
                  >
                    {AVATAR_PROVIDER_IDS.filter((id) => id !== "heygen" && id !== "custom_future").map(
                      (id) => (
                        <option key={id} value={id}>
                          {AVATAR_PROVIDER_LABELS[id]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.avatar_allow_auto_switch}
                  onChange={(e) => update("avatar_allow_auto_switch", e.target.checked)}
                />
                Allow automatic provider switch on failure (when enabled org-wide)
              </label>
              <div className="space-y-2 sm:col-span-2">
                <Label>Avatar provider (IDs &amp; legacy)</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.avatar_provider}
                  onChange={(e) =>
                    update("avatar_provider", e.target.value as AvatarProviderId)
                  }
                >
                  {AVATAR_PROVIDER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {AVATAR_PROVIDER_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Avatar / agent ID</Label>
                <Input
                  value={form.avatar_id}
                  onChange={(e) => update("avatar_id", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Replica ID (Tavus)</Label>
                <Input
                  value={form.avatar_replica_id}
                  onChange={(e) => update("avatar_replica_id", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Persona ID (Tavus)</Label>
                <Input
                  value={form.avatar_persona_id}
                  onChange={(e) => update("avatar_persona_id", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Voice ID</Label>
                <Input
                  value={form.avatar_voice_id}
                  onChange={(e) => update("avatar_voice_id", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Avatar style</Label>
                <Input
                  value={form.avatar_style}
                  onChange={(e) => update("avatar_style", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Fallback mode</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.avatar_fallback_mode}
                  onChange={(e) => update("avatar_fallback_mode", e.target.value)}
                >
                  <option value="internal_card">Internal animated card</option>
                </select>
              </div>
              {form.avatar_enabled && form.avatar_provider !== "internal_card" && (
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const res = await fetch("/api/avatar/test-connection", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          provider: form.avatar_provider,
                          avatar_id: form.avatar_id,
                          avatar_replica_id: form.avatar_replica_id,
                          avatar_persona_id: form.avatar_persona_id,
                          avatar_voice_id: form.avatar_voice_id,
                        }),
                      });
                      const data = await res.json();
                      if (data.ok) toast.success(data.message ?? "OK");
                      else toast.error(data.message ?? "Test failed");
                    }}
                  >
                    Test avatar connection
                  </Button>
                  {form.avatar_provider === "did" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ml-2"
                      onClick={async () => {
                        const res = await fetch("/api/avatar/did/session/test", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            agent_id: form.avatar_id || undefined,
                          }),
                        });
                        const data = await res.json();
                        if (data.ok) toast.success(data.message ?? "D-ID test OK");
                        else toast.error(data.message ?? "D-ID test failed");
                      }}
                    >
                      Test D-ID avatar
                    </Button>
                  )}
                  {form.avatar_provider === "tavus" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ml-2"
                      onClick={async () => {
                        const res = await fetch("/api/avatar/tavus/conversation/test", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            replica_id: form.avatar_replica_id || undefined,
                            persona_id: form.avatar_persona_id || undefined,
                          }),
                        });
                        const data = await res.json();
                        if (data.ok) {
                          toast.success(
                            data.conversation_url
                              ? `Test OK — conversation created`
                              : (data.message ?? "Test OK")
                          );
                        } else toast.error(data.message ?? "Test conversation failed");
                      }}
                    >
                      Test Tavus conversation
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Sales playbook</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure sales prompt, BANT qualification, objections, booking, handoff, and
                    CRM behavior. Conversation stages run automatically in the workflow.
                  </p>
                </div>
                {agent?.id ? (
                  <div className="flex flex-wrap gap-2">
                    <ReadybotKnowledgeSeedButton
                      knowledgeBaseId={primaryKnowledgeBaseId}
                      knowledgeBaseTitle={primaryKnowledgeBaseTitle}
                      disabled={saving || readybotBusy}
                    />
                    <ReadybotPlaybookButton
                      agentId={agent.id}
                      disabled={saving || readybotBusy}
                      onLoadingChange={setReadybotBusy}
                      onApplied={(slice) =>
                        setForm((prev) => ({ ...prev, ...slice }))
                      }
                    />
                  </div>
                ) : (
                  <ReadybotKnowledgeSeedButton
                    knowledgeBaseId={primaryKnowledgeBaseId}
                    knowledgeBaseTitle={primaryKnowledgeBaseTitle}
                    disabled={saving}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system">Sales agent system prompt</Label>
                <Textarea
                  id="system"
                  rows={5}
                  value={form.system_prompt}
                  onChange={(e) => update("system_prompt", e.target.value)}
                  placeholder={buildSystemPrompt(organizationName, form.company_product_name)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qualification">Lead qualification rules (Need, Budget, Authority, Timeline)</Label>
                <Textarea
                  id="qualification"
                  rows={4}
                  value={form.qualification_prompt}
                  onChange={(e) => update("qualification_prompt", e.target.value)}
                  placeholder={DEFAULT_QUALIFICATION_PLACEHOLDER}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objection">Objection handling logic</Label>
                <Textarea
                  id="objection"
                  rows={3}
                  value={form.objection_prompt}
                  onChange={(e) => update("objection_prompt", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handoff">Human handoff rules</Label>
                <Textarea
                  id="handoff"
                  rows={4}
                  value={form.handoff_rules}
                  onChange={(e) => update("handoff_rules", e.target.value)}
                  placeholder={DEFAULT_HANDOFF_RULES_PLACEHOLDER}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking">Booking rules</Label>
                <Textarea
                  id="booking"
                  rows={3}
                  value={form.booking_rules}
                  onChange={(e) => update("booking_rules", e.target.value)}
                  placeholder={DEFAULT_BOOKING_RULES_PLACEHOLDER}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm">CRM update rules</Label>
                <Textarea
                  id="crm"
                  rows={3}
                  value={form.crm_update_rules}
                  onChange={(e) => update("crm_update_rules", e.target.value)}
                  placeholder={DEFAULT_CRM_RULES_PLACEHOLDER}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scoring">BANT scoring & lead categories (Hot / Warm / Cold)</Label>
                <Textarea
                  id="scoring"
                  rows={3}
                  value={form.lead_scoring_rules}
                  onChange={(e) => update("lead_scoring_rules", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fallback">Fallback response</Label>
                <Textarea
                  id="fallback"
                  rows={2}
                  value={form.fallback_response}
                  onChange={(e) => update("fallback_response", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Knowledge bases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                Check bases to link, then save the agent. You can also link from the agent&apos;s{" "}
                <span className="text-slate-400">Knowledge</span> tab without opening Settings.
              </p>
              {form.knowledge_base_ids.length === 0 && knowledgeBases.length > 0 && (
                <p className="text-sm text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                  No linked knowledge base yet — select at least one below, then click Save agent.
                </p>
              )}
              {knowledgeBases.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No knowledge bases yet.{" "}
                  <a href="/dashboard/knowledge" className="text-cyan-400 hover:underline">
                    Create one
                  </a>
                </p>
              ) : (
                knowledgeBases.map((kb) => (
                  <label
                    key={kb.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 p-3 hover:border-cyan-500/30"
                  >
                    <input
                      type="checkbox"
                      checked={form.knowledge_base_ids.includes(kb.id)}
                      onChange={() => toggleKb(kb.id)}
                      className="mt-1 rounded border-slate-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{kb.title}</p>
                      {kb.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{kb.description}</p>
                      )}
                    </div>
                    <a
                      href={`/dashboard/knowledge/${kb.id}`}
                      className="shrink-0 text-xs text-cyan-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </a>
                  </label>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => update("status", v as AgentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={form.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voice">Voice</Label>
                <Input
                  id="voice"
                  value={form.voice}
                  onChange={(e) => update("voice", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speed">Voice speed</Label>
                <Input
                  id="speed"
                  type="number"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={form.voice_speed}
                  onChange={(e) => update("voice_speed", parseFloat(e.target.value) || 1)}
                />
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => update("enabled", e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span className="text-sm text-slate-300">Agent enabled</span>
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {isEdit && (
          <Button
            variant="destructive"
            type="button"
            onClick={removeAgent}
            disabled={saving}
            className="mr-auto rounded-xl"
          >
            Delete agent
          </Button>
        )}
        <Button variant="outline" type="button" className="rounded-xl" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button className="rounded-xl" onClick={save} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create agent"}
        </Button>
      </div>
      </div>

      <Card className="border-cyan-500/25 bg-gradient-to-b from-cyan-500/5 to-transparent lg:sticky lg:top-24 h-fit">
        <CardHeader>
          <CardTitle className="text-base">Test agent</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            KB-grounded preview via OpenAI. Enable save to persist test threads.
          </p>
        </CardHeader>
        <CardContent>
          {isEdit && agent?.id ? (
            <AgentTestChat
              agentId={agent.id}
              agentName={form.name || agent.name}
              welcomeMessage={form.welcome_message || agent.welcome_message}
            />
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed">
              Save the agent first to run test conversations.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
