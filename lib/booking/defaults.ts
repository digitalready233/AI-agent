import type { MeetingTypeRecord } from "./types";

export const DEFAULT_MEETING_TYPE_SEEDS: Omit<
  MeetingTypeRecord,
  "id" | "organization_id" | "created_at" | "updated_at"
>[] = [
  {
    slug: "sales_consultation",
    name: "Sales Consultation",
    description: "Discuss your needs with a sales specialist.",
    duration_minutes: 30,
    provider: "internal",
    location_type: "phone_call",
    assigned_staff: null,
    status: "active",
    sort_order: 1,
  },
  {
    slug: "product_demo",
    name: "Product Demo",
    description: "Live walkthrough of the platform.",
    duration_minutes: 45,
    provider: "internal",
    location_type: "google_meet",
    assigned_staff: null,
    status: "active",
    sort_order: 2,
  },
  {
    slug: "strategy_session",
    name: "Strategy Session",
    description: "Deep-dive planning with a senior advisor.",
    duration_minutes: 60,
    provider: "internal",
    location_type: "google_meet",
    assigned_staff: null,
    status: "active",
    sort_order: 3,
  },
  {
    slug: "support_call",
    name: "Support Call",
    description: "Technical or account support session.",
    duration_minutes: 30,
    provider: "internal",
    location_type: "phone_call",
    assigned_staff: null,
    status: "active",
    sort_order: 4,
  },
];
