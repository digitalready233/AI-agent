"use client";

import { useEffect, useState } from "react";

export function useDemoTimer(startedAt: string | null | undefined, active: boolean) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!active || !startedAt) {
      setElapsedSec(0);
      return;
    }
    const start = new Date(startedAt).getTime();
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, active]);

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  return { elapsedSec, label: `${mm}:${ss}` };
}
