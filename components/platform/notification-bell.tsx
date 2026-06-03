"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/lib/platform/types";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/platform/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="relative h-10 w-10 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl shadow-black/40">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-semibold text-slate-100">Notifications</p>
            <p className="text-xs text-slate-500">Handoffs and alerts</p>
          </div>
          <div className="max-h-72 overflow-y-auto platform-scrollbar">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => {
                const convId =
                  typeof n.metadata?.conversation_id === "string"
                    ? n.metadata.conversation_id
                    : null;
                return (
                  <div
                    key={n.id}
                    className={`border-b border-slate-800/80 px-4 py-3 text-sm ${
                      n.status !== "read" ? "bg-cyan-500/5" : ""
                    }`}
                  >
                    <p className="font-medium text-slate-100">{n.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{n.message}</p>
                    <div className="mt-2 flex gap-2">
                      {convId && (
                        <Link
                          href={`/dashboard/conversations/${convId}`}
                          className="text-xs text-cyan-400 hover:underline"
                          onClick={() => {
                            if (n.status !== "read") markRead(n.id);
                            setOpen(false);
                          }}
                        >
                          View conversation
                        </Link>
                      )}
                      {n.status !== "read" && (
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-slate-300"
                          onClick={() => markRead(n.id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
