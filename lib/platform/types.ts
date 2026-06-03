export type UserRole =
  | "super_admin"
  | "company_admin"
  | "sales_manager"
  | "sales_agent"
  | "support_agent"
  | "viewer";

export type AgentType = "sales" | "support" | "demo" | "booking" | "onboarding";
export type AgentStatus = "active" | "paused" | "draft";

export type LeadStatus =
  | "created"
  | "open"
  | "working"
  | "qualified"
  | "disqualified"
  | "opportunity_created"
  | "opportunity_lost"
  | "customer";

export type LeadCategory =
  | "hot"
  | "warm"
  | "cold"
  | "support"
  | "not_qualified";

export type ConversationStatus =
  | "new"
  | "ai_handling"
  | "waiting_customer"
  | "human_needed"
  | "assigned"
  | "booked"
  | "follow_up"
  | "resolved"
  | "closed";

export type BookingStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "missed"
  | "rescheduled"
  | "cancelled";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "paused"
  | "completed"
  | "failed";

export type IntegrationStatus = "connected" | "not_connected" | "needs_attention";

export interface Organization {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  address?: string | null;
  country?: string | null;
  currency?: string | null;
  description?: string | null;
  timezone?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  organization_id: string;
  full_name: string;
  role: UserRole;
  department?: string | null;
  avatar_url?: string | null;
  booking_email?: string | null;
  status?: string;
  created_at: string;
}

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  nickname?: string | null;
  company_product_name?: string | null;
  agent_type: AgentType;
  operational_role?: string | null;
  position?: string | null;
  language?: string | null;
  tone?: string | null;
  timezone?: string | null;
  voice?: string | null;
  voice_speed?: number | null;
  avatar_url?: string | null;
  presenter_config?: Record<string, unknown> | null;
  avatar_provider?: string | null;
  avatar_id?: string | null;
  avatar_replica_id?: string | null;
  avatar_persona_id?: string | null;
  avatar_voice_id?: string | null;
  avatar_style?: string | null;
  avatar_enabled?: boolean;
  avatar_fallback_mode?: string | null;
  avatar_provider_mode?: string | null;
  avatar_preferred_provider?: string | null;
  avatar_allow_auto_switch?: boolean;
  welcome_message?: string | null;
  system_prompt?: string | null;
  qualification_prompt?: string | null;
  objection_prompt?: string | null;
  handoff_rules?: string | null;
  booking_rules?: string | null;
  crm_update_rules?: string | null;
  lead_scoring_rules?: string | null;
  fallback_response?: string | null;
  channels: string[];
  status: AgentStatus;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntry {
  id: string;
  knowledge_base_id: string;
  organization_id: string;
  title: string;
  category: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  business_name?: string | null;
  service_interest?: string | null;
  budget?: string | null;
  timeline?: string | null;
  source?: string | null;
  lead_score?: number | null;
  lead_category?: LeadCategory | null;
  lead_status: LeadStatus;
  assigned_to?: string | null;
  summary?: string | null;
  next_action?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  marketing_opt_in?: boolean | null;
  unsubscribed_at?: string | null;
  do_not_call?: boolean | null;
  do_not_call_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  agent_id?: string | null;
  lead_id?: string | null;
  session_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  channel: string;
  status: ConversationStatus;
  conversation_stage?: string | null;
  detected_intent?: string | null;
  ai_confidence?: number | null;
  summary?: string | null;
  recommended_next_action?: string | null;
  assigned_to?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: "user" | "assistant" | "system" | "staff";
  sender_name?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type BookingProvider = "internal" | "google_calendar" | "calendly";

export interface Booking {
  id: string;
  organization_id: string;
  agent_id?: string | null;
  lead_id?: string | null;
  conversation_id?: string | null;
  title: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_needed?: string | null;
  meeting_date?: string | null;
  meeting_time?: string | null;
  meeting_type?: string | null;
  meeting_type_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  duration_minutes?: number | null;
  assigned_to?: string | null;
  staff_email?: string | null;
  meeting_link?: string | null;
  google_calendar_event_id?: string | null;
  provider?: BookingProvider | null;
  external_event_id?: string | null;
  calendly_invitee_uri?: string | null;
  calendly_event_uri?: string | null;
  location_type?: string | null;
  webhook_payload?: Record<string, unknown> | null;
  status: BookingStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  organization_id: string;
  agent_id?: string | null;
  name: string;
  campaign_type?: string | null;
  status: CampaignStatus;
  scheduled_at?: string | null;
  follow_up_rules?: Record<string, unknown>;
  channel?: string | null;
  audience_filters?: Record<string, unknown>;
  stop_conditions?: Record<string, unknown>;
  message_template_id?: string | null;
  use_sequence?: boolean;
  voice_settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  lead_id: string;
  organization_id: string;
  status: "pending" | "sent" | "replied" | "failed" | "skipped";
  attempts?: number;
  last_sent_at?: string | null;
  last_error?: string | null;
  channels_sent?: string[];
  current_step_index?: number;
  next_step_at?: string | null;
  sequence_status?: "active" | "paused" | "completed" | "stopped";
  paused_reason?: string | null;
  replied_at?: string | null;
  created_at: string;
}

export type CampaignChannelMode = "whatsapp" | "email" | "both" | "auto";

export interface CampaignRunResult {
  campaignId: string;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: { leadId: string; error: string }[];
}

export interface AgentTask {
  id: string;
  organization_id: string;
  agent_id?: string | null;
  name: string;
  trigger_type: string;
  action_type: string;
  webhook_url?: string | null;
  http_method?: string | null;
  headers?: Record<string, string>;
  payload_template?: string | null;
  status: string;
  last_triggered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  organization_id: string;
  integration_type: string;
  status: IntegrationStatus;
  config?: Record<string, unknown>;
  last_tested_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalConversations: number;
  newLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  bookedMeetings: number;
  /** Qualified leads that converted to a booking (0–100). */
  bookingRate: number;
  pendingFollowUps: number;
  followUpsDue: number;
  humanHandoffs: number;
  activeCampaigns: number;
  campaignMessagesSent: number;
  campaignReplies: number;
  campaignBookingConversions: number;
  campaignFailedMessages: number;
  topCampaignName: string | null;
  aiResolutionRate: number;
  conversionRate: number;
  revenueOpportunity: number;
  totalCalls: number;
  callsToday: number;
  completedCalls: number;
  missedCalls: number;
  averageCallDurationSeconds: number;
  hotLeadsFromCalls: number;
  bookingsFromCalls: number;
  humanTransfersFromCalls: number;
  callConversionRate: number;
  totalDemos: number;
  demosToday: number;
  liveDemosNow: number;
  completedDemos: number;
  missedDemos: number;
  hotLeadsFromDemos: number;
  bookingsFromDemos: number;
  demosNeedingHandoff: number;
  humanTakeoversFromDemos: number;
  demoConversionRate: number;
  demosStarted?: number;
  demosWithPathSelected?: number;
  hotLeadsAfterPath?: number;
  mostSelectedDemoPath?: string | null;
  liveRoomsActive?: number;
  demosWithVideoEnabled?: number;
  staffJoinedDemos?: number;
  completedVideoDemos?: number;
  videoDemosWithBookings?: number;
}

export interface Notification {
  id: string;
  organization_id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  organization: Organization;
}
