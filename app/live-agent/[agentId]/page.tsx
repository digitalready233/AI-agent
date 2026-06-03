import type { Metadata } from "next";
import { LiveAgentPage } from "@/components/live-chat/live-agent-page";

type PageProps = {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ embed?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { agentId } = await params;
  return {
    title: "Live chat",
    description: `Chat with agent ${agentId}`,
  };
}

export default async function LiveAgentRoutePage({
  params,
  searchParams,
}: PageProps) {
  const { agentId } = await params;
  const { embed } = await searchParams;
  const embedMode = embed === "1" || embed === "true";

  return <LiveAgentPage agentId={agentId} embed={embedMode} />;
}
