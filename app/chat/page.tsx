import { redirect } from "next/navigation";
import { LiveAgentPage } from "@/components/live-chat/live-agent-page";

export const metadata = {
  title: "Chat with us",
  description: "Talk to our AI sales assistant",
};

type PageProps = {
  searchParams: Promise<{ agentId?: string }>;
};

/** Legacy `/chat?agentId=` — redirects to `/live-agent/[agentId]` when possible. */
export default async function ChatPage({ searchParams }: PageProps) {
  const { agentId } = await searchParams;
  const id =
    agentId?.trim() || process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() || "";

  if (id) {
    redirect(`/live-agent/${encodeURIComponent(id)}`);
  }

  return <LiveAgentPage />;
}
