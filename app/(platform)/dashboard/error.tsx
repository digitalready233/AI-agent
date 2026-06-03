"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="platform-page flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-lg font-semibold text-white">Could not load dashboard</h2>
      <p className="max-w-md text-sm text-slate-400">
        {error.message || "Something went wrong while loading your metrics."}
      </p>
      <Button onClick={reset} className="rounded-xl">
        Try again
      </Button>
    </div>
  );
}
