"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Dev-only: one-time sync of live-chat agent id to .env.local (does not change on every page visit). */
export function SyncAgentEnv({
  agentId,
  primaryAgentName,
}: {
  agentId?: string;
  primaryAgentName?: string;
}) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem("platform_agent_env_synced") === "1") return;

    fetch("/api/dev/sync-agent-env", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Sync failed");
        localStorage.setItem("platform_agent_env_synced", "1");
        setDone(true);
        toast.success(`Live agent id saved to .env.local`, {
          description: data.agentId,
        });
      })
      .catch(() => {
        /* silent — user can set manually */
      });
  }, []);

  if (!agentId || done) return null;

  return (
    <p className="text-xs text-slate-500 mb-4">
      Public embed / live chat uses one agent id in{" "}
      <code className="text-cyan-400/90">NEXT_PUBLIC_PLATFORM_AGENT_ID</code>
      {primaryAgentName ? (
        <>
          {" "}
          (first active on this list: {primaryAgentName}). Other agents are not deleted — set
          the env var to the agent you want on the website.
        </>
      ) : null}
    </p>
  );
}
