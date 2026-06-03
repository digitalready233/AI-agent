/** Internal booking foundation types */

export type MeetingTypeProvider = "internal" | "google_calendar" | "calendly";
export type MeetingLocationType =
  | "phone_call"
  | "google_meet"
  | "zoom"
  | "office"
  | "custom";
export type MeetingTypeStatus = "active" | "inactive";

export interface MeetingTypeRecord {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  provider: MeetingTypeProvider;
  location_type: MeetingLocationType;
  assigned_staff: string | null;
  status: MeetingTypeStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StaffAvailabilityRecord {
  id: string;
  organization_id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_available: boolean;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface BookingSettings {
  organization_id: string;
  default_booking_provider: MeetingTypeProvider | "both";
  timezone: string;
  default_meeting_duration_minutes: number;
  minimum_notice_hours: number;
  maximum_days_ahead: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  slot_interval_minutes: number;
  default_assigned_profile_id: string | null;
  updated_at: string;
}

export interface AvailableSlot {
  start: string;
  end: string;
  label: string;
}
