import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import { getAgent, getLead } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import {
  getCallById,
  listCallEvents,
  listCallTranscripts,
} from "@/lib/voice/call-data";
import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  requirePermission(session, "conversations.view");

  const call = await getCallById(session.organization.id, id);
  if (!call) notFound();

  const [events, transcripts, lead, agent] = await Promise.all([
    listCallEvents(call.id),
    listCallTranscripts(call.id),
    call.lead_id ? getLead(call.lead_id) : null,
    call.agent_id ? getAgent(call.agent_id) : null,
  ]);

  return (
    <div className="platform-page space-y-6">
      <PageHeader
        title={call.from_number ?? "Call detail"}
        description={`${call.direction} · ${call.status} · ${call.created_at}`}
        actions={
          <Link href="/dashboard/calls" className="text-sm text-cyan-400 hover:underline">
            Back to calls
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{call.status}</Badge>
        {call.lead_category && <Badge>{call.lead_category}</Badge>}
        {call.handoff_required && (
          <Badge className="bg-amber-500/20 text-amber-200">Handoff</Badge>
        )}
        {call.detected_intent && (
          <Badge variant="outline">Intent: {call.detected_intent}</Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800/60 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base text-white">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-400">
            <p className="whitespace-pre-wrap text-slate-300">
              {call.summary ?? "No summary yet."}
            </p>
            {call.recommended_next_action && (
              <p>
                <span className="text-slate-500">Next action: </span>
                {call.recommended_next_action}
              </p>
            )}
            {lead && (
              <p>
                <span className="text-slate-500">Lead: </span>
                {lead.full_name ?? lead.phone ?? lead.id}
              </p>
            )}
            {agent && (
              <p>
                <span className="text-slate-500">Agent: </span>
                {agent.nickname ?? agent.name}
              </p>
            )}
            {call.recording_url && (
              <a
                href={call.recording_url}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline"
              >
                Open recording
              </a>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800/60 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base text-white">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {transcripts.length === 0 && !call.transcript ? (
              <p className="text-slate-500">No transcript segments yet.</p>
            ) : (
              <>
                {transcripts.map((t) => (
                  <p key={t.id} className="text-slate-300">
                    <span className="text-slate-500 capitalize">{t.speaker}: </span>
                    {t.content}
                  </p>
                ))}
                {call.transcript && transcripts.length === 0 && (
                  <p className="whitespace-pre-wrap text-slate-300">{call.transcript}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {events.length > 0 && (
        <Card className="border-slate-800/60 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base text-white">Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs text-slate-500">
            {events.map((e) => (
              <div key={e.id} className="border-b border-slate-800/50 py-2">
                {e.created_at} — {e.event_type}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
