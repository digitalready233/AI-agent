import {
  READYBOT_BUDGET_QUICK_REPLIES,
  READYBOT_SERVICE_QUICK_REPLIES,
} from "@/lib/platform/playbooks/digital-ready-readybot";
import { isReadybotStyleAgent } from "@/lib/platform/workflow/readybot-stage-directives";
import type { Agent, Conversation } from "@/lib/platform/types";
import type { WorkflowStage } from "@/lib/platform/workflow/schemas";

export type WhatsAppReplyButton = {
  id: string;
  title: string;
  message: string;
};

/** WhatsApp Cloud API: button title max 20 characters. */
function waTitle(label: string, max = 20): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export const READYBOT_WA_BUDGET_BUTTONS: WhatsAppReplyButton[] = [
  {
    id: "dr_tier_a",
    title: waTitle("Tier A · SME"),
    message: READYBOT_BUDGET_QUICK_REPLIES[0].message,
  },
  {
    id: "dr_tier_b",
    title: waTitle("Tier B · Growth"),
    message: READYBOT_BUDGET_QUICK_REPLIES[1].message,
  },
  {
    id: "dr_tier_c",
    title: waTitle("Tier C · Enterprise"),
    message: READYBOT_BUDGET_QUICK_REPLIES[2].message,
  },
];

export const READYBOT_WA_PILLAR_BUTTONS: WhatsAppReplyButton[] = [
  {
    id: "dr_pillar_ads",
    title: waTitle("Paid ads & leads"),
    message: READYBOT_SERVICE_QUICK_REPLIES[0].message,
  },
  {
    id: "dr_pillar_social",
    title: waTitle("Social & branding"),
    message: READYBOT_SERVICE_QUICK_REPLIES[1].message,
  },
  {
    id: "dr_pillar_transform",
    title: waTitle("Full transformation"),
    message: READYBOT_SERVICE_QUICK_REPLIES[2].message,
  },
];

const BUTTON_MESSAGE_BY_ID = new Map<string, string>(
  [...READYBOT_WA_BUDGET_BUTTONS, ...READYBOT_WA_PILLAR_BUTTONS].map((b) => [
    b.id,
    b.message,
  ])
);

export function resolveReadybotButtonReplyText(buttonId: string): string | null {
  return BUTTON_MESSAGE_BY_ID.get(buttonId) ?? null;
}

type ReadybotWaButtonsMeta = {
  qualification?: boolean;
  discovery?: boolean;
};

function readButtonsMeta(
  metadata: Record<string, unknown> | undefined
): ReadybotWaButtonsMeta {
  const raw = metadata?.readybot_wa_buttons;
  if (!raw || typeof raw !== "object") return {};
  return raw as ReadybotWaButtonsMeta;
}

export function readybotWhatsAppInteractiveFollowUp(params: {
  agent: Agent;
  conversation: Conversation;
  stage: WorkflowStage;
  handoffRequired: boolean;
}): { body: string; buttons: WhatsAppReplyButton[]; metaKey: keyof ReadybotWaButtonsMeta } | null {
  const { agent, conversation, stage, handoffRequired } = params;
  if (handoffRequired) return null;
  if (!isReadybotStyleAgent(agent)) return null;
  if (!agent.channels?.includes("whatsapp")) return null;

  const sent = readButtonsMeta(conversation.metadata ?? undefined);

  if (stage === "qualification" && !sent.qualification) {
    return {
      body: "Tap your **investment tier** (qualification only — not a final quote):",
      buttons: READYBOT_WA_BUDGET_BUTTONS,
      metaKey: "qualification",
    };
  }

  if (stage === "discovery" && !sent.discovery) {
    return {
      body: "Which area fits your goal best?",
      buttons: READYBOT_WA_PILLAR_BUTTONS,
      metaKey: "discovery",
    };
  }

  return null;
}

export function mergeReadybotButtonsSent(
  metadata: Record<string, unknown> | undefined,
  metaKey: keyof ReadybotWaButtonsMeta
): Record<string, unknown> {
  const prev = readButtonsMeta(metadata);
  return {
    ...(metadata ?? {}),
    readybot_wa_buttons: { ...prev, [metaKey]: true },
  };
}
