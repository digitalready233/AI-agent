"use client";

import { Badge } from "@/components/ui/badge";
import { resolveSlideBranding } from "@/lib/demo/slide-branding";
import type { SlideBrandingMap } from "@/lib/demo/slide-branding";
import { cn } from "@/lib/utils";

type Props = {
  pathTitle?: string | null;
  slideBranding?: SlideBrandingMap;
  assetTitle: string;
  assetContent: string;
  assetType: string;
  companyName?: string | null;
  slideIndex: number;
  slideTotal: number;
};

export function DemoSlideHero({
  pathTitle,
  slideBranding,
  assetTitle,
  assetContent,
  assetType,
  companyName,
  slideIndex,
  slideTotal,
}: Props) {
  const brand = resolveSlideBranding({
    slideBranding,
    assetTitle,
    assetContent,
    companyName: companyName ?? undefined,
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-800/80 mb-4 shadow-xl",
        brand.styles.glow
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-90",
          brand.styles.gradient
        )}
      />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
      <div className="relative px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {brand.badge && (
            <Badge className={cn("text-xs", brand.styles.badge)}>{brand.badge}</Badge>
          )}
          {pathTitle && (
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
              {pathTitle}
            </Badge>
          )}
          <span className="text-xs text-slate-500 ml-auto">
            Slide {slideIndex + 1} of {slideTotal}
          </span>
        </div>
        {brand.eyebrow && (
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
            {brand.eyebrow}
          </p>
        )}
        <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          {brand.headline}
        </h2>
        {brand.subhead && (
          <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            {brand.subhead}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500 capitalize">
          {assetType.replace(/_/g, " ")} · {assetTitle}
        </p>
      </div>
    </div>
  );
}
