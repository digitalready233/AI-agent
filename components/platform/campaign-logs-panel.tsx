"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CampaignLog } from "@/lib/platform/campaign-types";

function extractCallId(message?: string | null): string | null {
  if (!message) return null;
  const m = message.match(/\(call_id:\s*([a-f0-9-]+)\)/i);
  return m?.[1] ?? null;
}

export function CampaignLogsPanel({
  campaignId,
  isVoice = false,
}: {
  campaignId: string;
  isVoice?: boolean;
}) {
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/platform/campaigns/${campaignId}/logs`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setLogs(data.logs ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isVoice ? "Dial & call logs" : "Campaign logs"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500">Loading logs…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500">No messages sent yet.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge
                    variant={
                      log.status === "sent" || log.status === "delivered"
                        ? "success"
                        : log.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {log.status}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {new Date(log.sent_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Lead {log.lead_id.slice(0, 8)} · {log.channel}
                </p>
                {log.message_sent && (
                  <p className="mt-2 text-slate-300 line-clamp-2">{log.message_sent}</p>
                )}
                {log.error_message && (
                  <p className="mt-1 text-xs text-rose-400">{log.error_message}</p>
                )}
                {isVoice && extractCallId(log.message_sent) && (
                  <Link
                    href={`/dashboard/calls/${extractCallId(log.message_sent)}`}
                    className="mt-2 inline-block text-xs text-cyan-400 hover:underline"
                  >
                    View call record →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
