"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";

type LeadFields = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  industry?: string | null;
  service_interest?: string | null;
  budget?: string | null;
  timeline?: string | null;
  lead_category?: string | null;
  source?: string | null;
};

function FieldRow({
  label,
  value,
  empty = "Not captured yet",
}: {
  label: string;
  value?: string | null;
  empty?: string;
}) {
  const missing = !value?.trim();
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span
        className={
          missing ? "text-slate-600 italic text-right text-xs" : "text-slate-200 text-right"
        }
      >
        {missing ? empty : value}
      </span>
    </div>
  );
}

export function DemoLeadInfoPanel({
  lead,
  joined,
  hasLead,
  name,
  email,
  phone,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onSaveLead,
}: {
  lead: LeadFields | null;
  joined: boolean;
  hasLead: boolean;
  name: string;
  email: string;
  phone: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onSaveLead: () => void;
}) {
  if (!joined) {
    return (
      <p className="text-xs text-slate-500 py-2">Join the demo to share your details.</p>
    );
  }

  if (!hasLead || !lead) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Lead details not captured yet.</p>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Your name"
          className="bg-slate-950 border-slate-700 h-9"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="Email"
          className="bg-slate-950 border-slate-700 h-9"
        />
        <Input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="Phone"
          className="bg-slate-950 border-slate-700 h-9"
        />
        <Button size="sm" variant="outline" className="w-full" onClick={onSaveLead}>
          Save details
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/60">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/80">
          <User className="h-4 w-4 text-slate-400" />
        </div>
        <p className="font-medium text-white truncate">
          {lead.full_name ?? "Prospect"}
        </p>
      </div>
      <FieldRow label="Email" value={lead.email} />
      <FieldRow label="Phone" value={lead.phone} />
      <FieldRow label="Business" value={lead.business_name} />
      <FieldRow label="Industry" value={lead.industry} />
      <FieldRow label="Interest" value={lead.service_interest} />
      <FieldRow label="Budget" value={lead.budget} />
      <FieldRow label="Timeline" value={lead.timeline} />
      <FieldRow label="Lead source" value={lead.source} />
    </div>
  );
}
