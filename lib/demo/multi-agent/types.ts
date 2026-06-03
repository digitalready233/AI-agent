import type { LeadCategory } from "@/lib/platform/types";
import type { DemoQualificationProgress, DemoStage } from "../types";

export const DEMO_AGENT_ROLES = [
  "presenter_agent",
  "qualification_agent",
  "objection_agent",
  "booking_agent",
  "crm_summary_agent",
  "handoff_agent",
  "follow_up_agent",
] as const;

export type DemoAgentRole = (typeof DEMO_AGENT_ROLES)[number];

export const AGENT_OPERATIONAL_ROLES = [
  "general_sales",
  "demo_presenter",
  "lead_qualification",
  "objection_handling",
  "booking",
  "crm_summary",
  "handoff",
  "follow_up",
] as const;

export type AgentOperationalRole = (typeof AGENT_OPERATIONAL_ROLES)[number];

export const OPERATIONAL_ROLE_TO_DEMO_ROLE: Partial<
  Record<AgentOperationalRole, DemoAgentRole>
> = {
  demo_presenter: "presenter_agent",
  lead_qualification: "qualification_agent",
  objection_handling: "objection_agent",
  booking: "booking_agent",
  crm_summary: "crm_summary_agent",
  handoff: "handoff_agent",
  follow_up: "follow_up_agent",
};

export const DEMO_ROLE_LABELS: Record<DemoAgentRole, string> = {
  presenter_agent: "Presenter",
  qualification_agent: "Qualification",
  objection_agent: "Objection handling",
  booking_agent: "Booking",
  crm_summary_agent: "CRM summary",
  handoff_agent: "Handoff",
  follow_up_agent: "Follow-up",
};

export const OPERATIONAL_ROLE_LABELS: Record<AgentOperationalRole, string> = {
  general_sales: "General Sales Agent",
  demo_presenter: "Demo Presenter Agent",
  lead_qualification: "Lead Qualification Agent",
  objection_handling: "Objection Handling Agent",
  booking: "Booking Agent",
  crm_summary: "CRM Summary Agent",
  handoff: "Handoff Agent",
  follow_up: "Follow-Up Agent",
};

export type MultiAgentAssignmentMode =
  | "same_agent"
  | "org_default_team"
  | "smart_assignment"
  | "manual";

export type MultiAgentExecutionMode = "sequential" | "parallel_future";

export type MultiAgentDemoSettings = {
  enabled: boolean;
  execution_mode: MultiAgentExecutionMode;
  save_internal_reasoning: boolean;
  show_team_analysis_to_admins: boolean;
  default_team: Partial<Record<DemoAgentRole, string | null>>;
};

export const DEFAULT_MULTI_AGENT_DEMO_SETTINGS: MultiAgentDemoSettings = {
  enabled: false,
  execution_mode: "sequential",
  save_internal_reasoning: true,
  show_team_analysis_to_admins: true,
  default_team: {},
};

export type DemoAgentAssignment = {
  id: string;
  organization_id: string;
  demo_session_id: string;
  agent_id: string;
  agent_role: DemoAgentRole | string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MultiAgentEvent = {
  id: string;
  organization_id: string;
  demo_session_id: string;
  agent_role: DemoAgentRole | string;
  agent_id: string | null;
  event_type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type QualificationAgentOutput = {
  leadUpdates: Record<string, string | undefined>;
  leadScore: { need: number; budget: number; authority: number; timeline: number; total: number };
  leadCategory: LeadCategory | string;
  qualificationProgress: DemoQualificationProgress;
  serviceInterest?: string;
  industry?: string;
  painPoints?: string[];
  reasoning?: string;
};

export type ObjectionAgentOutput = {
  objections: string[];
  objectionType?: string | null;
  severity?: "low" | "medium" | "high";
  suggestedResponse?: string;
  humanCloserNeeded?: boolean;
  reasoning?: string;
};

export type BookingAgentOutput = {
  bookingRecommended: boolean;
  meetingType?: string | null;
  urgency?: "low" | "medium" | "high";
  bookingMessage?: string;
  reasoning?: string;
};

export type HandoffAgentOutput = {
  handoffRequired: boolean;
  handoffReason?: string | null;
  recommendedStaffRole?: string | null;
  urgency?: "low" | "medium" | "high";
  reasoning?: string;
};

export type CrmSummaryAgentOutput = {
  crmSummaryUpdate: string;
  conversationSummary?: string;
  leadNotes?: string;
  nextAction?: string;
  reasoning?: string;
};

export type FollowUpAgentOutput = {
  followUpRecommendation: string;
  followUpMessageDraft?: string;
  recommendedFollowUpTime?: string | null;
  assignedStaffSuggestion?: string | null;
  createTask?: boolean;
  reasoning?: string;
};

export type PresenterAgentOutput = {
  customerResponse: string;
  demoStage: DemoStage | string;
  recommendedNextAction: string;
  reasoning?: string;
};

export type MultiAgentTurnInsights = {
  team: Record<DemoAgentRole, string | null>;
  qualification: QualificationAgentOutput | null;
  objection: ObjectionAgentOutput | null;
  booking: BookingAgentOutput | null;
  handoff: HandoffAgentOutput | null;
  crmSummary: CrmSummaryAgentOutput | null;
  followUp: FollowUpAgentOutput | null;
  presenter: PresenterAgentOutput | null;
  errors: Partial<Record<DemoAgentRole, string>>;
};

export type MultiAgentWorkflowOutput = {
  customerResponse: string;
  demoStage: string;
  selectedDemoPathId: string | null;
  currentDemoAssetId: string | null;
  nextDemoAssetId: string | null;
  leadUpdates: Record<string, unknown>;
  leadScore: QualificationAgentOutput["leadScore"];
  leadCategory: string;
  objections: string[];
  bookingRecommended: boolean;
  handoffRequired: boolean;
  crmSummaryUpdate: string;
  followUpRecommendation: string;
  recommendedNextAction: string;
  insights: MultiAgentTurnInsights;
};
