"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isSameOriginLink(anchor: HTMLAnchorElement): boolean {
  if (!anchor.href) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.download) return false;
  try {
    const url = new URL(anchor.href);
    return url.origin === window.location.origin && url.pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

/**
 * Top-of-page progress bar on route changes and internal link clicks.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setVisible(true);
    setWidth(12);
    timers.current.push(
      setTimeout(() => setWidth(45), 80),
      setTimeout(() => setWidth(72), 220),
      setTimeout(() => setWidth(88), 480)
    );
  }, [clearTimers]);

  const complete = useCallback(() => {
    clearTimers();
    setWidth(100);
    timers.current.push(
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 280)
    );
  }, [clearTimers]);

  useEffect(() => {
    start();
    complete();
    return clearTimers;
  }, [pathname, searchParams, start, complete, clearTimers]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (anchor instanceof HTMLAnchorElement && isSameOriginLink(anchor)) {
        start();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  if (!visible && width === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden bg-slate-950/20"
      role="progressbar"
      aria-hidden
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 shadow-[0_0_12px_rgba(34,211,238,0.55)] transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
