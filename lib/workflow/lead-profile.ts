import type { LeadRecord } from "../types";
import {
  LEAD_PROFILE_FIELDS,
  type LeadProfileField,
  type LeadProfileGaps,
} from "./types";

function fieldValue(lead: LeadRecord | undefined, field: LeadProfileField): string | undefined {
  if (!lead) return undefined;
  const v = lead[field];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function analyzeLeadProfile(lead: LeadRecord | undefined): LeadProfileGaps {
  const collected: LeadProfileField[] = [];
  const missing: LeadProfileField[] = [];

  for (const field of LEAD_PROFILE_FIELDS) {
    if (fieldValue(lead, field)) {
      collected.push(field);
    } else {
      missing.push(field);
    }
  }

  const completenessPercent = Math.round(
    (collected.length / LEAD_PROFILE_FIELDS.length) * 100
  );

  return { collected, missing, completenessPercent };
}

export function buildLeadCollectionHint(gaps: LeadProfileGaps): string {
  if (gaps.missing.length === 0) {
    return "Lead profile is complete enough to recommend next step, score (score_lead), and offer booking.";
  }

  const friendly: Record<LeadProfileField, string> = {
    fullName: "name",
    phone: "phone",
    email: "email",
    businessName: "business name",
    serviceNeeded: "service interest",
    budgetRange: "budget range",
    timeline: "timeline",
  };

  const need = gaps.missing.map((f) => friendly[f]).join(", ");
  return `Still collect (naturally, one or two at a time): ${need}. Use save_lead when you learn each fact.`;
}
