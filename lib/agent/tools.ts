import { tool } from "ai";
import { z } from "zod";
import { logEvent } from "../analytics";
import type { Channel } from "../config";
import { captureLead } from "../leads/capture";
import { saveLeadToCrm } from "../integrations/crm";
import {
  createCalendarEvent,
  getAvailableSlots,
} from "../integrations/google-calendar";
import { scheduleFollowUpWebhook } from "../integrations/follow-up";
import {
  notifyEscalation,
  notifyHotLead,
  notifyHumanAttention,
} from "../integrations/notify";
import { scoreLeadFromNbat } from "./scoring";
import {
  ensureLeadsHydrated,
  getLeadBySession,
  mergeLeadRecord,
  saveAppointment,
  saveCrmSummary,
  saveEscalation,
} from "../store";
import type { Urgency } from "../types";
import { booking } from "../config";

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const scoreEnum = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export function createAgentTools(sessionId: string, channel: Channel = "website") {
  return {
    save_lead: tool({
      description:
        "Save or update lead information and qualification status. Call whenever you learn new contact or qualification details.",
      parameters: z.object({
        status: z.enum(["Hot", "Warm", "Cold", "Support", "Not Qualified"]),
        customerType: z
          .enum([
            "new_prospect",
            "existing_customer",
            "returning_lead",
            "complaint",
            "support",
            "partnership",
            "job_seeker",
            "unknown",
          ])
          .optional(),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        businessName: z.string().optional(),
        location: z.string().optional(),
        serviceNeeded: z.string().optional(),
        mainChallenge: z.string().optional(),
        budgetRange: z.string().optional(),
        timeline: z.string().optional(),
        preferredContact: z.string().optional(),
        bestTimeToReach: z.string().optional(),
        sentiment: z.string().optional(),
        objections: z.string().optional(),
        followUpDate: z.string().optional(),
        assignedTeam: z.string().optional(),
        notes: z.string().optional(),
        conversationSummary: z.string().optional(),
        conversationStage: z.string().optional(),
        lastIntent: z.string().optional(),
      }),
      execute: async (params) => {
        const { lead, crm } = await captureLead({
          sessionId,
          channel,
          ...params,
          source: "agent_tool",
        });
        return {
          success: true,
          leadId: lead.id,
          status: lead.status,
          crmSaved: crm.localSaved,
          crmWebhook: crm.webhookDelivered,
        };
      },
    }),

    score_lead: tool({
      description:
        "Score lead using NBAT: need, budget, authority, timeline (each 0-3). Updates lead status automatically.",
      parameters: z.object({
        need: scoreEnum,
        budget: scoreEnum,
        authority: scoreEnum,
        timeline: scoreEnum,
        notes: z.string().optional(),
      }),
      execute: async (scores) => {
        await ensureLeadsHydrated();
        const result = scoreLeadFromNbat(scores);
        const lead = mergeLeadRecord(sessionId, channel, {
          status: result.status,
          leadScore: result.total,
          leadCategory: result.category,
          nbat: scores,
          notes: scores.notes,
        });
        await saveLeadToCrm(lead);
        logEvent("lead_scored", sessionId, channel, {
          total: result.total,
          category: result.category,
          status: result.status,
        });
        if (result.category === "Hot Lead") {
          await notifyHotLead(lead);
          logEvent("hot_lead_alert", sessionId, channel, {
            leadId: lead.id,
            total: result.total,
          });
        }
        return { success: true, ...result, leadId: lead.id };
      },
    }),

    save_crm_summary: tool({
      description:
        "Create structured CRM summary at end of conversation or before handoff.",
      parameters: z.object({
        customerName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        businessName: z.string().optional(),
        serviceInterest: z.string().optional(),
        mainProblem: z.string().optional(),
        budget: z.string().optional(),
        timeline: z.string().optional(),
        leadScore: z.number().optional(),
        leadCategory: z.string().optional(),
        customerSentiment: z.string().optional(),
        objections: z.string().optional(),
        nextStep: z.string(),
        followUpDate: z.string().optional(),
        assignedTeam: z.string().optional(),
        conversationSummary: z.string(),
      }),
      execute: async (payload) => {
        const summaryText = Object.entries(payload)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");

        const record = saveCrmSummary({
          id: newId("crm"),
          sessionId,
          leadId: getLeadBySession(sessionId)?.id,
          createdAt: new Date().toISOString(),
          payload: payload as Record<string, string | number | undefined>,
        });

        const lead = mergeLeadRecord(sessionId, channel, {
          conversationSummary: payload.conversationSummary,
          crmSummary: summaryText,
          fullName: payload.customerName,
          phone: payload.phone,
          email: payload.email,
          businessName: payload.businessName,
          serviceNeeded: payload.serviceInterest,
          mainChallenge: payload.mainProblem,
          budgetRange: payload.budget,
          timeline: payload.timeline,
          leadScore: payload.leadScore,
          leadCategory: payload.leadCategory,
          sentiment: payload.customerSentiment,
          objections: payload.objections,
          followUpDate: payload.followUpDate,
          assignedTeam: payload.assignedTeam,
        });
        await saveLeadToCrm(lead);
        logEvent("crm_summary_saved", sessionId, channel, { crmId: record.id });
        return { success: true, crmSummaryId: record.id };
      },
    }),

    check_calendar_slots: tool({
      description: "Check available consultation slots for a given date.",
      parameters: z.object({
        preferredDate: z.string().optional().describe("ISO date YYYY-MM-DD"),
      }),
      execute: async ({ preferredDate }) => {
        const { configured, slots } = await getAvailableSlots(preferredDate);
        return {
          configured,
          slots,
          bookingUrl: booking.url || null,
        };
      },
    }),

    update_crm: tool({
      description: "Push latest lead snapshot to CRM webhook.",
      parameters: z.object({
        conversationSummary: z.string(),
      }),
      execute: async ({ conversationSummary }) => {
        const lead = getLeadBySession(sessionId);
        if (!lead) {
          return { success: false, message: "No lead for this session." };
        }
        const updated = mergeLeadRecord(sessionId, channel, { conversationSummary });
        await saveLeadToCrm(updated);
        return { success: true, leadId: updated.id };
      },
    }),

    book_appointment: tool({
      description:
        "Book consultation/demo. Requires full name and email. Uses calendar when configured.",
      parameters: z.object({
        fullName: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        meetingType: z.string(),
        preferredDate: z.string().optional(),
        preferredTime: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (params) => {
        let calendarEventId: string | undefined;
        if (params.preferredDate && params.preferredTime) {
          const start = `${params.preferredDate}T${params.preferredTime}`;
          const cal = await createCalendarEvent({
            summary: `${params.meetingType} — ${params.fullName}`,
            description: params.notes ?? "",
            start,
            end: start,
            attendeeEmail: params.email,
          });
          calendarEventId = cal.eventId;
        }

        const req = {
          id: newId("appt"),
          sessionId,
          channel,
          createdAt: new Date().toISOString(),
          ...params,
          calendarEventId,
        };
        saveAppointment(req);
        const bookedLead = mergeLeadRecord(sessionId, channel, {
          status: "Hot",
          fullName: params.fullName,
          email: params.email,
          phone: params.phone,
        });
        await saveLeadToCrm(bookedLead);
        logEvent("appointment_booked", sessionId, channel, {
          appointmentId: req.id,
        });

        return {
          success: true,
          appointmentId: req.id,
          bookingUrl: booking.url || null,
          calendarEventId,
          confirmation: `Thank you, ${params.fullName}. Your ${params.meetingType} is recorded${
            params.preferredDate
              ? ` for ${params.preferredDate} ${params.preferredTime ?? ""}`
              : ""
          }.`,
        };
      },
    }),

    schedule_follow_up: tool({
      description: "Schedule follow-up when customer is not ready.",
      parameters: z.object({
        email: z.string().email(),
        fullName: z.string().optional(),
        summary: z.string(),
        preferredContact: z.string().optional(),
        followUpAt: z.string().optional(),
      }),
      execute: async (params) => {
        await scheduleFollowUpWebhook(params);
        const followLead = mergeLeadRecord(sessionId, channel, {
          email: params.email,
          fullName: params.fullName,
          status: "Warm",
          conversationSummary: params.summary,
          followUpDate: params.followUpAt,
        });
        await saveLeadToCrm(followLead);
        logEvent("follow_up_scheduled", sessionId, channel);
        return { success: true };
      },
    }),

    escalate_to_human: tool({
      description: "Escalate to human for sensitive or complex issues.",
      parameters: z.object({
        reason: z.string(),
        urgency: z.enum(["low", "medium", "high", "critical"]),
        summary: z.string(),
        recommendedNextAction: z.string(),
        customerName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        leadStatus: z
          .enum(["Hot", "Warm", "Cold", "Support", "Not Qualified"])
          .optional(),
      }),
      execute: async (params) => {
        const payload = {
          id: newId("esc"),
          createdAt: new Date().toISOString(),
          sessionId,
          channel,
          ...params,
        };
        saveEscalation(payload);
        await notifyEscalation(payload);
        await notifyHumanAttention({
          reason: params.reason,
          sessionId,
          channel,
          summary: params.summary,
          urgency: params.urgency,
        });
        logEvent("human_attention_alert", sessionId, channel, {
          reason: params.reason,
          urgency: params.urgency,
        });
        if (params.email || params.customerName) {
          const escLead = mergeLeadRecord(sessionId, channel, {
            fullName: params.customerName,
            email: params.email,
            phone: params.phone,
            status: params.leadStatus ?? "Hot",
            conversationSummary: params.summary,
          });
          await saveLeadToCrm(escLead);
        }
        logEvent("escalation", sessionId, channel, {
          urgency: params.urgency,
          reason: params.reason,
        });
        return { success: true, escalationId: payload.id };
      },
    }),

    save_conversation_summary: tool({
      description:
        "Save a full conversation summary to CRM after qualification, handoff, or before closing the chat.",
      parameters: z.object({
        summary: z.string().describe("Full conversation summary for the team."),
        nextStep: z.string().optional(),
      }),
      execute: async ({ summary, nextStep }) => {
        const lead = mergeLeadRecord(sessionId, channel, {
          conversationSummary: summary,
          notes: nextStep
            ? `${summary}\n\nNext step: ${nextStep}`
            : summary,
        });
        await saveLeadToCrm(lead);
        logEvent("conversation_summary_saved", sessionId, channel, {
          leadId: lead.id,
          chars: summary.length,
        });
        return { success: true, leadId: lead.id };
      },
    }),

    log_analytics_event: tool({
      description: "Log funnel/analytics event for dashboard.",
      parameters: z.object({
        eventName: z.string(),
        metadata: z.record(z.unknown()).optional(),
      }),
      execute: async ({ eventName, metadata }) => {
        logEvent("message_sent", sessionId, channel, {
          custom: eventName,
          ...metadata,
        });
        return { success: true };
      },
    }),
  };
}
