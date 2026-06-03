"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Bot,
  GitBranch,
  Target,
  HandHelping,
  Bell,
  Plug,
  Webhook,
  Shield,
  CreditCard,
  Database,
  Settings2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  SaveBar,
  SettingsCheckbox,
  SettingsEmpty,
  SettingsSection,
} from "@/components/platform/settings/settings-shared";
import { INTEGRATION_CREDENTIAL_FIELDS } from "@/lib/platform/integration-credentials";
import { ROLE_LABELS, can, type Permission } from "@/lib/platform/rbac";
import type { UserRole } from "@/lib/platform/types";
import type { Organization, Profile } from "@/lib/platform/types";
import type {
  AgentDefaultsSettings,
  HumanHandoffSettings,
  LeadScoringSettings,
  NotificationsSettings,
  OrganizationProfilePayload,
  OrganizationSettingsRecord,
  SalesPipelineSettings,
  TeamInvite,
  WorkspaceSettings,
} from "@/lib/platform/settings-types";
import type { DashboardStats } from "@/lib/platform/types";

const INTEGRATION_LABELS: Record<string, string> = {
  openai: "OpenAI",
  whatsapp: "WhatsApp Cloud API",
  google_calendar: "Google Calendar",
  hubspot: "HubSpot",
  airtable: "Airtable",
  google_sheets: "Google Sheets",
  slack: "Slack",
  email_smtp: "Email SMTP",
  zoom: "Zoom",
  website_chat: "Website Chat Widget",
  webhook_api: "Webhook API",
};

const ALL_ROLES: UserRole[] = [
  "super_admin",
  "company_admin",
  "sales_manager",
  "sales_agent",
  "support_agent",
  "viewer",
];

const PERMISSION_ROWS: { key: Permission; label: string }[] = [
  { key: "agents.manage", label: "Manage agents" },
  { key: "leads.manage", label: "Manage leads" },
  { key: "campaigns.manage", label: "Manage campaigns" },
  { key: "integrations.manage", label: "Manage integrations" },
  { key: "team.manage", label: "Manage team" },
  { key: "settings.manage", label: "Manage settings" },
];

type SecretsMeta = {
  api_token_configured: boolean;
  api_token_masked: string | null;
  webhook_secret_configured: boolean;
  webhook_secret_masked: string | null;
};

type IntegrationPublic = {
  integration_type: string;
  status: string;
  configured: boolean;
  masked_fields: Record<string, string>;
};

