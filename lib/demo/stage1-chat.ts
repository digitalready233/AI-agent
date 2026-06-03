import { getAgent } from "@/lib/platform/data";
import {
  appendDemoTranscript,
  getDemoSession,
  listDemoAssets,
  listDemoMessages,
  saveDemoMessage,
  saveDemoSession,
} from "./demo-data";
import { DEMO_STAGE1_PLACEHOLDER_REPLY } from "./config";

export async function runDemoStage1PlaceholderTurn(params: {
  demoSessionId: string;
  customerMessage: string;
  displayName?: string;
  email?: string;
}): Promise<{
  reply: string;
  current_demo_stage: string;
  booking_recommended: boolean;
  handoff_required: boolean;
  next_asset: {
    id: string;
    title: string;
    content: string;
    asset_type: string;
  } | null;
}> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session) throw new Error("Demo session not found");

  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  const now = new Date().toISOString();
  const prior = await listDemoMessages(params.demoSessionId);

  await saveDemoMessage({
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    demo_session_id: params.demoSessionId,
    sender_type: "prospect",
    sender_name: params.displayName ?? null,
    content: params.customerMessage,
    created_at: now,
  });

  const reply = DEMO_STAGE1_PLACEHOLDER_REPLY;
  await saveDemoMessage({
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    demo_session_id: params.demoSessionId,
    sender_type: "agent",
    sender_name: agent?.name ?? "AI Agent",
    content: reply,
    created_at: new Date().toISOString(),
  });

  const seq = prior.length;
  await appendDemoTranscript({
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    demo_session_id: params.demoSessionId,
    speaker: "prospect",
    content: params.customerMessage,
    sequence_num: seq,
    created_at: now,
  });
  await appendDemoTranscript({
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    demo_session_id: params.demoSessionId,
    speaker: "agent",
    content: reply,
    sequence_num: seq + 1,
    created_at: new Date().toISOString(),
  });

  const assets = session.agent_id
    ? await listDemoAssets(session.organization_id, session.agent_id)
    : [];
  const assetIndex = Math.min(Math.floor(prior.length / 2), Math.max(0, assets.length - 1));
  const nextAsset = assets[assetIndex] ?? assets[0] ?? null;

  const stageOrder = [
    "welcome",
    "discovery",
    "product_overview",
    "feature_explanation",
  ] as const;
  const stage =
    stageOrder[Math.min(prior.length, stageOrder.length - 1)] ?? "discovery";

  await saveDemoSession({
    ...session,
    status: "in_progress",
    current_demo_stage: stage,
    started_at: session.started_at ?? now,
    booking_recommended: session.booking_recommended,
    handoff_required: session.handoff_required,
    metadata: {
      ...(session.metadata ?? {}),
      stage1_placeholder: true,
      last_asset_id: nextAsset?.id,
    },
  });

  return {
    reply,
    current_demo_stage: stage,
    booking_recommended: session.booking_recommended,
    handoff_required: session.handoff_required,
    next_asset: nextAsset
      ? {
          id: nextAsset.id,
          title: nextAsset.title,
          content: nextAsset.content,
          asset_type: nextAsset.asset_type,
        }
      : null,
  };
}
