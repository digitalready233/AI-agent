import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ agentId?: string }>;
};

/** Legacy iframe target — redirects to `/live-agent/[agentId]?embed=1`. */
export default async function EmbedPage({ searchParams }: PageProps) {
  const { agentId } = await searchParams;
  const id =
    agentId?.trim() || process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() || "";

  if (id) {
    redirect(`/live-agent/${encodeURIComponent(id)}?embed=1`);
  }

  const { LiveAgentPage } = await import("@/components/live-chat/live-agent-page");
  return <LiveAgentPage embed />;
}
