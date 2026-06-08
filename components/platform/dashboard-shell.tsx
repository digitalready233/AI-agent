"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PlatformSidebar } from "@/components/platform/sidebar";
import { PlatformHeader } from "@/components/platform/header";
import { useSessionInactivityLogout } from "@/hooks/use-session-inactivity-logout";
import { Toaster } from "sonner";
import type { UserRole } from "@/lib/platform/types";

export function DashboardShell({
  children,
  orgName,
  userName,
  userRole,
  liveAgentHref,
}: {
  children: React.ReactNode;
  orgName: string;
  userName: string;
  userRole: UserRole;
  liveAgentHref: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useSessionInactivityLogout(true);

  const router = useRouter();

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.refresh();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="platform-shell flex h-screen overflow-hidden">
      <div
        className={`fixed inset-y-0 left-0 z-40 h-full min-h-0 w-[280px] transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <PlatformSidebar
          orgName={orgName}
          userRole={userRole}
          liveAgentHref={liveAgentHref}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformHeader
          userName={userName}
          onMenuClick={() => setMobileOpen((o) => !o)}
        />
        <main className="platform-scrollbar flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            {children}
          </div>
        </main>
      </div>

      <Toaster theme="dark" position="top-right" richColors closeButton />
    </div>
  );
}
