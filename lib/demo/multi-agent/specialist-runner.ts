import { workflowGenerateText } from "@/lib/platform/workflow/llm-invoke";
import { getAgent } from "@/lib/platform/data";
import type { Agent } from "@/lib/platform/types";
import type { DemoSession } from "../types";
import type {
  BookingAgentOutput,
  CrmSummaryAgentOutput,
  DemoAgentRole,
  FollowUpAgentOutput,
  HandoffAgentOutput,
  ObjectionAgentOutput,
  PresenterAgentOutput,
  QualificationAgentOutput,
} from "./types";

function parseJsonBlock<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(body) as T;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function agentPrompt(agent: Agent, roleHint: string): string {
  return [
    `You are a specialist ${roleHint} for ${agent.company_product_name ?? agent.name}.`,
    agent.system_prompt?.trim() ? `Core instructions:\n${agent.system_prompt}` : "",
    agent.qualification_prompt?.trim() && roleHint.includes("qualification")
      ? `Qualification:\n${agent.qualification_prompt}`
      : "",
    agent.objection_prompt?.trim() && roleHint.includes("objection")
      ? `Objections:\n${agent.objection_prompt}`
      : "",
    agent.handoff_rules?.trim() && roleHint.includes("handoff")
      ? `Handoff:\n${agent.handoff_rules}`
      : "",
    agent.booking_rules?.trim() && roleHint.includes("booking")
      ? `Booking:\n${agent.booking_rules}`
      : "",
    agent.crm_update_rules?.trim() && roleHint.includes("CRM")
      ? `CRM:\n${agent.crm_update_rules}`
      : "",
    agent.lead_scoring_rules?.trim()
      ? `Scoring:\n${agent.lead_scoring_rules}`
      : "",
    "Respond with valid JSON only. No markdown outside the JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runQualificationAgent(params: {
  agentId: string;
  customerMessage: string;
  history: string;
  session: DemoSession;
}): Promise<QualificationAgentOutput> {
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error("Qualification agent not found");

  const raw = await workflowGenerateText({
    label: "demo-qualification-agent",
    system: agentPrompt(agent, "lead qualification"),
    messages: [
      {
        role: "user",
        content: `Customer message: ${params.customerMessage}\n\nRecent history:\n${params.history}\n\nCurrent BANT flags: ${JSON.stringify(params.session.qualification_progress ?? {})}\n\nReturn JSON:\n{"leadUpdates":{"full_name":"","phone":"","email":"","business_name":"","industry":"","service_interest":"","main_goal":"","budget":"","timeline":"","authority":"","pain_points":[]},"leadScore":{"need":0,"budget":0,"authority":0,"timeline":0,"total":0},"leadCategory":"cold|warm|hot","qualificationProgress":{"need":false,"budget":false,"authority":false,"timeline":false},"reasoning":""}`,
      },
    ],
    maxTokens: 500,
  });

  const parsed = parseJsonBlock<QualificationAgentOutput>(raw);
  if (!parsed?.leadScore) {
    return {
      leadUpdates: {},
      leadScore: { need: 0, budget: 0, authority: 0, timeline: 0, total: 0 },
      leadCategory: params.session.lead_category ?? "cold",
      qualificationProgress: params.session.qualification_progress ?? {
        need: false,
        budget: false,
        authority: false,
        timeline: false,
      },
      reasoning: "Fallback: could not parse qualification output",
    };
  }
  const total =
    (parsed.leadScore.need ?? 0) +
    (parsed.leadScore.budget ?? 0) +
    (parsed.leadScore.authority ?? 0) +
    (parsed.leadScore.timeline ?? 0);
  parsed.leadScore.total = parsed.leadScore.total ?? total;
  return parsed;
}

export async function runObjectionAgent(params: {
  agentId: string;
  customerMessage: string;
  history: string;
  priorObjections: string[];
}): Promise<ObjectionAgentOutput> {
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error("Objection agent not found");

  const raw = await workflowGenerateText({
    label: "demo-objection-agent",
    system: agentPrompt(agent, "objection handling"),
    messages: [
      {
        role: "user",
        content: `Message: ${params.customerMessage}\nHistory:\n${params.history}\nPrior objections: ${params.priorObjections.join(", ") || "none"}\n\nReturn JSON:\n{"objections":["price_concern"],"objectionType":"price_concern","severity":"low|medium|high","suggestedResponse":"","humanCloserNeeded":false,"reasoning":""}`,
      },
    ],
    maxTokens: 400,
  });

  const parsed = parseJsonBlock<ObjectionAgentOutput>(raw);
  return (
    parsed ?? {
      objections: [],
      objectionType: null,
      severity: "low",
      suggestedResponse: "",
      humanCloserNeeded: false,
      reasoning: "Fallback: no objection parsed",
    }
  );
}

export async function runBookingAgent(params: {
  agentId: string;
  customerMessage: string;
  leadCategory: string;
  qualificationSummary: string;
}): Promise<BookingAgentOutput> {
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error("Booking agent not found");

  const raw = await workflowGenerateText({
    label: "demo-booking-agent",
    system: agentPrompt(agent, "booking"),
    messages: [
      {
        role: "user",
        content: `Message: ${params.customerMessage}\nLead category: ${params.leadCategory}\nQualification: ${params.qualificationSummary}\n\nReturn JSON:\n{"bookingRecommended":false,"meetingType":"consultation","urgency":"low|medium|high","bookingMessage":"","reasoning":""}`,
      },
    ],
    maxTokens: 300,
  });

  return (
    parseJsonBlock<BookingAgentOutput>(raw) ?? {
      bookingRecommended: false,
      meetingType: "consultation",
      urgency: "low",
      bookingMessage: "",
      reasoning: "Fallback booking agent",
    }
  );
}

