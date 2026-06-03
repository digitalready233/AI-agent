"use client";

import { LogOut, Menu } from "lucide-react";
import { NotificationBellLazy } from "@/components/platform/notification-bell-lazy";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
export function PlatformHeader({
  userName,
  onMenuClick,
}: {
  userName: string;
  onMenuClick?: () => void;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/50 bg-slate-950/80 px-5 backdrop-blur-xl sm:px-8">
      <div className="flex items-center gap-4 min-w-0">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl lg:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">Signed in as</p>
          <p className="truncate text-sm font-semibold text-slate-100">{userName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBellLazy />
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="h-10 rounded-xl px-4 gap-2 border-slate-700/60"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
