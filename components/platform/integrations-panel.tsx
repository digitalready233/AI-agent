"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Calendar,
  Mail,
  MessageCircle,
  Plug,
  Sheet,
  MessagesSquare,
  Sparkles,
  Table2,
  Video,
  Webhook,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Integration, IntegrationStatus } from "@/lib/platform/types";

const labels: Record<string, string> = {
  openai: "OpenAI API",
  whatsapp: "WhatsApp Cloud API",
  google_calendar: "Google Calendar",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  calendly: "Calendly",
  airtable: "Airtable",
  google_sheets: "Google Sheets",
  slack: "Slack",
  email_smtp: "Gmail / Email SMTP",
  zoom: "Zoom",
  website_chat: "Website Chat Widget",
  webhook_api: "Webhook API",
  twilio_voice: "Twilio Voice",
};

const integrationHints: Record<string, string> = {
  hubspot: "CRM sync via webhook — configure in Settings → Webhooks.",
  salesforce: "Push leads via outbound webhook or Zapier until native OAuth ships.",
  calendly: "Booking links and webhooks — Settings → Booking.",
  slack: "Escalation alerts via Slack incoming webhook in Settings.",
  email_smtp: "Gmail or SMTP for campaign and escalation email.",
  google_sheets: "Export leads via webhook or manual sync.",
  airtable: "Sync via webhook automation.",
};

const icons: Record<string, LucideIcon> = {
  openai: Sparkles,
  whatsapp: MessageCircle,
  google_calendar: Calendar,
  hubspot: Plug,
  salesforce: Plug,
  calendly: Calendar,
  airtable: Table2,
  google_sheets: Sheet,
  slack: MessagesSquare,
  email_smtp: Mail,
  zoom: Video,
  website_chat: MessageCircle,
  webhook_api: Webhook,
  twilio_voice: Phone,
};

export function IntegrationsPanel({
  integrations: initial,
}: {
  integrations: Integration[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function toggle(integrationType: string, connect: boolean) {
    setLoading(integrationType);
    try {
      const status: IntegrationStatus = connect ? "connected" : "not_connected";
      const res = await fetch("/api/platform/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_type: integrationType, status }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(connect ? "Marked as connected" : "Disconnected");
      router.refresh();
    } catch {
      toast.error("Could not update integration");
    } finally {
      setLoading(null);
    }
  }

  if (initial.length === 0) {
    return (
      <Card className="border-slate-800/60 bg-slate-900/40">
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-sm text-slate-400">
            No integrations are registered for this workspace yet. Refresh the page — defaults
            should appear automatically. You can also open channel settings directly:
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard/integrations/whatsapp">WhatsApp settings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/integrations/voice">Voice (Twilio) settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {initial.map((i) => {
        const Icon = icons[i.integration_type] ?? Plug;
        return (
          <Card
            key={i.id}
            className="group transition-all duration-200 hover:border-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/5"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 ring-1 ring-slate-700/80 group-hover:ring-cyan-500/30 transition-colors">
                  <Icon className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {labels[i.integration_type] ?? i.integration_type}
                    </CardTitle>
                    <Badge
                      variant={
                        i.status === "connected"
                          ? "success"
                          : i.status === "needs_attention"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {i.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {integrationHints[i.integration_type] ? (
                <p className="text-xs leading-relaxed text-slate-400">
                  {integrationHints[i.integration_type]}
                </p>
              ) : null}
              {i.integration_type === "google_calendar" || i.integration_type === "calendly" ? (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/dashboard/settings/booking">
                    Configure booking (Google &amp; Calendly)
                  </Link>
                </Button>
              ) : null}
              {i.integration_type === "hubspot" || i.integration_type === "salesforce" ? (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/dashboard/webhooks">Configure CRM webhooks</Link>
                </Button>
              ) : null}
              {i.integration_type === "website_chat" ? (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/dashboard/agents">Get website embed code</Link>
                </Button>
              ) : null}
              {i.integration_type === "whatsapp" ? (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/dashboard/integrations/whatsapp">
                    Configure WhatsApp &amp; webhook
                  </Link>
                </Button>
              ) : null}
              {i.integration_type === "twilio_voice" ? (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/dashboard/integrations/voice">
                    Configure voice calls &amp; Twilio
                  </Link>
                </Button>
              ) : null}
              <p className="text-xs leading-relaxed text-slate-500">
                Credentials are stored server-side — never in the browser.
              </p>
              {i.last_tested_at && (
                <p className="text-xs text-slate-500">
                  Last tested: {new Date(i.last_tested_at).toLocaleString()}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  disabled={loading === i.integration_type}
                  onClick={() => toggle(i.integration_type, i.status !== "connected")}
                >
                  {i.status === "connected" ? "Disconnect" : "Connect"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={loading === i.integration_type}
                  onClick={() => toggle(i.integration_type, true)}
                >
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
