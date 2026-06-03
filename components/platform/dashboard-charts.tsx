"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, AlertCircle } from "lucide-react";

const tooltipStyle = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(51, 65, 85, 0.8)",
  borderRadius: "12px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
  padding: "10px 14px",
};

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ChartError({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <AlertCircle className="h-8 w-8 text-rose-400/80" strokeWidth={1.5} />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function DashboardCharts({
  conversationByDay,
  leadSources,
  hasConversations = true,
  hasLeads = true,
  error,
}: {
  conversationByDay: { day: string; conversations: number }[];
  leadSources: { source: string; count: number }[];
  hasConversations?: boolean;
  hasLeads?: boolean;
  error?: string | null;
}) {
  const chartData = conversationByDay.map(({ day, conversations }) => ({
    day,
    conversations,
  }));

  const sourceData = leadSources.map(({ source, count }) => ({
    source: source.charAt(0).toUpperCase() + source.slice(1),
    count,
  }));

  const convHasPoints = chartData.some((d) => d.conversations > 0);
  const sourcesHasPoints = sourceData.some((d) => d.count > 0);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-800/50 bg-slate-900/30">
          <CardTitle className="text-base font-semibold">Conversations by day</CardTitle>
        </CardHeader>
        <CardContent className="h-72 p-4 pt-6">
          {error ? (
            <ChartError label={error} />
          ) : !hasConversations ? (
            <ChartEmpty label="No conversation data yet" />
          ) : !convHasPoints ? (
            <ChartEmpty label="No conversations in this period" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#94a3b8", fontSize: 12 }}
                  itemStyle={{ color: "#22d3ee", fontSize: 13 }}
                />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="url(#convGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-800/50 bg-slate-900/30">
          <CardTitle className="text-base font-semibold">Lead sources</CardTitle>
        </CardHeader>
        <CardContent className="h-72 p-4 pt-6">
          {error ? (
            <ChartError label={error} />
          ) : !hasLeads ? (
            <ChartEmpty label="No leads yet" />
          ) : !sourcesHasPoints ? (
            <ChartEmpty label="No lead sources in this period" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="source"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#94a3b8", fontSize: 12 }}
                  itemStyle={{ color: "#22d3ee", fontSize: 13 }}
                />
                <Bar dataKey="count" fill="#22d3ee" radius={[8, 8, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
