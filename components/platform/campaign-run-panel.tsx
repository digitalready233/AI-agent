"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isVoiceCampaignChannel } from "@/lib/platform/campaign-types";
import type { CampaignRunResult, CampaignStatus } from "@/lib/platform/types";

type ChannelStatus = { whatsapp: boolean; email: boolean; voice: boolean };

export function CampaignRunPanel({
  campaignId,
  status,
  leadCount,
  channelStatus,
  campaignChannel,
}: {
  campaignId: string;
  status: CampaignStatus;
  leadCount: number;
  channelStatus: ChannelStatus;
  campaignChannel?: string | null;
}) {
  const [running, setRunning] = useState(false);
  const [force, setForce] = useState(false);
  const [lastResult, setLastResult] = useState<CampaignRunResult | null>(null);

  const isVoice = isVoiceCampaignChannel(campaignChannel);
  const channelReady = isVoice
    ? channelStatus.voice
    : channelStatus.whatsapp || channelStatus.email;

  const canRun =
    leadCount > 0 &&
    channelReady &&
    (status === "live" || status === "scheduled" || force);

  async function runCampaign() {
    setRunning(true);
    try {
      const res = await fetch(`/api/platform/campaigns/${campaignId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : data.error?.message ?? "Run failed"
        );
      }
      setLastResult(data.result as CampaignRunResult);
      toast.success(
        isVoice
          ? `Dialed ${data.result.sent} · failed ${data.result.failed} · skipped ${data.result.skipped}`
          : `Sent ${data.result.sent} · failed ${data.result.failed} · skipped ${data.result.skipped}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isVoice ? "Run voice campaign" : "Send campaign"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          {!isVoice && (
            <>
              <span
                className={
                  channelStatus.whatsapp
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              >
                WhatsApp {channelStatus.whatsapp ? "ready" : "not configured"}
              </span>
              <span
                className={
                  channelStatus.email ? "text-emerald-400" : "text-amber-400"
                }
              >
                Email {channelStatus.email ? "ready" : "not configured"}
              </span>
            </>
          )}
          {isVoice && (
            <span
              className={
                channelStatus.voice ? "text-emerald-400" : "text-amber-400"
              }
            >
              Voice {channelStatus.voice ? "ready" : "not configured"}
            </span>
          )}
          <span className="text-slate-500">{leadCount} leads in audience</span>
        </div>

        {!channelReady && !isVoice && (
          <p className="text-sm text-amber-200/90">
            Add WhatsApp or email credentials in your environment, or switch the
            campaign channel to Voice and configure Twilio under Integrations →
            Voice.
          </p>
        )}

        {isVoice && !channelStatus.voice && (
          <p className="text-sm text-amber-200/90">
            Configure Twilio voice (phone number + auth token) at{" "}
            <strong>Integrations → Voice</strong> before dialing leads.
          </p>
        )}

        {leadCount === 0 && (
          <p className="text-sm text-slate-400">
            Select at least one lead with a phone number in the audience section.
          </p>
        )}

        {status !== "live" && status !== "scheduled" && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            Run anyway (draft / paused — for testing)
          </label>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={running || !canRun}
            onClick={runCampaign}
          >
            {running
              ? isVoice
                ? "Dialing…"
                : "Sending…"
              : isVoice
                ? "Dial leads now"
                : "Run campaign now"}
          </Button>
          <p className="text-xs text-slate-500">
            {isVoice
              ? "Places outbound AI calls (max 2 concurrent by default). Cron also processes scheduled voice steps."
              : "Sends on WhatsApp and/or email per channel setting. Respects delay and max attempts."}
          </p>
        </div>

        {lastResult && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm">
            <p className="font-medium text-white">Last run</p>
            <ul className="mt-2 space-y-1 text-slate-400">
              <li>Processed: {lastResult.processed}</li>
              <li>{isVoice ? "Dialed" : "Sent"}: {lastResult.sent}</li>
              <li>Failed: {lastResult.failed}</li>
              <li>Skipped: {lastResult.skipped}</li>
            </ul>
            {lastResult.errors.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-300/90">
                {lastResult.errors.slice(0, 8).map((e) => (
                  <li key={e.leadId}>
                    {e.leadId.slice(0, 8)}… — {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
