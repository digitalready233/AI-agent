"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ConversationStatus } from "@/lib/platform/types";

export function ConversationActions({
  conversationId,
  currentStatus,
}: {
  conversationId: string;
  currentStatus: ConversationStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function patchStatus(status: ConversationStatus) {
    setLoading(status);
    try {
      const res = await fetch(`/api/platform/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success(
        status === "assigned" ? "Conversation assigned to you" : "Marked as resolved"
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={loading !== null || currentStatus === "assigned"}
        onClick={() => patchStatus("assigned")}
      >
        {loading === "assigned" ? "Updating…" : "Take over"}
      </Button>
      <Button
        disabled={loading !== null || currentStatus === "resolved"}
        onClick={() => patchStatus("resolved")}
      >
        {loading === "resolved" ? "Updating…" : "Mark resolved"}
      </Button>
    </div>
  );
}
