import { LiveAgentPage } from "@/components/live-chat/live-agent-page";

export const metadata = {
  title: "Live chat",
  description: "Talk to our AI sales assistant",
};

/** `/live-agent` — uses NEXT_PUBLIC_PLATFORM_AGENT_ID when set. */
export default function LiveAgentIndexPage() {
  return <LiveAgentPage />;
}