export function SettingsWorkspace({
  organization: initialOrg,
  settings: initialSettings,
  profiles,
  canManage,
  stats,
  secrets: initialSecrets,
  integrations: initialIntegrations,
}: {
  organization: Organization;
  settings: OrganizationSettingsRecord;
  profiles: Profile[];
  canManage: boolean;
  stats: DashboardStats;
  secrets: SecretsMeta;
  integrations: IntegrationPublic[];
}) {
  const [org, setOrg] = useState<OrganizationProfilePayload>({
    name: initialOrg.name,
    logo_url: initialOrg.logo_url ?? "",
    industry: initialOrg.industry ?? "",
    website: initialOrg.website ?? "",
    email: initialOrg.email ?? "",
    phone: initialOrg.phone ?? "",
    address: initialOrg.address ?? "",
    country: initialOrg.country ?? "",
    timezone: initialOrg.timezone ?? "Africa/Accra",
    currency: initialOrg.currency ?? "USD",
    description: initialOrg.description ?? "",
  });
  const [settings, setSettings] = useState(initialSettings);
  const [secrets, setSecrets] = useState(initialSecrets);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [saving, setSaving] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("sales_agent");
  const [credForms, setCredForms] = useState<Record<string, Record<string, string>>>({});

  const saveOrg = useCallback(async () => {
    setSaving("org");
    try {
      const res = await fetch("/api/platform/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(org),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Company profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }, [org]);

  const saveSection = useCallback(
    async <S extends keyof OrganizationSettingsRecord>(
      section: S,
      value: OrganizationSettingsRecord[S],
      label: string
    ) => {
      setSaving(String(section));
      try {
        const res = await fetch("/api/platform/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        setSettings(data.settings);
        toast.success(`${label} saved`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(null);
      }
    },
    []
  );

  const disabled = !canManage;

  const tabClass =
    "text-xs sm:text-sm data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-200";

  return (
    <Tabs defaultValue="company" className="w-full">
      <TabsList className="mb-6 flex h-auto max-h-[220px] w-full flex-wrap justify-start gap-1 overflow-y-auto p-2">
        <TabsTrigger value="company" className={tabClass}>
          <Building2 className="mr-1.5 h-3.5 w-3.5" />
          Company
        </TabsTrigger>
        <TabsTrigger value="workspace" className={tabClass}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Workspace
        </TabsTrigger>
        <TabsTrigger value="agent" className={tabClass}>
          <Bot className="mr-1.5 h-3.5 w-3.5" />
          AI defaults
        </TabsTrigger>
        <TabsTrigger value="pipeline" className={tabClass}>
          <GitBranch className="mr-1.5 h-3.5 w-3.5" />
          Pipeline
        </TabsTrigger>
        <TabsTrigger value="scoring" className={tabClass}>
          <Target className="mr-1.5 h-3.5 w-3.5" />
          Scoring
        </TabsTrigger>
        <TabsTrigger value="handoff" className={tabClass}>
          <HandHelping className="mr-1.5 h-3.5 w-3.5" />
          Handoff
        </TabsTrigger>
        <TabsTrigger value="notifications" className={tabClass}>
          <Bell className="mr-1.5 h-3.5 w-3.5" />
          Notifications
        </TabsTrigger>
        <TabsTrigger value="team" className={tabClass}>
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Team
        </TabsTrigger>
        <TabsTrigger value="integrations" className={tabClass}>
          <Plug className="mr-1.5 h-3.5 w-3.5" />
          Integrations
        </TabsTrigger>
        <TabsTrigger value="api" className={tabClass}>
          <Webhook className="mr-1.5 h-3.5 w-3.5" />
          API
        </TabsTrigger>
        <TabsTrigger value="security" className={tabClass}>
          <Shield className="mr-1.5 h-3.5 w-3.5" />
          Security
        </TabsTrigger>
        <TabsTrigger value="billing" className={tabClass}>
          <CreditCard className="mr-1.5 h-3.5 w-3.5" />
          Billing
        </TabsTrigger>
        <TabsTrigger value="privacy" className={tabClass}>
          <Database className="mr-1.5 h-3.5 w-3.5" />
          Privacy
        </TabsTrigger>
      </TabsList>

      {!canManage && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200/90">
          You have view-only access to settings. Contact a company admin to make changes.
        </p>
      )}

      <TabsContent value="company" className="max-w-3xl space-y-6">
        <SettingsSection title="Company profile" description="Workspace identity visible to your team and customers.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workspace name" className="sm:col-span-2">
              <Input
                className="platform-input"
                value={org.name}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, name: e.target.value })}
              />
            </Field>
            <Field label="Logo URL" className="sm:col-span-2" hint="Paste a hosted image URL for your logo.">
              <Input
                className="platform-input"
                value={org.logo_url ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, logo_url: e.target.value })}
              />
            </Field>
            <Field label="Industry">
              <Input
                className="platform-input"
                value={org.industry ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, industry: e.target.value })}
              />
            </Field>
            <Field label="Website">
              <Input
                className="platform-input"
                value={org.website ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, website: e.target.value })}
              />
            </Field>
            <Field label="Business email">
              <Input
                type="email"
                className="platform-input"
                value={org.email ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, email: e.target.value })}
              />
            </Field>
            <Field label="Business phone">
              <Input
                className="platform-input"
                value={org.phone ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, phone: e.target.value })}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input
                className="platform-input"
                value={org.address ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, address: e.target.value })}
              />
            </Field>
            <Field label="Country">
              <Input
                className="platform-input"
                value={org.country ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, country: e.target.value })}
              />
            </Field>
            <Field label="Timezone">
              <Input
                className="platform-input"
                value={org.timezone ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <Input
                className="platform-input"
                value={org.currency ?? "USD"}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, currency: e.target.value })}
              />
            </Field>
            <Field label="Company description" className="sm:col-span-2">
              <Textarea
                rows={4}
                className="platform-input"
                value={org.description ?? ""}
                disabled={disabled}
                onChange={(e) => setOrg({ ...org, description: e.target.value })}
              />
            </Field>
          </div>
          <SaveBar onSave={saveOrg} saving={saving === "org"} disabled={disabled} />
        </SettingsSection>
      </TabsContent>

      <TabsContent value="workspace" className="max-w-3xl space-y-4">
        <p className="text-sm text-slate-400">
          Configure meeting providers, availability, and scheduling rules in{" "}
          <a href="/dashboard/settings/booking" className="text-cyan-400 hover:underline">
            Booking settings
          </a>
          .
        </p>
        <WorkspacePanel
          value={settings.workspace}
          profiles={profiles}
          disabled={disabled}
          saving={saving === "workspace"}
          onChange={(workspace) => setSettings({ ...settings, workspace })}
          onSave={() => saveSection("workspace", settings.workspace, "Workspace settings")}
        />
      </TabsContent>

      <TabsContent value="agent" className="max-w-3xl">
        <AgentDefaultsPanel
          value={settings.agent_defaults}
          disabled={disabled}
          saving={saving === "agent_defaults"}
          onChange={(agent_defaults) => setSettings({ ...settings, agent_defaults })}
          onSave={() => saveSection("agent_defaults", settings.agent_defaults, "AI agent defaults")}
        />
      </TabsContent>

      <TabsContent value="pipeline" className="max-w-3xl">
        <PipelinePanel
          value={settings.sales_pipeline}
          disabled={disabled}
          saving={saving === "sales_pipeline"}
          onChange={(sales_pipeline) => setSettings({ ...settings, sales_pipeline })}
          onSave={() => saveSection("sales_pipeline", settings.sales_pipeline, "Sales pipeline")}
        />
      </TabsContent>

      <TabsContent value="scoring" className="max-w-3xl">
        <ScoringPanel
          value={settings.lead_scoring}
          disabled={disabled}
          saving={saving === "lead_scoring"}
          onChange={(lead_scoring) => setSettings({ ...settings, lead_scoring })}
          onSave={() => saveSection("lead_scoring", settings.lead_scoring, "Lead scoring")}
        />
      </TabsContent>

      <TabsContent value="handoff" className="max-w-3xl">
        <HandoffPanel
          value={settings.human_handoff}
          disabled={disabled}
          saving={saving === "human_handoff"}
          onChange={(human_handoff) => setSettings({ ...settings, human_handoff })}
          onSave={() => saveSection("human_handoff", settings.human_handoff, "Human handoff")}
        />
      </TabsContent>

      <TabsContent value="notifications" className="max-w-3xl">
        <NotificationsPanel
          value={settings.notifications}
          disabled={disabled}
          saving={saving === "notifications"}
          onChange={(notifications) => setSettings({ ...settings, notifications })}
          onSave={() => saveSection("notifications", settings.notifications, "Notifications")}
        />
      </TabsContent>

      <TabsContent value="team" className="max-w-4xl space-y-6">
        <TeamPanel
          profiles={profiles}
          pending={settings.team_settings.pending_invites}
          inviteEmail={inviteEmail}
          inviteRole={inviteRole}
          disabled={disabled}
          onInviteEmail={setInviteEmail}
          onInviteRole={setInviteRole}
          onInvited={(pending) =>
            setSettings({
              ...settings,
              team_settings: { pending_invites: pending },
            })
          }
        />
        <PermissionMatrix />
      </TabsContent>

      <TabsContent value="integrations" className="max-w-4xl">
        <IntegrationsSettingsPanel
          integrations={integrations}
          credForms={credForms}
          disabled={disabled}
          onCredChange={(type, key, val) =>
            setCredForms((p) => ({
              ...p,
              [type]: { ...(p[type] ?? {}), [key]: val },
            }))
          }
          onSaved={async () => {
            const res = await fetch("/api/platform/settings/integrations");
            const data = await res.json();
            if (res.ok) setIntegrations(data.integrations);
          }}
        />
      </TabsContent>

      <TabsContent value="api" className="max-w-3xl space-y-6">
        <ApiPanel
          secrets={secrets}
          newToken={newToken}
          newWebhookSecret={newWebhookSecret}
          disabled={disabled}
          events={settings.api_settings.webhook_events_enabled}
          onEventsChange={(webhook_events_enabled) =>
            setSettings({
              ...settings,
              api_settings: { webhook_events_enabled },
            })
          }
          onRegenerate={async (action) => {
            const res = await fetch("/api/platform/settings/secrets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            if (data.api_token) setNewToken(data.api_token);
            if (data.webhook_secret) setNewWebhookSecret(data.webhook_secret);
            const meta = await fetch("/api/platform/settings/secrets");
            const metaJson = await meta.json();
            if (meta.ok) setSecrets(metaJson);
            toast.success(data.message ?? "Regenerated");
          }}
          onSaveEvents={() =>
            saveSection("api_settings", settings.api_settings, "API settings")
          }
          saving={saving === "api_settings"}
        />
      </TabsContent>

      <TabsContent value="security" className="max-w-3xl">
        <SecurityPanel
          value={settings.security}
          disabled={disabled}
          saving={saving === "security"}
          onChange={(security) => setSettings({ ...settings, security })}
          onSave={() => saveSection("security", settings.security, "Security")}
        />
      </TabsContent>

      <TabsContent value="billing" className="max-w-3xl">
        <BillingPanel
          value={settings.billing}
          stats={stats}
          agentCount={profiles.length}
          disabled={disabled}
          saving={saving === "billing"}
          onChange={(billing) => setSettings({ ...settings, billing })}
          onSave={() => saveSection("billing", settings.billing, "Billing")}
        />
      </TabsContent>

      <TabsContent value="privacy" className="max-w-3xl">
        <PrivacyPanel
          value={settings.data_privacy}
          disabled={disabled}
          saving={saving === "data_privacy"}
          onChange={(data_privacy) => setSettings({ ...settings, data_privacy })}
          onSave={() => saveSection("data_privacy", settings.data_privacy, "Data & privacy")}
        />
      </TabsContent>
    </Tabs>
  );
}

