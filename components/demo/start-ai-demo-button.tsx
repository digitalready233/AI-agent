"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MonitorPlay } from "lucide-react";
import { toast } from "sonner";

type Props = {
  agentId: string;
  className?: string;
  label?: string;
};

/** On-demand demo entry — creates a session and navigates to the presentation room. */
export function StartAiDemoButton({
  agentId,
  className,
  label = "Start AI Demo",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function startDemo() {
    if (!agentId) {
      toast.error("Demo agent is not configured.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/demo/on-demand/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not start demo"
        );
      }
      const url = data.share_url ?? data.room_url;
      if (typeof url === "string" && url.startsWith("http")) {
        window.location.href = url;
      } else {
        router.push(typeof url === "string" ? url : `/demo-room/${data.session?.id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start demo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void startDemo()}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
      ) : (
        <MonitorPlay className="h-4 w-4 inline mr-2" />
      )}
      {loading ? "Starting…" : label}
    </button>
  );
}
