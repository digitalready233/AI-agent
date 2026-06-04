"use client";

import { Suspense } from "react";
import { NavigationProgress } from "@/components/platform/navigation-progress";

export function NavigationProgressRoot() {
  return (
    <Suspense fallback={null}>
      <NavigationProgress />
    </Suspense>
  );
}