function WorkspacePanel({
  value,
  profiles,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: WorkspaceSettings;
  profiles: Profile[];
  disabled: boolean;
  saving: boolean;
  onChange: (v: WorkspaceSettings) => void;
  onSave: () => void;
}) {
  return (
    <SettingsSection title="Workspace settings" description="Defaults for your sales operations workspace.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default language">
          <Input
            className="platform-input"
            value={value.default_language}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, default_language: e.target.value })}
          />
        </Field>
        <Field label="Default timezone">
          <Input
            className="platform-input"
            value={value.default_timezone}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, default_timezone: e.target.value })}
          />
        </Field>
        <Field label="Date format">
          <Input
            className="platform-input"
            value={value.date_format}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, date_format: e.target.value })}
          />
        </Field>
        <Field label="Time format">
          <Select
            value={value.time_format}
            disabled={disabled}
            onValueChange={(v) =>
              onChange({ ...value, time_format: v as "12h" | "24h" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">12-hour</SelectItem>
              <SelectItem value="24h">24-hour</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default dashboard view">
          <Select
            value={value.default_dashboard_view}
            disabled={disabled}
            onValueChange={(v) => onChange({ ...value, default_dashboard_view: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="pipeline">Pipeline</SelectItem>
              <SelectItem value="conversations">Conversations</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default lead owner">
          <Select
            value={value.default_lead_owner_id ?? "none"}
            disabled={disabled}
            onValueChange={(v) =>
              onChange({
                ...value,
                default_lead_owner_id: v === "none" ? null : v,
              })
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
        </Field>
      </div>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
    </SettingsSection>
  );
}

function AgentDefaultsPanel({
  value,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: AgentDefaultsSettings;
  disabled: boolean;
  saving: boolean;
  onChange: (v: AgentDefaultsSettings) => void;
  onSave: () => void;
}) {
  const fields: { key: keyof AgentDefaultsSettings; label: string; rows?: number }[] = [
    { key: "default_tone", label: "Default tone" },
    { key: "default_role", label: "Default role" },
    { key: "default_welcome_message", label: "Default welcome message", rows: 3 },
    { key: "default_fallback_response", label: "Default fallback response", rows: 3 },
    { key: "default_qualification_prompt", label: "Default qualification prompt", rows: 4 },
    { key: "default_objection_prompt", label: "Default objection handling", rows: 4 },
    { key: "default_booking_message", label: "Default booking message", rows: 3 },
    { key: "default_handoff_message", label: "Default human handoff message", rows: 3 },
  ];
  return (
    <SettingsSection title="AI agent defaults" description="Applied when creating new sales agents.">
      <div className="space-y-4">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.rows ? (
              <Textarea
                rows={f.rows}
                className="platform-input"
                value={value[f.key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              />
            ) : (
              <Input
                className="platform-input"
                value={value[f.key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
      </div>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
    </SettingsSection>
  );
}

function PipelinePanel({
  value,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: SalesPipelineSettings;
  disabled: boolean;
  saving: boolean;
  onChange: (v: SalesPipelineSettings) => void;
  onSave: () => void;
}) {
  return (
    <SettingsSection title="Sales pipeline" description="Configure lead statuses for your organization.">
      <Field label="Default status for new leads">
        <Select
          value={value.default_status}
          disabled={disabled}
          onValueChange={(v) =>
            onChange({ ...value, default_status: v as SalesPipelineSettings["default_status"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {value.statuses
              .filter((s) => s.enabled)
              .map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="space-y-2">
        {value.statuses.map((s, idx) => (
          <SettingsCheckbox
            key={s.key}
            label={s.label}
            checked={s.enabled}
            disabled={disabled}
            onChange={(enabled) => {
              const statuses = [...value.statuses];
              statuses[idx] = { ...s, enabled };
              onChange({ ...value, statuses });
            }}
          />
        ))}
      </div>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
    </SettingsSection>
  );
}

function ScoringPanel({
  value,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: LeadScoringSettings;
  disabled: boolean;
  saving: boolean;
  onChange: (v: LeadScoringSettings) => void;
  onSave: () => void;
}) {
  const range = (
    label: string,
    minKey: keyof LeadScoringSettings,
    maxKey: keyof LeadScoringSettings
  ) => (
    <div className="grid grid-cols-2 gap-3">
      <Field label={`${label} min`}>
        <Input
          type="number"
          className="platform-input"
          value={value[minKey] as number}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, [minKey]: Number(e.target.value) })}
        />
      </Field>
      <Field label={`${label} max`}>
        <Input
          type="number"
          className="platform-input"
          value={value[maxKey] as number}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, [maxKey]: Number(e.target.value) })}
        />
      </Field>
    </div>
  );
  return (
    <SettingsSection title="Lead scoring" description="BANT ranges and qualification thresholds.">
      {range("Need score", "need_min", "need_max")}
      {range("Budget score", "budget_min", "budget_max")}
      {range("Authority score", "authority_min", "authority_max")}
      {range("Timeline score", "timeline_min", "timeline_max")}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Hot threshold">
          <Input
            type="number"
            className="platform-input"
            value={value.hot_threshold}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, hot_threshold: Number(e.target.value) })}
          />
        </Field>
        <Field label="Warm threshold">
          <Input
            type="number"
            className="platform-input"
            value={value.warm_threshold}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, warm_threshold: Number(e.target.value) })}
          />
        </Field>
        <Field label="Cold threshold">
          <Input
            type="number"
            className="platform-input"
            value={value.cold_threshold}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, cold_threshold: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label="Auto-qualify rules">
        <Textarea
          rows={4}
          className="platform-input"
          value={value.auto_qualify_rules}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, auto_qualify_rules: e.target.value })}
        />
      </Field>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
    </SettingsSection>
  );
}

