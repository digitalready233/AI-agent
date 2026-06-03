import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { isLlmConfigured } from "@/lib/agent/llm-env";
import { getLead, listMessages, saveLead } from "@/lib/platform/data";
import {
  appendCallTranscript,
  getCallById,
  listCallTranscripts,
  saveCall,
} from "./call-data";
import type { CallRecord, CallSummaryPayload } from "./types";
import { createFollowUp, saveCallSummary } from "./tools";

export async function finalizeCallSummary(params: {
  organizationId: string;
  callId: string;
  transcriptOverride?: string;
}): Promise<CallRecord | null> {
  const call = await getCallById(params.organizationId, params.callId);
  if (!call) return null;

  const segments = await listCallTranscripts(call.id);
  let transcriptText =
    params.transcriptOverride?.trim() ||
    segments.map((s) => `${s.speaker}: ${s.content}`).join("\n") ||
    call.transcript ||
    "";

  if (!transcriptText && call.conversation_id) {
    const messages = await listMessages(call.conversation_id);
    transcriptText = messages
      .filter((m) => m.content?.trim())
      .map((m) => {
        const who =
          m.sender_type === "user"
            ? "caller"
            : m.sender_type === "assistant"
              ? "agent"
              : "system";
        return `${who}: ${m.content}`;
      })
      .join("\n");
  }

  let payload: CallSummaryPayload = {};

  if (isLlmConfigured() && transcriptText.length > 10) {
    try {
      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: `Extract a JSON object from this phone call transcript. Fields: caller_name, phone_number, service_interest, budget, timeline, objections, intent, lead_category (hot|warm|cold|support|not_qualified), next_action, handoff_required (boolean). Transcript:\n${transcriptText.slice(0, 6000)}`,
      });
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        payload = JSON.parse(match[0]) as CallSummaryPayload;
      }
    } catch (e) {
      console.error("[voice] summary extraction failed", e);
    }
  }

  const summaryLines = [
    payload.caller_name && `Caller: ${payload.caller_name}`,
    payload.service_interest && `Interest: ${payload.service_interest}`,
    payload.budget && `Budget: ${payload.budget}`,
    payload.timeline && `Timeline: ${payload.timeline}`,
    payload.objections && `Objections: ${payload.objections}`,
    payload.intent && `Intent: ${payload.intent}`,
    payload.next_action && `Next: ${payload.next_action}`,
  ].filter(Boolean);

  const summary =
    summaryLines.join("\n") ||
    transcriptText.slice(0, 500) ||
    "Call completed.";

  const updated = await saveCall({
    ...call,
    transcript: transcriptText || call.transcript,
    summary,
    detected_intent: payload.intent ?? call.detected_intent,
    lead_category: payload.lead_category ?? call.lead_category,
    handoff_required: payload.handoff_required ?? call.handoff_required,
    recommended_next_action: payload.next_action ?? call.recommended_next_action,
    updated_at: new Date().toISOString(),
  });

  if (call.lead_id) {
    const lead = await getLead(call.lead_id);
    if (lead) {
      await saveLead({
        ...lead,
        full_name: payload.caller_name ?? lead.full_name,
        phone: payload.phone_number ?? lead.phone,
        service_interest: payload.service_interest ?? lead.service_interest,
        budget: payload.budget ?? lead.budget,
        timeline: payload.timeline ?? lead.timeline,
        lead_category:
          (payload.lead_category as typeof lead.lead_category) ??
          lead.lead_category,
        summary,
        next_action: payload.next_action ?? lead.next_action,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const ctx = {
    organizationId: params.organizationId,
    agentId: call.agent_id ?? "",
    callId: call.id,
    conversationId: call.conversation_id,
    leadId: call.lead_id,
    callerPhone: call.from_number,
  };

  await saveCallSummary(ctx, {
    summary,
    intent: payload.intent,
    lead_category: payload.lead_category,
    next_action: payload.next_action,
    handoff_required: payload.handoff_required,
  });

  if (payload.next_action?.toLowerCase().includes("follow")) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    await createFollowUp(ctx, {
      follow_up_date: d.toISOString().slice(0, 10),
      notes: payload.next_action,
    });
  }

  return updated;
}

export async function appendTranscriptLine(params: {
  organizationId: string;
  callId: string;
  speaker: "caller" | "agent";
  content: string;
  sequenceNum: number;
}): Promise<void> {
  await appendCallTranscript({
    organizationId: params.organizationId,
    callId: params.callId,
    speaker: params.speaker,
    content: params.content,
    sequenceNum: params.sequenceNum,
  });
}
