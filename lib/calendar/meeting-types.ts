import type { CalendarSettings, MeetingType, MeetingTypeKey } from "./types";

export const DEFAULT_MEETING_TYPES: MeetingType[] = [
  {
    key: "sales_consultation",
    label: "Sales Consultation",
    description: "Discuss your needs with a sales specialist.",
    duration_minutes: 30,
    enabled: true,
    sort_order: 1,
    provider: "both",
    assigned_profile_id: null,
    location_type: "google_meet",
    calendly_event_type_url: null,
    status: "active",
  },
  {
    key: "product_demo",
    label: "Product Demo",
    description: "Live walkthrough of the platform.",
    duration_minutes: 45,
    enabled: true,
    sort_order: 2,
    provider: "both",
    assigned_profile_id: null,
    location_type: "google_meet",
    calendly_event_type_url: null,
    status: "active",
  },
  {
    key: "strategy_session",
    label: "Strategy Session",
    description: "Deep-dive planning with a senior advisor.",
    duration_minutes: 60,
    enabled: true,
    sort_order: 3,
    provider: "both",
    assigned_profile_id: null,
    location_type: "google_meet",
    calendly_event_type_url: null,
    status: "active",
  },
  {
    key: "support_call",
    label: "Support Call",
    description: "Technical or account support session.",
    duration_minutes: 30,
    enabled: true,
    sort_order: 4,
    provider: "both",
    assigned_profile_id: null,
    location_type: "phone",
    calendly_event_type_url: null,
    status: "active",
  },
];

export function mergeMeetingTypes(stored: MeetingType[] | null | undefined): MeetingType[] {
  if (!stored?.length) return DEFAULT_MEETING_TYPES;
  const byKey = new Map(stored.map((m) => [m.key, m]));
  return DEFAULT_MEETING_TYPES.map((def) => {
    const existing = byKey.get(def.key);
    if (!existing) return def;
    return {
      ...def,
      ...existing,
      key: def.key,
      provider: existing.provider ?? def.provider,
      location_type: existing.location_type ?? def.location_type,
      status: existing.status ?? def.status,
      calendly_event_type_url:
        existing.calendly_event_type_url ?? def.calendly_event_type_url,
      assigned_profile_id:
        existing.assigned_profile_id ?? def.assigned_profile_id,
    };
  });
}

export function getMeetingType(
  types: MeetingType[],
  key: string
): MeetingType | undefined {
  return types.find((t) => t.key === key && t.enabled && t.status === "active");
}

export function meetingTypeLabel(key: MeetingTypeKey): string {
  return DEFAULT_MEETING_TYPES.find((m) => m.key === key)?.label ?? key;
}

export function resolveMeetingTypeProvider(
  meetingType: MeetingType,
  defaultProvider: CalendarSettings["default_booking_provider"]
): "google_calendar" | "calendly" {
  if (meetingType.provider === "google_calendar") return "google_calendar";
  if (meetingType.provider === "calendly") return "calendly";
  if (defaultProvider === "calendly") return "calendly";
  if (defaultProvider === "google_calendar") return "google_calendar";
  return "google_calendar";
}
