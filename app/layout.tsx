import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { Toaster } from "sonner";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { NavigationProgressRoot } from "@/components/platform/navigation-progress-root";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import { rootMetadata } from "@/lib/seo/site";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  preload: true,
  weight: ["400", "500", "600", "700"],
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  preload: true,
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  ...rootMetadata,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${syne.variable}`}>
      <body className={outfit.className}>
        <NavigationProgressRoot />
        <OrganizationJsonLd />
        {children}
        <CookieConsentBanner />
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
