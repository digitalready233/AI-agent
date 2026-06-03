import {
  bridgePublishDemoAiSync,
  isLiveKitAiBridgeEnabled,
} from "./livekit-ai-bridge-client";
import {
  buildDemoAiRoomSyncPayload,
  type DemoAiAudioStatus,
} from "./demo-livekit-ai-audio";
import type { DemoSession } from "./types";

export async function publishDemoAiSyncToRoom(
  session: DemoSession,
  overrides?: {
    aiState?: DemoAiAudioStatus | string;
    selectedDemoPathId?: string | null;
    currentDemoAssetId?: string | null;
    leadScore?: number | null;
    leadCategory?: string | null;
    bookingRecommended?: boolean;
    handoffRequired?: boolean;
  }
): Promise<void> {
  if (!isLiveKitAiBridgeEnabled()) return;
  const payload = buildDemoAiRoomSyncPayload(session, {
    aiState: overrides?.aiState,
    selectedDemoPathId: overrides?.selectedDemoPathId ?? session.demo_path_id,
    currentDemoAssetId: overrides?.currentDemoAssetId ?? session.current_demo_asset_id,
    leadScore: overrides?.leadScore ?? session.lead_score,
    leadCategory: overrides?.leadCategory ?? session.lead_category,
    bookingRecommended: overrides?.bookingRecommended ?? session.booking_recommended,
    handoffRequired: overrides?.handoffRequired ?? session.handoff_required,
  });
  try {
    await bridgePublishDemoAiSync(session.id, payload as unknown as Record<string, unknown>);
  } catch (e) {
    console.warn("[publishDemoAiSyncToRoom]", e);
  }
}
