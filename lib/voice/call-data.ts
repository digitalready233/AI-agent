import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "@/lib/platform/json-store";
import type {
  CallEvent,
  CallRecord,
  CallStatus,
  CallTranscriptSegment,
} from "./types";

export type CallListFilters = {
  status?: string;
  agent_id?: string;
  direction?: string;
  lead_category?: string;
  handoff_required?: boolean;
  from_date?: string;
  to_date?: string;
};

export async function getCallById(
  organizationId: string,
  callId: string
): Promise<CallRecord | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", callId)
      .maybeSingle();
    return (data as CallRecord) ?? null;
  }
  const all = await jsonStore.getCalls(organizationId);
  return all.find((c) => c.id === callId) ?? null;
}

/** Lookup by primary key (e.g. outbound webhook ?callId=). */
export async function getCallByPrimaryId(
  callId: string
): Promise<CallRecord | null> {
  if (!callId) return null;

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .maybeSingle();
    return (data as CallRecord) ?? null;
  }
  const all = await jsonStore.listAllCalls();
  return all.find((c) => c.id === callId) ?? null;
}

export async function getCallByTwilioSid(
  twilioCallSid: string
): Promise<CallRecord | null> {
  if (!twilioCallSid) return null;

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("twilio_call_sid", twilioCallSid)
      .maybeSingle();
    return (data as CallRecord) ?? null;
  }
  const all = await jsonStore.listAllCalls();
  return all.find((c) => c.twilio_call_sid === twilioCallSid) ?? null;
}

export async function saveCall(call: CallRecord): Promise<CallRecord> {
  const row = {
    ...call,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("calls")
      .upsert(row)
      .select()
      .single();

    if (error) {
      await jsonStore.upsertCall(row);
      return row;
    }
    return data as CallRecord;
  }

  await jsonStore.upsertCall(row);
  return row;
}

export async function listCalls(
  organizationId: string,
  filters: CallListFilters = {}
): Promise<CallRecord[]> {
  let rows: CallRecord[];

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("calls")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (filters.status) q = q.eq("status", filters.status);
    if (filters.agent_id) q = q.eq("agent_id", filters.agent_id);
    if (filters.direction) q = q.eq("direction", filters.direction);
    if (filters.lead_category) q = q.eq("lead_category", filters.lead_category);
    if (filters.handoff_required === true) q = q.eq("handoff_required", true);
    if (filters.from_date) q = q.gte("created_at", filters.from_date);
    if (filters.to_date) q = q.lte("created_at", filters.to_date);

    const { data, error } = await q.limit(200);
    if (error) {
      rows = await jsonStore.getCalls(organizationId);
    } else {
      rows = (data ?? []) as CallRecord[];
    }
  } else {
    rows = await jsonStore.getCalls(organizationId);
  }

  return applyClientFilters(rows, filters);
}

function applyClientFilters(
  rows: CallRecord[],
  filters: CallListFilters
): CallRecord[] {
  return rows.filter((c) => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.agent_id && c.agent_id !== filters.agent_id) return false;
    if (filters.direction && c.direction !== filters.direction) return false;
    if (filters.lead_category && c.lead_category !== filters.lead_category) {
      return false;
    }
    if (filters.handoff_required === true && !c.handoff_required) return false;
    if (filters.from_date && c.created_at < filters.from_date) return false;
    if (filters.to_date && c.created_at > filters.to_date) return false;
    return true;
  });
}

export async function appendCallEvent(params: {
  organizationId: string;
  callId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<CallEvent> {
  const event: CallEvent = {
    id: crypto.randomUUID(),
    organization_id: params.organizationId,
    call_id: params.callId,
    event_type: params.eventType,
    payload: params.payload ?? {},
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase.from("call_events").insert(event);
    if (error) await jsonStore.appendCallEvent(event);
  } else {
    await jsonStore.appendCallEvent(event);
  }

  return event;
}

export async function appendCallTranscript(params: {
  organizationId: string;
  callId: string;
  speaker: CallTranscriptSegment["speaker"];
  content: string;
  sequenceNum: number;
}): Promise<void> {
  const segment: CallTranscriptSegment = {
    id: crypto.randomUUID(),
    organization_id: params.organizationId,
    call_id: params.callId,
    speaker: params.speaker,
    content: params.content,
    sequence_num: params.sequenceNum,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase.from("call_transcripts").insert(segment);
    if (error) await jsonStore.appendCallTranscript(segment);
  } else {
    await jsonStore.appendCallTranscript(segment);
  }
}

export async function listCallEvents(callId: string): Promise<CallEvent[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("call_events")
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: true });
    return (data ?? []) as CallEvent[];
  }
  return jsonStore.getCallEvents(callId);
}

export async function listCallTranscripts(
  callId: string
): Promise<CallTranscriptSegment[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("call_transcripts")
      .select("*")
      .eq("call_id", callId)
      .order("sequence_num", { ascending: true });
    return (data ?? []) as CallTranscriptSegment[];
  }
  return jsonStore.getCallTranscripts(callId);
}

export function mapTwilioCallStatus(twilioStatus: string): CallStatus {
  const s = twilioStatus.toLowerCase();
  if (s === "queued" || s === "initiated") return "initiated";
  if (s === "ringing") return "ringing";
  if (s === "in-progress") return "in_progress";
  if (s === "completed") return "completed";
  if (s === "busy") return "busy";
  if (s === "failed") return "failed";
  if (s === "no-answer") return "no_answer";
  if (s === "canceled") return "canceled";
  return "in_progress";
}
