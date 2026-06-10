"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AgentKnowledgeLinkPanel } from "@/components/platform/agent-knowledge-link-panel";
import { AgentTestChat } from "@/components/platform/agent-test-chat";
import { DemoSimulatePanel } from "@/components/platform/demo-simulate-panel";
import { AgentBuilderForm } from "@/components/platform/agent-builder-form";
import { EmbedCodePanel } from "@/components/platform/embed-code-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Agent,
  Conversation,
  KnowledgeBase,
  Lead,
} from "@/lib/platform/types";

import { agentTypeLabel } from "@/lib/platform/sales-ops";

export function AgentDetailTabs({
  agent,
  organizationName,
  knowledgeBases,
  linkedKnowledgeBaseIds,
  leads,
  conversations,
  siteOrigin,
}: {
  agent: Agent;
  organizationName: string;
  knowledgeBases: KnowledgeBase[];
  linkedKnowledgeBaseIds: string[];
  leads: Lead[];
  conversations: Conversation[];
  siteOrigin?: string;
}) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "overview";
  const agentLeads = leads.filter((l) => conversations.some((c) => c.lead_id === l.id && c.agent_id === agent.id));
  const agentConversations = conversations.filter((c) => c.agent_id === agent.id);

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="prompt">Prompt</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        <TabsTrigger value="conversations">Conversations</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="test">Test</TabsTrigger>
        <TabsTrigger value="demo">Simulate demo</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <EmbedCodePanel agentId={agent.id} siteOrigin={siteOrigin} />
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="text-slate-200">{agentTypeLabel(agent.agent_type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                  {agent.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Channels</span>
                <span className="text-slate-200">{(agent.channels ?? []).join(", ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Conversations</span>
                <span className="text-slate-200">{agentConversations.length}</span>
              </div>
              <div className="pt-2">
                <Link
                  href={`/live-agent/${agent.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cyan-400 hover:underline"
                >
                  Open live agent →
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Welcome message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {agent.welcome_message ?? "No welcome message configured."}
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="prompt">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 border border-slate-800 p-4 font-sans">
              {agent.system_prompt ?? "—"}
            </pre>
            {agent.qualification_prompt && (
              <>
                <p className="font-medium text-white">Qualification</p>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 border border-slate-800 p-4 font-sans">
                  {agent.qualification_prompt}
                </pre>
              </>
            )}
            {agent.handoff_rules && (
              <>
                <p className="font-medium text-white">Handoff rules</p>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 border border-slate-800 p-4 font-sans">
                  {agent.handoff_rules}
                </pre>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="knowledge">
        <AgentKnowledgeLinkPanel
          agentId={agent.id}
          agentName={agent.name}
          knowledgeBases={knowledgeBases}
          linkedKnowledgeBaseIds={linkedKnowledgeBaseIds}
        />
      </TabsContent>

      <TabsContent value="conversations">
        <Card>
          <CardContent className="pt-6 space-y-2">
            {agentConversations.length === 0 ? (
              <p className="text-sm text-slate-500">No conversations for this agent.</p>
            ) : (
              agentConversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/conversations/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 hover:border-cyan-500/30"
                >
                  <span className="text-sm text-white">{c.customer_name ?? "Visitor"}</span>
                  <Badge variant="outline">{c.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leads">
        <Card>
          <CardContent className="pt-6 space-y-2">
            {agentLeads.length === 0 ? (
              <p className="text-sm text-slate-500">No leads linked via conversations.</p>
            ) : (
              agentLeads.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2"
                >
                  <span className="text-sm text-white">{l.full_name ?? "—"}</span>
                  <Badge variant={l.lead_category === "hot" ? "destructive" : "secondary"}>
                    {l.lead_category ?? "warm"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="analytics">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-300">{agentConversations.length}</p>
              <p className="text-xs text-slate-500 mt-1">Total conversations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-300">
                {agentConversations.filter((c) => c.status === "resolved" || c.status === "closed").length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Resolved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-cyan-300">{agentLeads.length}</p>
              <p className="text-xs text-slate-500 mt-1">Related leads</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="demo">
        <Card className="border-violet-500/20 bg-gradient-to-b from-violet-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-base">Simulate demo</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Test demo-call workflow: greeting, discovery, objections, booking, handoff, and
              summary — uses demo assets and knowledge base.
            </p>
          </CardHeader>
          <CardContent>
            <DemoSimulatePanel agentId={agent.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="test">
        <Card className="border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-base">Test agent</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Messages use this agent&apos;s prompt, rules, and linked knowledge bases via OpenAI
              (server-side). Nothing is saved unless you enable &quot;Save test conversation.&quot;
            </p>
          </CardHeader>
          <CardContent>
            <AgentTestChat
              agentId={agent.id}
              agentName={agent.name}
              welcomeMessage={agent.welcome_message}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings">
        <AgentBuilderForm
          agent={agent}
          organizationName={organizationName}
          knowledgeBases={knowledgeBases}
          linkedKnowledgeBaseIds={linkedKnowledgeBaseIds}
        />
      </TabsContent>
    </Tabs>
  );
}
