import { workflowGenerateObject } from "@/lib/platform/workflow/llm-invoke";
import type { WorkflowRuntimeContext } from "@/lib/platform/workflow/workflow-context";
import { SALES_DEMO_STAGES } from "./demo-stages";
import { demoAnalysisSchema, type DemoAnalysis } from "./demo-schemas";
import type { DemoPath } from "./types";
import { selectDemoPathFromMessage } from "./select-demo-path";

export async function analyzeDemoTurn(params: {
  ctx: WorkflowRuntimeContext;
  customerMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  knowledgeContext: string;
  assetsSummary: string;
  pathsSummary: string;
  demoPaths: DemoPath[];
  currentStage: string;
  currentAssetId?: string | null;
  priorSummary?: string | null;
  scheduledLeadContext?: string;
  entryMode?: string;
  inputType?: "text" | "voice";
}): Promise<DemoAnalysis> {
  const {
    ctx,
    customerMessage,
    history,
    knowledgeContext,
    assetsSummary,
    pathsSummary,
    demoPaths,
    currentStage,
    currentAssetId,
    priorSummary,
    scheduledLeadContext,
    entryMode,
    inputType,
  } = params;

  const keywordPath = selectDemoPathFromMessage(customerMessage, demoPaths);

  const system = `You analyze live AI sales demo presentation calls. Output valid JSON matching the schema only.

You are guiding a premium sales presentation — NOT a casual chat. Advance stages deliberately.

## Demo stages
${SALES_DEMO_STAGES.join(", ")}

Stage guidance:
- welcome: greet and ask what they want to explore
- need_discovery: clarify goals, industry, pain
- demo_path_selection: confirm which service demo path fits (set selected_demo_path_id)
- presentation: walk through the current demo asset
- value_explanation: tie features to their business outcomes
- objection_handling: address concerns; tag detected_objection_tags
- qualification: capture BANT (one question at a time in your reasoning)
- recommendation: suggest the right package/next step
- booking: invite consultation when qualified (suggest_booking)
- human_handoff: only for explicit human request, complaints, custom pricing, outside knowledge
- close: wrap up

## Demo paths (select one via selected_demo_path_id when clear)
${pathsSummary || "No paths configured."}
Keyword hint for this message: ${keywordPath.path?.title ?? "none"} (${keywordPath.reason})

Path selection rules:
- social media, Instagram, TikTok, Facebook, content, posting, reels, captions, account management → Social Media Management Demo
- website, ecommerce, online store, booking, payment, web development → Website Development Demo
- ads, paid ads, leads, customers, traffic, Meta ads, Google ads → Digital Advertising Demo
- logo, brand, identity, design, flyers, visual identity → Branding & Creative Design Demo
- everything, full package, digital growth, online presence, brand growth → Full Digital Growth Package Demo

## Scoring (0-3 each dimension; sum 0-12)
- need, budget, authority, timeline: score 0-3 each
- Total 0-3 = Cold, 4-7 = Warm, 8-12 = Hot (when BANT is strong)

## Assets
Pick next_asset_id from list when the slide should change. Use exact UUID.

## Objection tags (detected_objection_tags array)
price_concern, timing_concern, trust_concern, competitor_comparison, needs_approval, custom_package, unclear_service_need, not_ready_yet

## Booking
suggest_booking when warm/hot AND (budget+timeline OR asks for next step OR requests consultation).

## Handoff (handoff_required)
Set true when: human requested, complaint, custom pricing, outside knowledge, low confidence, ready to pay, or serious objection.

## Extraction
Capture industry, main_goal, service_interest, business_name, budget (keep currency), timeline, authority.

## Voice turns
${inputType === "voice" ? "Prospect spoke aloud (voice). Keep extraction tight. Prefer one clear next question. Advance presentation stage when appropriate." : "Text chat turn."}

Entry mode: ${entryMode ?? "scheduled"}
${scheduledLeadContext ? `\n## Scheduled lead context (use in welcome)\n${scheduledLeadContext}` : ""}

Company: ${ctx.agent.company_product_name ?? "the company"}
Current stage: ${currentStage}
${currentAssetId ? `Current asset on screen: ${currentAssetId}` : ""}
${priorSummary ? `Prior summary: ${priorSummary}` : ""}

Assets:
${assetsSummary || "None"}`;

  const recent = history.slice(-12);
  const userContent = [
    ...recent.map((m) => `${m.role === "user" ? "Prospect" : "Agent"}: ${m.content}`),
    `Prospect: ${customerMessage}`,
  ].join("\n");

  const object = await workflowGenerateObject({
    label: "demo-analyze",
    system,
    prompt: userContent,
    schema: demoAnalysisSchema,
    temperature: 0.35,
  });

  if (!object.selected_demo_path_id && keywordPath.path) {
    return { ...object, selected_demo_path_id: keywordPath.path.id };
  }

  return object;
}
