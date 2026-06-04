"use client";

import { useState } from "react";
import { LogOut, Loader2, Menu } from "lucide-react";
import { NotificationBellLazy } from "@/components/platform/notification-bell-lazy";
import { Button } from "@/components/ui/button";
import { signOutClient } from "@/lib/auth/client-logout";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PlatformHeader({
  userName,
  onMenuClick,
}: {
  userName: string;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    toast.loading("Signing out…", { id: "sign-out" });
    try {
      await signOutClient(router);
    } catch {
      toast.error("Could not sign out. Try again.", { id: "sign-out" });
      setSigningOut(false);
    }
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
          onClick={() => void logout()}
          disabled={signingOut}
          className="h-10 rounded-xl px-4 gap-2 border-slate-700/60"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {signingOut ? "Signing out…" : "Sign out"}
          </span>
        </Button>
      </div>
    </header>
  );
}