function HandoffPanel({
  value,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: HumanHandoffSettings;
  disabled: boolean;
  saving: boolean;
  onChange: (v: HumanHandoffSettings) => void;
  onSave: () => void;
}) {
  const triggerLabels: Record<keyof HumanHandoffSettings["triggers"], string> = {
    customer_asks_human: "Customer asks for human",
    lead_becomes_hot: "Lead becomes hot",
    ready_to_pay: "Customer ready to pay",
    custom_pricing: "Custom pricing requested",
    complaint_detected: "Complaint detected",
    ai_confidence_low: "AI confidence low",
  };
  return (
    <SettingsSection title="Human handoff" description="When and how conversations escalate to your team.">
      <SettingsCheckbox
        label="Enable human handoff"
        checked={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(triggerLabels) as (keyof typeof triggerLabels)[]).map((key) => (
          <SettingsCheckbox
            key={key}
            label={triggerLabels[key]}
            checked={value.triggers[key]}
            onChange={(checked) =>
              onChange({
                ...value,
                triggers: { ...value.triggers, [key]: checked },
              })
            }
          />
        ))}
      </div>
      <Field label="Default handoff department">
        <Input
          className="platform-input"
          value={value.default_department}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, default_department: e.target.value })}
        />
      </Field>
      <Field label="Default handoff message">
        <Textarea
          rows={3}
          className="platform-input"
          value={value.default_message}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, default_message: e.target.value })}
        />
      </Field>
      <Field label="Notification channel">
        <Select
          value={value.notification_channel}
          disabled={disabled}
          onValueChange={(v) =>
            onChange({
              ...value,
              notification_channel: v as HumanHandoffSettings["notification_channel"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="slack">Slack</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="dashboard">Dashboard</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
    </SettingsSection>
  );
}

function NotificationsPanel({
  value,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: NotificationsSettings;
  disabled: boolean;
  saving: boolean;
  onChange: (v: NotificationsSettings) => void;
  onSave: () => void;
}) {
  const eventLabels: Record<keyof NotificationsSettings["events"], string> = {
    new_hot_lead: "New hot lead",
    new_qualified_lead: "New qualified lead",
    new_booking: "New booking",
    human_handoff_required: "Human handoff required",
    complaint_detected: "Complaint detected",
    follow_up_due: "Follow-up due",
    integration_error: "Integration error",
    daily_summary: "Daily summary",
    weekly_report: "Weekly report",
  };
  const channelLabels: Record<keyof NotificationsSettings["channels"], string> = {
    email: "Email",
    slack: "Slack",
    whatsapp: "WhatsApp",
    dashboard: "Dashboard",
  };
  return (
    <SettingsSection title="Notifications" description="Choose what to send and where.">
      <p className="text-sm font-medium text-slate-300">Events</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(eventLabels) as (keyof typeof eventLabels)[]).map((key) => (
          <SettingsCheckbox
            key={key}
            label={eventLabels[key]}
            checked={value.events[key]}
            onChange={(checked) =>
              onChange({ ...value, events: { ...value.events, [key]: checked } })
            }
          />
        ))}
      </div>
      <p className="text-sm font-medium text-slate-300 pt-2">Channels</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(channelLabels) as (keyof typeof channelLabels)[]).map((key) => (
          <SettingsCheckbox
            key={key}
            label={channelLabels[key]}
            checked={value.channels[key]}
            onChange={(checked) =>
              onChange({ ...value, channels: { ...value.channels, [key]: checked } })
            }
          />
        ))}
      </div>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
    </SettingsSection>
  );
}

