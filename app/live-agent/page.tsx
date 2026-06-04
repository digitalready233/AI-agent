import { LiveAgentPage } from "@/components/live-chat/live-agent-page";
import { createPageMetadata } from "@/lib/seo/site";

export const metadata = createPageMetadata({
  title: "Live AI sales agent — try qualification now",
  description:
    "Chat with our AI sales agent for discovery, NBAT qualification, booking, and human handoff — no login required.",
  path: "/live-agent",
});

/** `/live-agent` — uses NEXT_PUBLIC_PLATFORM_AGENT_ID when set. */
export default function LiveAgentIndexPage() {
  return <LiveAgentPage />;
}
