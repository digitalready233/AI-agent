"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/lib/platform/types";

export function LeadsTableFilter({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (l.full_name?.toLowerCase().includes(q) ?? false) ||
        (l.email?.toLowerCase().includes(q) ?? false) ||
        (l.service_interest?.toLowerCase().includes(q) ?? false);
      const matchesCategory =
        category === "all" || l.lead_category === category;
      const matchesStatus = status === "all" || l.lead_status === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [leads, search, category, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="support">Support</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="working">Working</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500 self-center">
          {filtered.length} of {leads.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-slate-400">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Interest</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No leads match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-slate-800/80 hover:bg-slate-900/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{l.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{l.email ?? l.phone ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {l.service_interest ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        l.lead_category === "hot"
                          ? "destructive"
                          : l.lead_category === "warm"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {l.lead_category ?? "warm"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{l.lead_status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{l.source ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(l.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
