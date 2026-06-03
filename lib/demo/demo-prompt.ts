import type { Agent } from "@/lib/platform/types";
import type { DemoAsset, DemoPath } from "./types";
import type { DemoStage } from "./types";

export function buildDemoSystemPrompt(params: {
  agent: Agent;
  knowledgeContext: string;
  assets: DemoAsset[];
  currentStage: DemoStage | string;
  companyName?: string;
  selectedPath?: DemoPath | null;
  voiceMode?: boolean;
}): string {
  const { agent, knowledgeContext, assets, currentStage, selectedPath, voiceMode } = params;
  const company =
    params.companyName ?? agent.company_product_name ?? "our company";

  const assetList = assets
    .slice(0, 12)
    .map(
      (a, i) =>
        `${i + 1}. [${a.asset_type}] ${a.title} (id: ${a.id})\n${a.content.slice(0, 400)}`
    )
    .join("\n\n");

  const pathBlock = selectedPath
    ? `## Active demo path: ${selectedPath.title}
${selectedPath.description ?? ""}
Recommended CTA: ${selectedPath.recommended_cta ?? "Book a consultation"}
Qualification focus: ${(selectedPath.qualification_questions ?? []).slice(0, 3).join(" | ")}`
    : "";

  return [
    `You are ${agent.name}, a premium AI sales demo presenter for ${company}.`,
    `You are hosting a guided sales presentation room — not a generic chatbot.`,
    agent.system_prompt ?? "",
    agent.qualification_prompt && `Qualification:\n${agent.qualification_prompt}`,
    agent.objection_prompt && `Objection handling:\n${agent.objection_prompt}`,
    agent.handoff_rules && `Handoff rules:\n${agent.handoff_rules}`,
    agent.booking_rules && `Booking:\n${agent.booking_rules}`,
    agent.fallback_response && `When unsure:\n${agent.fallback_response}`,
    voiceMode
      ? `\n## Voice presentation rules
- Spoken aloud: 2–3 short sentences maximum. One question only.
- Natural, conversational tone. Do not read lists or long paragraphs.
- Mention the on-screen slide briefly by title when presenting.
- Never invent pricing or policies. If unsure, offer human assistance.
- Current stage: ${currentStage}.`
      : `\n## Presentation rules
- Short, confident responses (2–4 sentences). ONE discovery question at a time.
- Current stage: ${currentStage}.
- Reference the on-screen demo asset by title when presenting.
- After need_discovery, confirm the demo path then present the first relevant slide.
- Do NOT invent pricing, policies, guarantees, or case studies outside the knowledge base.
- Tone: executive, consultative, premium agency.`,
    pathBlock,
    knowledgeContext && `## Knowledge base\n${knowledgeContext}`,
    assetList && `## Demo assets in this path\n${assetList}`,
    `## Stage flow
welcome → need_discovery → demo_path_selection → presentation → value_explanation → objection_handling → qualification → recommendation → booking → human_handoff → close`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
