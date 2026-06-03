"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/platform/types";

export type ReadybotPlaybookFormSlice = {
  name: string;
  nickname: string;
  company_product_name: string;
  welcome_message: string;
  system_prompt: string;
  qualification_prompt: string;
  objection_prompt: string;
  handoff_rules: string;
  booking_rules: string;
  crm_update_rules: string;
  lead_scoring_rules: string;
  fallback_response: string;
};

export function agentToReadybotFormSlice(a: Agent): ReadybotPlaybookFormSlice {
  return {
    name: a.name ?? "",
    nickname: a.nickname ?? "",
    company_product_name: a.company_product_name ?? "",
    welcome_message: a.welcome_message ?? "",
    system_prompt: a.system_prompt ?? "",
    qualification_prompt: a.qualification_prompt ?? "",
    objection_prompt: a.objection_prompt ?? "",
    handoff_rules: a.handoff_rules ?? "",
    booking_rules: a.booking_rules ?? "",
    crm_update_rules: a.crm_update_rules ?? "",
    lead_scoring_rules: a.lead_scoring_rules ?? "",
    fallback_response: a.fallback_response ?? "",
  };
}

type Props = {
  agentId: string;
  disabled?: boolean;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "secondary" | "outline";
  className?: string;
  onApplied: (slice: ReadybotPlaybookFormSlice) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export function ReadybotPlaybookButton({
  agentId,
  disabled,
  size = "sm",
  variant = "secondary",
  className,
  onApplied,
  onLoadingChange,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function apply() {
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const res = await fetch(`/api/platform/agents/${agentId}/apply-readybot`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; agent?: Agent };
      if (!res.ok || !data.agent) {
        throw new Error(data.error ?? "Apply failed");
      }
      onApplied(agentToReadybotFormSlice(data.agent));
      toast.success("ReadyBot playbook applied — review and save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply playbook");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      disabled={disabled || loading}
      onClick={() => void apply()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wand2 className="h-4 w-4" />
      )}
      Load ReadyBot playbook
    </Button>
  );
}

// useState import missing - fix