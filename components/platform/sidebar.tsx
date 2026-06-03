"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  BookOpen,
  Calendar,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Settings,
  Users,
  Webhook,
  Wrench,
  Megaphone,
  UserCircle,
  Sparkles,
  ExternalLink,
  Phone,
  MonitorPlay,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessNav, ROLE_LABELS } from "@/lib/platform/rbac";
import type { UserRole } from "@/lib/platform/types";

const navGroups = [
  {
    label: "Sales operations",
    items: [
      { href: "/dashboard", label: "Operations dashboard", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/analytics", label: "Sales analytics", icon: BarChart3 },
    ],
  },
  {
    label: "AI sales agents",
    items: [
      { href: "/dashboard/agents", label: "Sales agents", icon: Bot, exact: true },
      { href: "/dashboard/agents/new", label: "Create agent", icon: Wrench },
      { href: "/dashboard/knowledge", label: "Sales knowledge", icon: BookOpen },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/dashboard/leads", label: "Leads & CRM", icon: Users },
      { href: "/dashboard/conversations", label: "Sales conversations", icon: MessageSquare },
      { href: "/dashboard/calls", label: "Voice calls", icon: Phone },
      { href: "/dashboard/demo-calls", label: "Demo calls", icon: MonitorPlay },
      { href: "/dashboard/demo-paths", label: "Demo paths", icon: Sparkles },
      { href: "/dashboard/bookings", label: "Meetings & bookings", icon: Calendar },
    ],
  },
  {
    label: "Outbound",
    items: [
      { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/dashboard/webhooks", label: "Webhooks & tasks", icon: Webhook },
      { href: "/dashboard/integrations", label: "CRM integrations", icon: Plug },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/dashboard/billing", label: "Billing & plans", icon: CreditCard },
      { href: "/dashboard/team", label: "Team", icon: UserCircle },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(
  pathname: string,
  href: string,
  exact?: boolean
): boolean {
  if (exact) return pathname === href;
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlatformSidebar({
  orgName,
  userRole,
  liveAgentHref,
  onNavigate,
}: {
  orgName: string;
  userRole: UserRole;
  liveAgentHref: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessNav(userRole, item.href)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="platform-sidebar flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r border-slate-800/50 bg-slate-950/90 backdrop-blur-xl">
      <div className="shrink-0 border-b border-slate-800/50 px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/20">
            <Sparkles className="h-5 w-5 text-slate-950" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-400/80">
              {ROLE_LABELS[userRole]}
            </p>
            <h2 className="truncate text-[15px] font-semibold leading-snug text-white">
              {orgName}
            </h2>
          </div>
        </div>
      </div>

      <nav className="platform-scrollbar platform-sidebar-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && "mt-2")}>
            <p className="platform-section-label">{group.label}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3.5 rounded-xl px-4 py-3 text-[13px] font-medium leading-snug transition-all duration-200",
                        active
                          ? "platform-nav-active"
                          : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-100"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          active ? "text-cyan-400" : "text-slate-500"
                        )}
                        strokeWidth={active ? 2.25 : 1.75}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-800/50 p-5">
        <Link
          href={liveAgentHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3.5 text-[13px] font-medium text-slate-300 transition-all hover:border-cyan-500/25 hover:bg-slate-800/50 hover:text-cyan-100 no-underline"
        >
          Preview sales agent
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Link>
      </div>
    </aside>
  );
}
