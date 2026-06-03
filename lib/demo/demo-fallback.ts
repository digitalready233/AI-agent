import type { DemoAsset } from "./types";

export function buildDemoSafeFallbackResponse(params: {
  reason?: "llm_error" | "analysis_failed" | "validation";
  nextAsset?: DemoAsset | null;
  handoffSuggested?: boolean;
}): string {
  const parts = [
    "Thanks for your message. I'm still here to help with your demo.",
    params.nextAsset
      ? `Let me walk you through "${params.nextAsset.title}" — ask me anything about what you see on screen.`
      : "Tell me what you're looking to achieve, and I'll guide you through the right options.",
    params.handoffSuggested
      ? "If you'd prefer to speak with a teammate now, use Request human takeover in this room."
      : "Our team can confirm any details that aren't shown in the demo materials.",
  ];
  return parts.join(" ");
}
