import { listLeads } from "./data";
import type { CampaignAudienceFilters } from "./campaign-types";
import { isVoiceCampaignChannel, parseAudienceFilters } from "./campaign-types";
import type { Lead } from "./types";

function hasDialablePhone(lead: Lead): boolean {
  const digits = (lead.phone ?? "").replace(/\D/g, "");
  return digits.length >= 9;
}

function matchesFilter(lead: Lead, filters: CampaignAudienceFilters): boolean {
  if (lead.do_not_call) return false;

  if (filters.require_marketing_opt_in !== false) {
    if (lead.marketing_opt_in === false || lead.unsubscribed_at) return false;
  }

  if (filters.lead_statuses?.length && lead.lead_status) {
    if (!filters.lead_statuses.includes(lead.lead_status)) return false;
  }

  if (filters.lead_categories?.length && lead.lead_category) {
    if (!filters.lead_categories.includes(lead.lead_category)) return false;
  }

  if (filters.sources?.length && lead.source) {
    if (!filters.sources.includes(lead.source)) return false;
  }

  if (filters.service_interests?.length && lead.service_interest) {
    const si = lead.service_interest.toLowerCase();
    if (!filters.service_interests.some((s) => si.includes(s.toLowerCase()))) return false;
  }

  if (filters.assigned_to) {
    if (lead.assigned_to !== filters.assigned_to) return false;
  }

  if (filters.last_contacted_before && lead.last_contacted_at) {
    if (new Date(lead.last_contacted_at) > new Date(filters.last_contacted_before)) {
      return false;
    }
  }

  if (filters.last_contacted_after && lead.last_contacted_at) {
    if (new Date(lead.last_contacted_at) < new Date(filters.last_contacted_after)) {
      return false;
    }
  } else if (filters.last_contacted_after && !lead.last_contacted_at) {
    return true;
  }

  return true;
}

/** Resolve audience from filters + manual lead ids. */
export async function resolveCampaignAudience(
  organizationId: string,
  rawFilters: unknown,
  options?: { channel?: string | null }
): Promise<Lead[]> {
  const filters = parseAudienceFilters(rawFilters);
  const all = await listLeads(organizationId);
  const manualIds = new Set(filters.manual_lead_ids ?? []);

  const fromFilters = all.filter((l) => matchesFilter(l, filters));
  const fromManual = all.filter((l) => manualIds.has(l.id));

  const byId = new Map<string, Lead>();
  for (const l of [...fromFilters, ...fromManual]) {
    byId.set(l.id, l);
  }
  let leads = [...byId.values()];
  if (isVoiceCampaignChannel(options?.channel)) {
    leads = leads.filter(hasDialablePhone);
  }
  return leads;
}

export async function previewCampaignAudienceCount(
  organizationId: string,
  rawFilters: unknown,
  options?: { channel?: string | null }
): Promise<number> {
  const leads = await resolveCampaignAudience(
    organizationId,
    rawFilters,
    options
  );
  return leads.length;
}
