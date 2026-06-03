import type { VoiceToolContext } from "./tools";
import * as voiceTools from "./tools";
import { redirectCallToTransfer } from "./twilio-handoff";

export function buildRealtimeToolDefinitions(): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return [
    {
      type: "function",
      name: "searchKnowledgeBase",
      description: "Search company knowledge base for product/service answers.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      type: "function",
      name: "createOrUpdateLead",
      description: "Create or update CRM lead with caller details.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          service_interest: { type: "string" },
          budget: { type: "string" },
          timeline: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    {
      type: "function",
      name: "scoreLead",
      description: "Score lead using NBAT (0-3 each): need, budget, authority, timeline.",
      parameters: {
        type: "object",
        properties: {
          need: { type: "integer", minimum: 0, maximum: 3 },
          budget: { type: "integer", minimum: 0, maximum: 3 },
          authority: { type: "integer", minimum: 0, maximum: 3 },
          timeline: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["need", "budget", "authority", "timeline"],
      },
    },
    {
      type: "function",
      name: "checkAvailability",
      description: "Check booking availability for a preferred date.",
      parameters: {
        type: "object",
        properties: { preferredDate: { type: "string" } },
      },
    },
    {
      type: "function",
      name: "createBooking",
      description: "Book a sales consultation when caller confirms date/time.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_email: { type: "string" },
          customer_phone: { type: "string" },
          preferred_datetime: { type: "string" },
          meeting_type: { type: "string" },
          notes: { type: "string" },
        },
        required: ["customer_name", "preferred_datetime"],
      },
    },
    {
      type: "function",
      name: "notifyHumanTeam",
      description: "Notify human team without transferring the call.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          message: { type: "string" },
        },
        required: ["title", "message"],
      },
    },
    {
      type: "function",
      name: "transferToHuman",
      description:
        "Transfer hot lead or complex case to a human. Use when caller asks for a person or qualifies as hot.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      type: "function",
      name: "saveCallSummary",
      description: "Save structured call summary before ending.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          intent: { type: "string" },
          lead_category: { type: "string" },
          next_action: { type: "string" },
          handoff_required: { type: "boolean" },
        },
        required: ["summary"],
      },
    },
    {
      type: "function",
      name: "createFollowUp",
      description: "Schedule a follow-up date on the lead.",
      parameters: {
        type: "object",
        properties: {
          follow_up_date: { type: "string" },
          notes: { type: "string" },
        },
        required: ["follow_up_date"],
      },
    },
  ];
}

export type RealtimeToolRunContext = VoiceToolContext & {
  appOrigin: string;
  twilioCallSid: string | null;
};

export async function executeRealtimeVoiceTool(
  ctx: RealtimeToolRunContext,
  name: string,
  argsJson: string
): Promise<{ output: string; requestTransfer?: boolean }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return { output: JSON.stringify({ error: "invalid_json" }) };
  }

  try {
    switch (name) {
      case "searchKnowledgeBase": {
        const r = await voiceTools.searchKnowledgeBase(
          ctx,
          String(args.query ?? "")
        );
        return { output: JSON.stringify(r) };
      }
      case "createOrUpdateLead": {
        const r = await voiceTools.createOrUpdateLead(ctx, {
          full_name: args.full_name as string | undefined,
          phone: args.phone as string | undefined,
          email: args.email as string | undefined,
          service_interest: args.service_interest as string | undefined,
          budget: args.budget as string | undefined,
          timeline: args.timeline as string | undefined,
          notes: args.notes as string | undefined,
        });
        if (r.leadId) ctx.leadId = r.leadId;
        return { output: JSON.stringify(r) };
      }
      case "scoreLead": {
        const r = await voiceTools.scoreLead(ctx, {
          need: Number(args.need) as 0 | 1 | 2 | 3,
          budget: Number(args.budget) as 0 | 1 | 2 | 3,
          authority: Number(args.authority) as 0 | 1 | 2 | 3,
          timeline: Number(args.timeline) as 0 | 1 | 2 | 3,
        });
        return { output: JSON.stringify(r) };
      }
      case "checkAvailability": {
        const r = await voiceTools.checkAvailability(
          ctx,
          args.preferredDate as string | undefined
        );
        return { output: JSON.stringify(r) };
      }
      case "createBooking": {
        const r = await voiceTools.createBooking(ctx, {
          customer_name: String(args.customer_name ?? ""),
          customer_email: args.customer_email as string | undefined,
          customer_phone: args.customer_phone as string | undefined,
          preferred_datetime: String(args.preferred_datetime ?? ""),
          meeting_type: args.meeting_type as string | undefined,
          notes: args.notes as string | undefined,
        });
        return { output: JSON.stringify(r) };
      }
      case "notifyHumanTeam": {
        const r = await voiceTools.notifyHumanTeam(ctx, {
          title: String(args.title ?? "Voice alert"),
          message: String(args.message ?? ""),
        });
        return { output: JSON.stringify(r) };
      }
      case "transferToHuman": {
        const r = await voiceTools.transferToHuman(
          ctx,
          String(args.reason ?? "Caller requested human")
        );
        if (r.transferNumber && ctx.twilioCallSid) {
          await redirectCallToTransfer({
            organizationId: ctx.organizationId,
            twilioCallSid: ctx.twilioCallSid,
            appOrigin: ctx.appOrigin,
          });
          return {
            output: JSON.stringify({
              ...r,
              transferring: true,
            }),
            requestTransfer: true,
          };
        }
        return {
          output: JSON.stringify({
            ...r,
            message: r.transferNumber
              ? "Transfer number configured; ask caller to hold."
              : "No transfer number configured in voice settings.",
          }),
        };
      }
      case "saveCallSummary": {
        const r = await voiceTools.saveCallSummary(ctx, {
          summary: String(args.summary ?? ""),
          intent: args.intent as string | undefined,
          lead_category: args.lead_category as string | undefined,
          next_action: args.next_action as string | undefined,
          handoff_required: args.handoff_required as boolean | undefined,
        });
        return { output: JSON.stringify(r) };
      }
      case "createFollowUp": {
        const r = await voiceTools.createFollowUp(ctx, {
          follow_up_date: String(args.follow_up_date ?? ""),
          notes: args.notes as string | undefined,
        });
        return { output: JSON.stringify(r) };
      }
      default:
        return { output: JSON.stringify({ error: `unknown_tool:${name}` }) };
    }
  } catch (e) {
    console.error("[voice] realtime tool failed", name, e);
    return {
      output: JSON.stringify({
        error: e instanceof Error ? e.message : "tool_failed",
      }),
    };
  }
}
