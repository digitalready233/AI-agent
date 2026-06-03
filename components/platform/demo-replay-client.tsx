"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ReplayPayload = {
  session: {
    summary?: string | null;
    transcript?: string | null;
    recording_url?: string | null;
    lead_score?: number | null;
    lead_category?: string | null;
    booking_id?: string | null;
    human_takeover_by?: string | null;
    recommended_next_action?: string | null;
    follow_up_draft?: string | null;
  };
  recordings: Array<{
    id: string;
    recording_url: string | null;
    status: string;
    duration_seconds: number | null;
  }>;
  timeline: Array<{
    id: string;
    event_type: string;
    title: string;
    description: string | null;
    event_at: string;
  }>;
  transcripts: Array<{ speaker: string; content: string; created_at?: string }>;
  assets_viewed: string[];
  objections: string[];
  follow_up_draft: string | null;
  lead_score_timeline?: Array<{
    id: string;
    event_type: string;
    title: string;
    event_at: string;
    metadata?: Record<string, unknown>;
  }>;
  booking_moment?: {
    title: string;
    event_at: string;
    event_type: string;
  } | null;
  takeover_moment?: {
    title: string;
    event_at: string;
    event_type: string;
  } | null;
  presentation_events?: Array<{
    id: string;
    event_type: string;
    title: string;
    description: string | null;
    created_at: string;
  }>;
  presenter_events?: Array<{
    id: string;
    event_type: string;
    title: string;
    description: string | null;
    created_at: string;
  }>;
  avatar_events?: Array<{
    id: string;
    event_type: string;
    provider: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
};

export function DemoReplayClient({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<ReplayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/platform/demo/sessions/${sessionId}/replay`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load replay");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
  }, [sessionId]);

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading replay…</p>;
  }

  const videoUrl =
    data.recordings.find((r) => r.recording_url)?.recording_url ??
    data.session.recording_url;

  const mergedTimeline = [
    ...data.timeline.map((ev) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      event_type: ev.event_type,
      at: ev.event_at,
    })),
    ...(data.presentation_events ?? []).map((ev) => ({
      id: `pres-${ev.id}`,
      title: ev.title,
      description: ev.description,
      event_type: ev.event_type,
      at: ev.created_at,
    })),
    ...(data.presenter_events ?? []).map((ev) => ({
      id: `presenter-${ev.id}`,
      title: ev.title,
      description: ev.description,
      event_type: ev.event_type,
      at: ev.created_at,
    })),
    ...(data.avatar_events ?? []).map((ev) => ({
      id: `avatar-${ev.id}`,
      title: `${ev.provider}: ${ev.event_type.replace(/_/g, " ")}`,
      description: null,
      event_type: ev.event_type,
      at: ev.created_at,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recording</CardTitle>
          </CardHeader>
          <CardContent>
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                className="w-full rounded-lg bg-black max-h-[420px]"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No recording file yet. Transcript and timeline are still available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto space-y-2 text-sm">
            {data.transcripts.length > 0 ? (
              data.transcripts.map((t, i) => (
                <div key={i} className="border-b border-border/50 pb-2">
                  <span className="font-medium text-cyan-600">{t.speaker}: </span>
                  {t.content}
                </div>
              ))
            ) : data.session.transcript ? (
              <pre className="whitespace-pre-wrap text-xs">{data.session.transcript}</pre>
            ) : (
              <p className="text-muted-foreground">Transcript missing for this session.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avatar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              Provider:{" "}
              <span className="capitalize">
                {(data.session as { avatar_provider?: string }).avatar_provider?.replace(
                  /_/g,
                  " "
                ) ?? "internal card"}
              </span>
            </p>
            <p>
              Status:{" "}
              {(data.session as { avatar_status?: string }).avatar_status?.replace(
                /_/g,
                " "
              ) ?? "—"}
            </p>
            {(data.session as { avatar_error?: string }).avatar_error && (
              <p className="text-amber-700 text-xs">
                {(data.session as { avatar_error?: string }).avatar_error}
              </p>
            )}
            {(data.session as { tavus_conversation_id?: string }).tavus_conversation_id && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                Tavus: {(data.session as { tavus_conversation_id?: string }).tavus_conversation_id}
              </p>
            )}
            {(data.session as { did_session_id?: string }).did_session_id && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                D-ID session:{" "}
                {(data.session as { did_session_id?: string }).did_session_id}
              </p>
            )}
            {(data.session as { did_stream_id?: string }).did_stream_id && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                D-ID stream: {(data.session as { did_stream_id?: string }).did_stream_id}
              </p>
            )}
            {(data.session as { avatar_fallback_provider?: string }).avatar_fallback_provider && (
              <p className="text-xs text-muted-foreground">
                Fallback provider:{" "}
                {(data.session as { avatar_fallback_provider?: string }).avatar_fallback_provider?.replace(
                  /_/g,
                  " "
                )}
              </p>
            )}
            {(data.session as { metadata?: Record<string, unknown> }).metadata
              ?.avatar_routing_rule_name != null && (
              <p className="text-xs text-muted-foreground">
                Routing rule:{" "}
                {String(
                  (data.session as { metadata?: Record<string, unknown> }).metadata
                    ?.avatar_routing_rule_name
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {data.session.summary ?? "No summary generated."}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead & outcome</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              Final score: {data.session.lead_score ?? "—"}{" "}
              {data.session.lead_category && (
                <Badge variant="outline" className="ml-1 capitalize">
                  {data.session.lead_category}
                </Badge>
              )}
            </p>
            {data.lead_score_timeline && data.lead_score_timeline.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                {data.lead_score_timeline.map((ev) => (
                  <li key={ev.id}>
                    {ev.title} · {new Date(ev.event_at).toLocaleTimeString()}
                  </li>
                ))}
              </ul>
            )}
            {data.booking_moment && (
              <p>
                Booking: {data.booking_moment.title} at{" "}
                {new Date(data.booking_moment.event_at).toLocaleString()}
              </p>
            )}
            {data.session.booking_id && !data.booking_moment && <p>Booking linked</p>}
            {data.takeover_moment && (
              <p>
                Takeover: {data.takeover_moment.title} at{" "}
                {new Date(data.takeover_moment.event_at).toLocaleString()}
              </p>
            )}
            {data.session.human_takeover_by && !data.takeover_moment && (
              <p>Human takeover: {data.session.human_takeover_by}</p>
            )}
            <p className="text-muted-foreground">
              Next: {data.session.recommended_next_action ?? "—"}
            </p>
          </CardContent>
        </Card>

        {data.objections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Objections</CardTitle>
            </CardHeader>
            <CardContent className="text-sm list-disc pl-4">
              {data.objections.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </CardContent>
          </Card>
        )}

        {data.assets_viewed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assets viewed</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {data.assets_viewed.join(", ")}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {mergedTimeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No timeline events recorded.</p>
            ) : (
              mergedTimeline.map((ev) => (
                <div key={ev.id} className="text-sm border-l-2 border-cyan-600/40 pl-3">
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(ev.at).toLocaleString()} · {ev.event_type}
                  </p>
                  {ev.description && (
                    <p className="text-muted-foreground text-xs mt-0.5">{ev.description}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {data.follow_up_draft && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Follow-up draft</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">
              {data.follow_up_draft}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