export async function runHandoffAgent(params: {
  agentId: string;
  customerMessage: string;
  leadCategory: string;
  objectionSeverity?: string;
  aiConfidenceLow?: boolean;
}): Promise<HandoffAgentOutput> {
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error("Handoff agent not found");

  const raw = await workflowGenerateText({
    label: "demo-handoff-agent",
    system: agentPrompt(agent, "handoff"),
    messages: [
      {
        role: "user",
        content: `Message: ${params.customerMessage}\nLead: ${params.leadCategory}\nObjection severity: ${params.objectionSeverity ?? "none"}\nLow AI confidence: ${params.aiConfidenceLow ?? false}\n\nReturn JSON:\n{"handoffRequired":false,"handoffReason":"","recommendedStaffRole":"sales_manager","urgency":"low|medium|high","reasoning":""}`,
      },
    ],
    maxTokens: 300,
  });

  return (
    parseJsonBlock<HandoffAgentOutput>(raw) ?? {
      handoffRequired: false,
      handoffReason: null,
      recommendedStaffRole: "sales",
      urgency: "low",
      reasoning: "Fallback handoff agent",
    }
  );
}

export async function runCrmSummaryAgent(params: {
  agentId: string;
  customerMessage: string;
  history: string;
  priorSummary: string | null;
}): Promise<CrmSummaryAgentOutput> {
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error("CRM summary agent not found");

  const raw = await workflowGenerateText({
    label: "demo-crm-summary-agent",
    system: agentPrompt(agent, "CRM summary"),
    messages: [
      {
        role: "user",
        content: `New message: ${params.customerMessage}\nHistory:\n${params.history}\nPrior summary: ${params.priorSummary ?? "none"}\n\nReturn JSON:\n{"crmSummaryUpdate":"2-3 sentence internal summary","conversationSummary":"","leadNotes":"","nextAction":"","reasoning":""}`,
      },
    ],
    maxTokens: 400,
  });

  return (
    parseJsonBlock<CrmSummaryAgentOutput>(raw) ?? {
      crmSummaryUpdate: params.priorSummary ?? "Demo in progress.",
      conversationSummary: "",
      leadNotes: "",
      nextAction: "Continue discovery",
      reasoning: "Fallback CRM summary",
    }
  );
}

export async function runFollowUpAgent(params: {
  agentId: string;
  session: DemoSession;
  isDemoEnding?: boolean;
}): Promise<FollowUpAgentOutput> {
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error("Follow-up agent not found");

  const raw = await workflowGenerateText({
    label: "demo-follow-up-agent",
    system: agentPrompt(agent, "follow-up"),
    messages: [
      {
        role: "user",
        content: `Demo status: ${params.session.status}\nSummary: ${params.session.summary ?? "none"}\nLead category: ${params.session.lead_category ?? "unknown"}\nEnding: ${params.isDemoEnding ?? false}\n\nReturn JSON:\n{"followUpRecommendation":"","followUpMessageDraft":"","recommendedFollowUpTime":"within 24h","assignedStaffSuggestion":"","createTask":false,"reasoning":""}`,
      },
    ],
    maxTokens: 350,
  });

  return (
    parseJsonBlock<FollowUpAgentOutput>(raw) ?? {
      followUpRecommendation: "Send a thank-you and recap within 24 hours.",
      followUpMessageDraft: "",
      recommendedFollowUpTime: "within 24h",
      assignedStaffSuggestion: null,
      createTask: false,
      reasoning: "Fallback follow-up",
    }
  );
}

export async function runPresenterAgent(params: {
  agentId: string;
  systemPrompt: string;
  customerMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  internalBrief: string;
  handoffRequired: boolean;
  suggestBooking: boolean;
  handoffMessage?: string;
  bookingMessage?: string;
  voiceMode?: boolean;
}): Promise<PresenterAgentOutput> {
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error("Presenter agent not found");

  const extra = [
    "INTERNAL TEAM BRIEF (do not mention these agents to the customer):",
    params.internalBrief,
    params.handoffRequired
      ? `IMPORTANT: ${params.handoffMessage ?? "A team member will join shortly."}`
      : "",
    params.suggestBooking
      ? `${params.bookingMessage ?? "Scheduling a consultation is the best next step."} Invite them to use the booking panel.`
      : "",
    params.voiceMode
      ? "VOICE: 2-3 short sentences, one question max."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const text = await workflowGenerateText({
    label: "demo-presenter-agent",
    system: `${params.systemPrompt}\n\n${extra}`,
    messages: [
      ...params.history.slice(-12),
      { role: "user", content: params.customerMessage },
    ],
    maxTokens: params.voiceMode ? 220 : 400,
  });

  return {
    customerResponse: text.trim(),
    demoStage: "presentation",
    recommendedNextAction: "Continue the demo conversation",
    reasoning: "Presenter response generated",
  };
}

export type SpecialistRunResult<T> = {
  role: DemoAgentRole;
  agentId: string | null;
  output: T | null;
  error?: string;
};
