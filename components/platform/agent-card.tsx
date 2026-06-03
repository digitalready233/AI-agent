import Link from "next/link";
import { Bot, MessageSquare, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Agent } from "@/lib/platform/types";
import { agentTypeLabel } from "@/lib/platform/sales-ops";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-all duration-200 hover:border-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-0.5">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/10 ring-1 ring-cyan-500/20">
            <Bot className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base truncate">{agent.name}</CardTitle>
              <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                {agent.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {agentTypeLabel(agent.agent_type)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed min-h-[2.5rem]">
          {agent.welcome_message ?? "No welcome message configured."}
        </p>
        <p className="text-xs text-slate-500">
          <span className="text-slate-600">Channels · </span>
          {(agent.channels ?? ["website"]).join(", ")}
        </p>
        <div className="flex gap-2 mt-auto pt-2">
          <Button variant="outline" size="sm" className="flex-1 rounded-xl" asChild>
            <Link href={`/dashboard/agents/${agent.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="secondary" size="sm" className="flex-1 rounded-xl" asChild>
            <Link href={`/dashboard/agents/${agent.id}?tab=test`}>
              <MessageSquare className="h-3.5 w-3.5" />
              Test
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
