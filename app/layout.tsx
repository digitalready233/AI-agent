import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
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
  title: "DigiSales.ai — Premium AI Sales & Qualification",
  description:
    "Always-on discovery, ReadyBot qualification, live staff handoff, and embeddable chat for growth brands in Ghana and beyond.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${syne.variable}`}>
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
