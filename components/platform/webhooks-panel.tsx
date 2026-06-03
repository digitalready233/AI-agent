"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentTask } from "@/lib/platform/types";

export function WebhooksPanel({ tasks: initial }: { tasks: AgentTask[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    trigger_type: "lead_hot",
    action_type: "send_webhook",
    webhook_url: "",
    http_method: "POST",
  });

  async function createTask() {
    if (!form.name.trim()) {
      toast.error("Task name required");
      return;
    }
    const res = await fetch("/api/platform/agent-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      toast.error("Failed to create task");
      return;
    }
    toast.success("Task created");
    setShowForm(false);
    router.refresh();
  }

  async function testTask(taskId: string) {
    setTesting(taskId);
    try {
      const res = await fetch("/api/platform/agent-tasks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      toast.success(`Webhook responded: ${data.status} ${data.statusText}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(null);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/platform/agent-tasks?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Task deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm((s) => !s)}>
        <Plus className="h-4 w-4" />
        New task
      </Button>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create webhook task</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Task name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select
                value={form.trigger_type}
                onValueChange={(v) => setForm({ ...form, trigger_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_hot">Lead becomes hot</SelectItem>
                  <SelectItem value="lead_qualified">Lead qualified</SelectItem>
                  <SelectItem value="human_requested">Human requested</SelectItem>
                  <SelectItem value="meeting_booked">Meeting booked</SelectItem>
                  <SelectItem value="conversation_end">Conversation ends</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={form.action_type}
                onValueChange={(v) => setForm({ ...form, action_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_webhook">Send webhook</SelectItem>
                  <SelectItem value="notify_team">Notify team</SelectItem>
                  <SelectItem value="create_crm_record">Create CRM record</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Webhook URL</Label>
              <Input
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                placeholder="https://hooks.example.com/..."
              />
            </div>
            <Button className="sm:col-span-2" onClick={createTask}>
              Save task
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {initial.length === 0 && !showForm && (
          <p className="text-sm text-slate-500">No webhook tasks yet. Create one above.</p>
        )}
        {initial.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <Badge variant={t.status === "active" ? "success" : "secondary"}>
                  {t.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-400 space-y-2">
              <p>
                <span className="text-slate-500">Trigger:</span> {t.trigger_type}
              </p>
              <p>
                <span className="text-slate-500">Action:</span> {t.action_type}
              </p>
              {t.webhook_url && (
                <p className="font-mono text-xs text-cyan-400/80 truncate">
                  {t.http_method ?? "POST"} {t.webhook_url}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!t.webhook_url || testing === t.id}
                  onClick={() => testTask(t.id)}
                >
                  {testing === t.id ? "Testing…" : "Test webhook"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteTask(t.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
