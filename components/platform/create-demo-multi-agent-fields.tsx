"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  DEMO_ROLE_LABELS,
  type DemoAgentRole,
} from "@/lib/demo/multi-agent/types";

type AgentOption = {
  id: string;
  name: string;
  operational_role?: string | null;
};

const ROLE_KEYS: DemoAgentRole[] = [
  "presenter_agent",
  "qualification_agent",
  "objection_agent",
  "booking_agent",
  "crm_summary_agent",
  "handoff_agent",
  "follow_up_agent",
];

export type CreateDemoMultiAgentState = {
  multi_agent_enabled: boolean;
  multi_agent_assignment_mode: string;
  primary_presenter_agent_id: string;
  qualification_agent_id: string;
  objection_agent_id: string;
  booking_agent_id: string;
  crm_summary_agent_id: string;
  handoff_agent_id: string;
  follow_up_agent_id: string;
};

export function emptyMultiAgentState(primaryAgentId: string): CreateDemoMultiAgentState {
  return {
    multi_agent_enabled: true,
    multi_agent_assignment_mode: "org_default_team",
    primary_presenter_agent_id: primaryAgentId,
    qualification_agent_id: "",
    objection_agent_id: "",
    booking_agent_id: "",
    crm_summary_agent_id: "",
    handoff_agent_id: "",
    follow_up_agent_id: "",
  };
}

const STATE_FIELD_BY_ROLE: Record<
  DemoAgentRole,
  keyof CreateDemoMultiAgentState
> = {
  presenter_agent: "primary_presenter_agent_id",
  qualification_agent: "qualification_agent_id",
  objection_agent: "objection_agent_id",
  booking_agent: "booking_agent_id",
  crm_summary_agent: "crm_summary_agent_id",
  handoff_agent: "handoff_agent_id",
  follow_up_agent: "follow_up_agent_id",
};

export function createDemoMultiAgentPayload(
  state: CreateDemoMultiAgentState
): Record<string, string | boolean> {
  if (!state.multi_agent_enabled) {
    return { multi_agent_enabled: false };
  }
  const payload: Record<string, string | boolean> = {
    multi_agent_enabled: true,
    multi_agent_assignment_mode: state.multi_agent_assignment_mode,
  };
  if (state.multi_agent_assignment_mode === "manual") {
    for (const role of ROLE_KEYS) {
      const field = STATE_FIELD_BY_ROLE[role];
      const v = state[field];
      if (v) payload[field] = v;
    }
  }
  return payload;
}

export function CreateDemoMultiAgentFields({
  agents,
  primaryAgentId,
  value,
  onChange,
  orgMultiAgentEnabled = null,
}: {
  agents: AgentOption[];
  primaryAgentId: string;
  value: CreateDemoMultiAgentState;
  onChange: (v: CreateDemoMultiAgentState) => void;
  /** null = loading (parent prefetches when modal opens) */
  orgMultiAgentEnabled?: boolean | null;
}) {
  useEffect(() => {
    if (primaryAgentId && value.primary_presenter_agent_id !== primaryAgentId) {
      onChange({
        ...value,
        primary_presenter_agent_id: primaryAgentId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync presenter when primary agent changes
  }, [primaryAgentId]);

  if (orgMultiAgentEnabled === null) {
    return (
      <div
        className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-3 min-h-[88px] animate-pulse"
        aria-hidden
      >
        <div className="h-3 w-2/3 rounded bg-slate-800 mb-3" />
        <div className="h-8 w-full rounded bg-slate-800" />
      </div>
    );
  }

  if (!orgMultiAgentEnabled) {
    return (
      <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-700 p-3">
        Multi-agent mode is off org-wide. Enable it under Demo room settings to assign
        specialist agents per demo.
      </p>
    );
  }

  const showManual = value.multi_agent_assignment_mode === "manual";

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
      <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-200">
        <input
          type="checkbox"
          checked={value.multi_agent_enabled}
          onChange={(e) =>
            onChange({ ...value, multi_agent_enabled: e.target.checked })
          }
        />
        Use multi-agent AI team for this demo
      </label>

      {value.multi_agent_enabled && (
        <>
          <div className="space-y-2">
            <Label className="text-slate-300">Team assignment</Label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={value.multi_agent_assignment_mode}
              onChange={(e) =>
                onChange({
                  ...value,
                  multi_agent_assignment_mode: e.target.value,
                })
              }
            >
              <option value="org_default_team">Organization default team</option>
              <option value="same_agent">Same agent for all roles</option>
              <option value="smart_assignment">Smart assignment by role</option>
              <option value="manual">Pick agents manually</option>
            </select>
          </div>

          {showManual && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <p className="text-xs text-slate-500">
                Leave blank to fall back to smart assign for that role.
              </p>
              {ROLE_KEYS.map((role) => {
                const fieldMap = {
                  presenter_agent: "primary_presenter_agent_id",
                  qualification_agent: "qualification_agent_id",
                  objection_agent: "objection_agent_id",
                  booking_agent: "booking_agent_id",
                  crm_summary_agent: "crm_summary_agent_id",
                  handoff_agent: "handoff_agent_id",
                  follow_up_agent: "follow_up_agent_id",
                } as const;
                const field = fieldMap[role];
                return (
                  <div key={role} className="space-y-1">
                    <Label className="text-xs text-slate-400">
                      {DEMO_ROLE_LABELS[role]}
                    </Label>
                    <select
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
                      value={value[field] || ""}
                      onChange={(e) =>
                        onChange({ ...value, [field]: e.target.value })
                      }
                    >
                      <option value="">Smart assign</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
