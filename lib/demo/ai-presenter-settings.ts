import type { Agent } from "@/lib/platform/types";
import type { DemoProviderSettings } from "@/lib/platform/settings-types";
import {
  DEFAULT_AI_PRESENTER_ORG_SETTINGS,
  type AgentPresenterConfig,
  type AiPresenterOrgSettings,
  type AiPresenterUiMode,
  presenterInitials,
} from "./ai-presenter-types";

export function parseAiPresenterOrgSettings(
  settings: DemoProviderSettings
): AiPresenterOrgSettings {
  const raw = settings.ai_presenter;
  return {
    ...DEFAULT_AI_PRESENTER_ORG_SETTINGS,
    ...raw,
    presenter_ui_mode:
      raw?.presenter_ui_mode ?? DEFAULT_AI_PRESENTER_ORG_SETTINGS.presenter_ui_mode,
    brand_color: raw?.brand_color ?? DEFAULT_AI_PRESENTER_ORG_SETTINGS.brand_color,
  };
}

export function parseAgentPresenterConfig(agent: Agent | null): AgentPresenterConfig {
  const raw = agent?.presenter_config;
  if (!raw || typeof raw !== "object") return {};
  return raw as AgentPresenterConfig;
}

export function resolvePresenterDisplay(agent: Agent | null, org: AiPresenterOrgSettings) {
  const cfg = parseAgentPresenterConfig(agent);
  const displayName = cfg.display_name?.trim() || agent?.name || "AI Demo Agent";
  const roleTitle =
    cfg.role_title?.trim() || agent?.position?.trim() || "AI Sales Presenter";
  const avatarUrl =
    cfg.avatar_url?.trim() || agent?.avatar_url?.trim() || org.default_avatar_url?.trim() || null;
  const initials =
    cfg.fallback_initials?.trim() || presenterInitials(displayName);
  return {
    displayName,
    roleTitle,
    avatarUrl,
    initials,
    welcomePhrase: cfg.welcome_phrase?.trim() || agent?.welcome_message?.trim() || null,
    voiceSyncEnabled: cfg.voice_sync_enabled !== false,
    style: cfg.style ?? "professional",
  };
}

export function uiModeToDbMode(ui: AiPresenterUiMode): string {
  if (ui === "static_card") return "card";
  if (ui === "animated_card") return "animated_card";
  return "avatar_future";
}
