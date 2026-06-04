import { LiveAgentPage } from "@/components/live-chat/live-agent-page";

export const metadata = {
  title: "AI sales agent — live qualification",
  description: "Talk to our AI sales agent for discovery, qualification, booking, and handoff",
};

/** `/live-agent` — uses NEXT_PUBLIC_PLATFORM_AGENT_ID when set. */
export default function LiveAgentIndexPage() {
  return <LiveAgentPage />;
}
