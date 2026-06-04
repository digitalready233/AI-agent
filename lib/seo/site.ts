import type { Metadata } from "next";
import { brand } from "@/lib/config";

const DEFAULT_SITE_URL = "https://digitalreadyai.botchrealty.com";

function normalizeSiteUrl(raw: string): string {
  let value = raw.trim().replace(/\/+$/, "");
  if (!value) return DEFAULT_SITE_URL;

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_SITE_URL;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** Canonical public origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    DEFAULT_SITE_URL;
  return normalizeSiteUrl(raw);
}

/** Safe for Next.js metadataBase — never throws on bad env values. */
export function getMetadataBase(): URL {
  return new URL(getSiteUrl());
}

export const siteName = "DigiSales.ai";

export const defaultTitle =
  "DigiSales.ai — AI Sales Agents for Discovery, Demos & Qualification";

export const defaultDescription =
  `${brand.name} powers 24/7 AI sales agents: live qualification, demo rooms, NBAT lead scoring, human handoff, and embeddable chat for teams in Ghana and worldwide.`;

export const defaultKeywords = [
  "AI sales agent",
  "AI SDR",
  "sales automation",
  "lead qualification",
  "demo room",
  "live chat AI",
  "Ghana digital marketing",
  brand.name,
  "DigiSales",
  "conversational AI",
  "BANT qualification",
].join(", ");

export function createPageMetadata({
  title,
  description,
  path = "",
  noIndex = false,
}: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = path ? `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}` : getSiteUrl();

  return {
    title,
    description,
    keywords: defaultKeywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_GH",
      url,
      siteName,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  keywords: defaultKeywords,
  applicationName: siteName,
  authors: [{ name: brand.name, url: getSiteUrl() }],
  creator: brand.name,
  publisher: brand.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: getSiteUrl(),
    siteName,
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};
