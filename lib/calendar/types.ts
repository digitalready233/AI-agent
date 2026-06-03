export type MeetingTypeKey =
  | "sales_consultation"
  | "product_demo"
  | "support_call"
  | "strategy_session";

export type BookingProvider = "internal" | "google_calendar" | "calendly";
export type DefaultBookingProvider = BookingProvider | "both";
export type LocationType = "google_meet" | "in_person" | "phone" | "calendly";
export type MeetingTypeStatus = "active" | "inactive";

export interface MeetingType {
  key: MeetingTypeKey;
  label: string;
  description: string;
  duration_minutes: number;
  enabled: boolean;
  sort_order: number;
  provider: BookingProvider | "both";
  assigned_profile_id: string | null;
  location_type: LocationType;
  calendly_event_type_url: string | null;
  status: MeetingTypeStatus;
}

export interface StaffAvailabilityBlock {
  id: string;
  profile_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  available: boolean;
}

export interface CalendlyEventTypeRef {
  id: string;
  name: string;
  scheduling_url: string;
  duration_minutes?: number;
}

/** Org booking configuration (stored in calendar_settings table). */
export interface CalendarSettings {
  organization_id: string;
  timezone: string;
  calendar_id: string;
  slot_interval_minutes: number;
  buffer_minutes: number;
  meeting_types: MeetingType[];
  staff_availability: StaffAvailabilityBlock[];
  updated_at: string;
  default_booking_provider: DefaultBookingProvider;
  enable_google_calendar: boolean;
  enable_calendly: boolean;
  default_meeting_duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  minimum_notice_hours: number;
  maximum_days_ahead: number;
  default_assigned_profile_id: string | null;
  enable_google_meet: boolean;
  connected_calendar_email: string | null;
  calendly_scheduling_url: string | null;
  calendly_event_types: CalendlyEventTypeRef[];
  /** Ordered profile IDs for round-robin assignment when no explicit assignee */
  round_robin_profile_ids: string[];
  last_round_robin_index: number;
}

export type BookingSettings = CalendarSettings;

export interface CalendarSlot {
  start: string;
  end: string;
  label: string;
}

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  connected_email: string | null;
  calendar_id: string;
  oauth_configured: boolean;
}

export interface CalendlyConnectionStatus {
  connected: boolean;
  user_uri: string | null;
  scheduling_url: string | null;
  token_configured: boolean;
}

export interface BookingProviderStatus {
  default_provider: DefaultBookingProvider;
  google: GoogleCalendarConnectionStatus;
  calendly: CalendlyConnectionStatus;
  enable_google_calendar: boolean;
  enable_calendly: boolean;
}
