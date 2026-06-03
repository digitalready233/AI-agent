"use client";

import dynamic from "next/dynamic";

const NotificationBell = dynamic(
  () =>
    import("@/components/platform/notification-bell").then((m) => m.NotificationBell),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-10 w-10 rounded-xl bg-slate-800/50 animate-pulse"
        aria-hidden
      />
    ),
  }
);

export function NotificationBellLazy() {
  return <NotificationBell />;
}