function TeamPanel({
  profiles,
  pending,
  inviteEmail,
  inviteRole,
  disabled,
  onInviteEmail,
  onInviteRole,
  onInvited,
}: {
  profiles: Profile[];
  pending: TeamInvite[];
  inviteEmail: string;
  inviteRole: UserRole;
  disabled: boolean;
  onInviteEmail: (v: string) => void;
  onInviteRole: (v: UserRole) => void;
  onInvited: (pending: TeamInvite[]) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function invite() {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      onInvited(data.pending_invites);
      onInviteEmail("");
      toast.success(data.message ?? "Invite sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(profileId: string, role: UserRole) {
    try {
      const res = await fetch("/api/platform/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Role updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <>
      <SettingsSection title="Team members" description="People with access to this workspace.">
        {profiles.length === 0 ? (
          <SettingsEmpty message="No team members yet." />
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
              >
                <div>
                  <p className="font-medium text-white">{p.full_name}</p>
                  <p className="text-xs text-slate-500">{p.department ?? "—"}</p>
                </div>
                <Select
                  value={p.role}
                  disabled={disabled}
                  onValueChange={(v) => updateRole(p.id, v as UserRole)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Invite team member">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              className="platform-input"
              value={inviteEmail}
              disabled={disabled}
              onChange={(e) => onInviteEmail(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Select
              value={inviteRole}
              disabled={disabled}
              onValueChange={(v) => onInviteRole(v as UserRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.filter((r) => r !== "super_admin").map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button onClick={invite} disabled={disabled || saving || !inviteEmail}>
          {saving ? "Sending…" : "Send invite"}
        </Button>
        {pending.length > 0 && (
          <div className="pt-4 space-y-2">
            <p className="text-sm text-slate-400">Pending invites</p>
            {pending.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between text-sm text-slate-300"
              >
                <span>{i.email}</span>
                <Badge variant="outline">{ROLE_LABELS[i.role as UserRole]}</Badge>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </>
  );
}

function PermissionMatrix() {
  return (
    <SettingsSection title="Permission matrix" description="What each role can do in this workspace.">
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-400">
              <th className="p-3">Permission</th>
              {ALL_ROLES.map((r) => (
                <th key={r} className="p-3 text-center whitespace-nowrap">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-slate-800/60">
                <td className="p-3 text-slate-300">{row.label}</td>
                {ALL_ROLES.map((r) => (
                  <td key={r} className="p-3 text-center">
                    {can(r, row.key) ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  );
}

function IntegrationsSettingsPanel({
  integrations,
  credForms,
  disabled,
  onCredChange,
  onSaved,
}: {
  integrations: IntegrationPublic[];
  credForms: Record<string, Record<string, string>>;
  disabled: boolean;
  onCredChange: (type: string, key: string, val: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function saveCreds(integrationType: string) {
    setLoading(integrationType);
    try {
      const res = await fetch("/api/platform/settings/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_type: integrationType,
          status: "connected",
          credentials: credForms[integrationType] ?? {},
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Credentials saved securely");
      await onSaved();
    } catch {
      toast.error("Could not save credentials");
    } finally {
      setLoading(null);
    }
  }

  const types = Object.keys(INTEGRATION_CREDENTIAL_FIELDS);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {types.map((type) => {
        const state = integrations.find((i) => i.integration_type === type);
        const fields = INTEGRATION_CREDENTIAL_FIELDS[type];
        return (
          <SettingsSection
            key={type}
            title={INTEGRATION_LABELS[type] ?? type}
            className="h-full"
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={state?.configured ? "default" : "outline"}>
                {state?.configured ? "Configured" : "Not configured"}
              </Badge>
              <Badge variant="outline">{state?.status ?? "not_connected"}</Badge>
            </div>
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input
                  type={f.type}
                  className="platform-input"
                  placeholder={
                    state?.masked_fields[f.key]
                      ? `Saved: ${state.masked_fields[f.key]}`
                      : f.placeholder
                  }
                  disabled={disabled}
                  value={credForms[type]?.[f.key] ?? ""}
                  onChange={(e) => onCredChange(type, f.key, e.target.value)}
                />
              </Field>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || loading === type}
              onClick={() => saveCreds(type)}
            >
              {loading === type ? "Saving…" : "Save credentials"}
            </Button>
          </SettingsSection>
        );
      })}
    </div>
  );
}

function ApiPanel({
  secrets,
  newToken,
  newWebhookSecret,
  disabled,
  events,
  onEventsChange,
  onRegenerate,
  onSaveEvents,
  saving,
}: {
  secrets: SecretsMeta;
  newToken: string | null;
  newWebhookSecret: string | null;
  disabled: boolean;
  events: string[];
  onEventsChange: (e: string[]) => void;
  onRegenerate: (action: string) => Promise<void>;
  onSaveEvents: () => void;
  saving: boolean;
}) {
  const webhookEvents = [
    "lead.created",
    "lead.qualified",
    "lead.updated",
    "conversation.handoff",
    "booking.created",
    "campaign.sent",
  ];
  return (
    <div className="space-y-6">
      <SettingsSection title="API token" description="Server-side access to your workspace API.">
        <p className="text-sm text-slate-400">
          {secrets.api_token_configured
            ? `Configured: ${secrets.api_token_masked}`
            : "No token generated yet."}
        </p>
        {newToken && (
          <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 font-mono text-xs text-cyan-100 break-all">
            {newToken}
          </p>
        )}
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => onRegenerate("regenerate_api_token")}
        >
          Regenerate API token
        </Button>
      </SettingsSection>

      <SettingsSection title="Webhook secret">
        <p className="text-sm text-slate-400">
          {secrets.webhook_secret_configured
            ? `Configured: ${secrets.webhook_secret_masked}`
            : "No webhook secret yet."}
        </p>
        {newWebhookSecret && (
          <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 font-mono text-xs text-cyan-100 break-all">
            {newWebhookSecret}
          </p>
        )}
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => onRegenerate("regenerate_webhook_secret")}
        >
          Regenerate webhook secret
        </Button>
      </SettingsSection>

      <SettingsSection title="Webhook events">
        <div className="space-y-2">
          {webhookEvents.map((ev) => (
            <SettingsCheckbox
              key={ev}
              label={ev}
              checked={events.includes(ev)}
              onChange={(checked) =>
                onEventsChange(
                  checked ? [...events, ev] : events.filter((x) => x !== ev)
                )
              }
            />
          ))}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-300 mb-2">Webhook logs</p>
          <SettingsEmpty message="Webhook delivery logs will appear here once events are flowing." />
        </div>
        <SaveBar onSave={onSaveEvents} saving={saving} disabled={disabled} />
      </SettingsSection>
    </div>
  );
}

function SecurityPanel({
  value,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: import("@/lib/platform/settings-types").SecuritySettings;
  disabled: boolean;
  saving: boolean;
  onChange: (v: import("@/lib/platform/settings-types").SecuritySettings) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Account security">
        <Field label="Session timeout (minutes)">
          <Input
            type="number"
            className="platform-input"
            value={value.session_timeout_minutes}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, session_timeout_minutes: Number(e.target.value) })
            }
          />
        </Field>
        <SettingsCheckbox
          label="Require two-factor authentication"
          description="Placeholder — connect your identity provider for production 2FA."
          checked={value.require_2fa}
          onChange={(require_2fa) => onChange({ ...value, require_2fa })}
        />
        <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
      </SettingsSection>
      <SettingsSection title="Change password">
        <SettingsEmpty message="Use your account provider (Supabase Auth) password reset from the login page." />
      </SettingsSection>
      <SettingsSection title="Login & device history">
        <SettingsEmpty message="Session and device history will be available with advanced audit logging." />
      </SettingsSection>
    </div>
  );
}

function BillingPanel({
  value,
  stats,
  agentCount,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: import("@/lib/platform/settings-types").BillingSettings;
  stats: DashboardStats;
  agentCount: number;
  disabled: boolean;
  saving: boolean;
  onChange: (v: import("@/lib/platform/settings-types").BillingSettings) => void;
  onSave: () => void;
}) {
  return (
    <SettingsSection title="Billing & usage" description="Plan limits and current usage.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current plan">
          <Input
            className="platform-input"
            value={value.plan_name}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, plan_name: e.target.value })}
          />
        </Field>
        <Field label="Agents allowed">
          <Input
            type="number"
            className="platform-input"
            value={value.agents_allowed}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, agents_allowed: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 p-4">
          <p className="text-xs text-slate-500">Conversations (30d)</p>
          <p className="text-2xl font-semibold text-white">{stats.totalConversations}</p>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <p className="text-xs text-slate-500">Team members</p>
          <p className="text-2xl font-semibold text-white">{agentCount}</p>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <p className="text-xs text-slate-500">Voice minutes</p>
          <p className="text-2xl font-semibold text-white">—</p>
        </div>
      </div>
      <Button variant="outline" asChild>
        <Link href="/dashboard/billing">Upgrade plan</Link>
      </Button>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} label="Save plan settings" />
    </SettingsSection>
  );
}

function PrivacyPanel({
  value,
  disabled,
  saving,
  onChange,
  onSave,
}: {
  value: import("@/lib/platform/settings-types").DataPrivacySettings;
  disabled: boolean;
  saving: boolean;
  onChange: (v: import("@/lib/platform/settings-types").DataPrivacySettings) => void;
  onSave: () => void;
}) {
  return (
    <SettingsSection title="Data & privacy">
      <Field label="Data retention (days)">
        <Input
          type="number"
          className="platform-input"
          value={value.retention_days}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, retention_days: Number(e.target.value) })}
        />
      </Field>
      <Field label="Privacy policy URL">
        <Input
          className="platform-input"
          value={value.privacy_policy_url}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, privacy_policy_url: e.target.value })}
        />
      </Field>
      <Field label="Consent message">
        <Textarea
          rows={3}
          className="platform-input"
          value={value.consent_message}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, consent_message: e.target.value })}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={disabled} onClick={() => toast.message("Export queued (placeholder)")}>
          Export leads
        </Button>
        <Button variant="outline" disabled={disabled} onClick={() => toast.message("Export queued (placeholder)")}>
          Export conversations
        </Button>
        <Button variant="destructive" disabled={disabled} onClick={() => toast.error("Contact support to delete workspace data")}>
          Delete workspace data
        </Button>
      </div>
      <SaveBar onSave={onSave} saving={saving} disabled={disabled} />
    </SettingsSection>
  );
}
