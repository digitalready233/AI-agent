import type { DemoPath } from "./types";

export const SLIDE_BRANDING_ACCENTS = [
  "cyan",
  "violet",
  "emerald",
  "amber",
  "rose",
  "orange",
] as const;

export type SlideBrandingAccent = (typeof SLIDE_BRANDING_ACCENTS)[number];

export interface SlideBranding {
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  accent?: SlideBrandingAccent;
  badge?: string;
}

export type SlideBrandingMap = Record<string, SlideBranding>;

const PATH_DEFAULT_ACCENT: Record<string, SlideBrandingAccent> = {
  social_media: "violet",
  website: "cyan",
  digital_advertising: "amber",
  branding: "rose",
  full_growth: "emerald",
};

const ACCENT_STYLES: Record<
  SlideBrandingAccent,
  { gradient: string; glow: string; badge: string }
> = {
  cyan: {
    gradient: "from-cyan-500/25 via-slate-900 to-violet-600/10",
    glow: "shadow-cyan-500/20",
    badge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  },
  violet: {
    gradient: "from-violet-500/25 via-slate-900 to-fuchsia-600/10",
    glow: "shadow-violet-500/20",
    badge: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  },
  emerald: {
    gradient: "from-emerald-500/20 via-slate-900 to-cyan-600/10",
    glow: "shadow-emerald-500/20",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  },
  amber: {
    gradient: "from-amber-500/20 via-slate-900 to-orange-600/10",
    glow: "shadow-amber-500/20",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  },
  rose: {
    gradient: "from-rose-500/20 via-slate-900 to-violet-600/10",
    glow: "shadow-rose-500/20",
    badge: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  },
  orange: {
    gradient: "from-orange-500/20 via-slate-900 to-amber-600/10",
    glow: "shadow-orange-500/20",
    badge: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  },
};

export function getPathSlideBrandingMap(path: DemoPath | null): SlideBrandingMap {
  if (!path?.metadata || typeof path.metadata !== "object") return {};
  const raw = (path.metadata as { slide_branding?: SlideBrandingMap }).slide_branding;
  return raw && typeof raw === "object" ? raw : {};
}

export function accentForPath(path: DemoPath | null): SlideBrandingAccent {
  const key = path?.path_key ?? path?.service_category ?? "";
  return PATH_DEFAULT_ACCENT[key] ?? "cyan";
}

function defaultBrandingForSlide(
  assetTitle: string,
  path: DemoPath | null
): SlideBranding {
  const accent = accentForPath(path);
  const pathTitle = path?.title?.replace(/ Demo$/, "") ?? "Our services";
  if (
    assetTitle.includes("Introduction") ||
    assetTitle === "Overview" ||
    assetTitle.toLowerCase().startsWith("overview")
  ) {
    return {
      eyebrow: path?.path_key ? pathTitle : "Welcome",
      headline: path?.title ?? "Your guided sales demo",
      subhead: path?.description?.slice(0, 140) ?? "Explore how we help businesses grow digitally.",
      accent,
      badge: "Live presentation",
    };
  }
  if (assetTitle.includes("Why Work")) {
    return {
      eyebrow: "Why partner with us",
      headline: "Built for measurable growth",
      subhead: "Strategy, execution, and reporting in one team.",
      accent,
      badge: "Proof & process",
    };
  }
  if (assetTitle.includes("Recommended") || assetTitle.includes("Next Step")) {
    return {
      eyebrow: "Next step",
      headline: path?.recommended_cta ?? "Book a consultation",
      subhead: "Move from demo to a tailored plan for your business.",
      accent,
      badge: "Call to action",
    };
  }
  return {
    eyebrow: pathTitle,
    headline: assetTitle,
    subhead: "Tailored to what you shared in discovery.",
    accent,
    badge: "Service spotlight",
  };
}

/** Resolve hero branding for a slide title within the active demo path. */
export function resolveSlideBranding(params: {
  path?: DemoPath | null;
  slideBranding?: SlideBrandingMap;
  assetTitle: string;
  assetContent?: string;
  companyName?: string;
}): SlideBranding & { styles: (typeof ACCENT_STYLES)[SlideBrandingAccent] } {
  const { path = null, slideBranding, assetTitle, assetContent, companyName } = params;
  const map =
    slideBranding && Object.keys(slideBranding).length > 0
      ? slideBranding
      : getPathSlideBrandingMap(path);
  const custom = map[assetTitle];
  const pathForDefaults =
    path ??
    (Object.keys(map).length > 0
      ? ({ metadata: { slide_branding: map } } as unknown as DemoPath)
      : null);
  const base = defaultBrandingForSlide(assetTitle, pathForDefaults);
  const merged: SlideBranding = {
    ...base,
    ...custom,
    headline: custom?.headline ?? base.headline ?? assetTitle,
    subhead:
      custom?.subhead ??
      base.subhead ??
      (assetContent ? assetContent.slice(0, 160) : undefined),
    eyebrow:
      custom?.eyebrow ??
      base.eyebrow ??
      (companyName ? companyName : undefined),
  };
  const accent = merged.accent ?? accentForPath(path);
  return { ...merged, accent, styles: ACCENT_STYLES[accent] };
}

/** Build default slide branding entries for every asset in a path sequence. */
export function buildDefaultSlideBrandingForSpec(spec: {
  path_key: string;
  title: string;
  description: string;
  recommended_cta: string;
  demo_asset_sequence: string[];
}): SlideBrandingMap {
  const pathLike = {
    path_key: spec.path_key,
    title: spec.title,
    description: spec.description,
    recommended_cta: spec.recommended_cta,
  } as DemoPath;
  const map: SlideBrandingMap = {};
  for (const slideTitle of spec.demo_asset_sequence) {
    map[slideTitle] = defaultBrandingForSlide(slideTitle, pathLike);
  }
  return map;
}
