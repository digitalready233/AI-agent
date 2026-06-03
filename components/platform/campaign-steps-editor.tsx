"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEMPLATE_VARIABLES } from "@/lib/platform/campaign-types";
import type { MessageTemplate } from "@/lib/platform/campaign-types";

export type CampaignStepDraft = {
  step_order: number;
  delay_amount: number;
  delay_unit: "minutes" | "hours" | "days";
  message_template_id: string;
  message_body: string;
  stop_on_reply: boolean;
  mark_no_response: boolean;
};

export function defaultSteps(): CampaignStepDraft[] {
  return [
    {
      step_order: 0,
      delay_amount: 0,
      delay_unit: "hours",
      message_template_id: "",
      message_body:
        "Hi {{full_name}}, this is {{company_name}}. We wanted to follow up on {{service_interest}}.",
      stop_on_reply: true,
      mark_no_response: false,
    },
    {
      step_order: 1,
      delay_amount: 24,
      delay_unit: "hours",
      message_template_id: "",
      message_body:
        "Hi {{full_name}}, just checking in — still happy to help with {{service_interest}}.",
      stop_on_reply: true,
      mark_no_response: false,
    },
    {
      step_order: 2,
      delay_amount: 3,
      delay_unit: "days",
      message_template_id: "",
      message_body: "Last note from {{company_name}} — reply anytime if you'd like to connect.",
      stop_on_reply: true,
      mark_no_response: true,
    },
  ];
}

export function CampaignStepsEditor({
  steps,
  onChange,
  templates,
}: {
  steps: CampaignStepDraft[];
  onChange: (steps: CampaignStepDraft[]) => void;
  templates: MessageTemplate[];
}) {
  function update(index: number, patch: Partial<CampaignStepDraft>) {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next.map((s, i) => ({ ...s, step_order: i })));
  }

  function addStep() {
    onChange([
      ...steps,
      {
        step_order: steps.length,
        delay_amount: 48,
        delay_unit: "hours",
        message_template_id: "",
        message_body: "",
        stop_on_reply: true,
        mark_no_response: false,
      },
    ]);
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i })));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Variables: {TEMPLATE_VARIABLES.join(", ")}
      </p>
      {steps.map((step, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Step {index + 1}</p>
            {steps.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeStep(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Delay</Label>
              <Input
                type="number"
                min={0}
                value={step.delay_amount}
                onChange={(e) =>
                  update(index, { delay_amount: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Unit</Label>
              <Select
                value={step.delay_unit}
                onValueChange={(v) =>
                  update(index, {
                    delay_unit: v as CampaignStepDraft["delay_unit"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Saved template (optional)</Label>
            <Select
              value={step.message_template_id || "none"}
              onValueChange={(v) =>
                update(index, {
                  message_template_id: v === "none" ? "" : v,
                  message_body:
                    v === "none"
                      ? step.message_body
                      : templates.find((t) => t.id === v)?.body ?? step.message_body,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Custom body below" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Custom message</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={3}
              value={step.message_body}
              onChange={(e) => update(index, { message_body: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={step.stop_on_reply}
                onChange={(e) => update(index, { stop_on_reply: e.target.checked })}
              />
              Stop if customer replies
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={step.mark_no_response}
                onChange={(e) => update(index, { mark_no_response: e.target.checked })}
              />
              Mark no response after send
            </label>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addStep}>
        <Plus className="h-4 w-4 mr-1" />
        Add step
      </Button>
    </div>
  );
}
