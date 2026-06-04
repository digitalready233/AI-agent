"use client";

import Script from "next/script";

export function CalendlyInline({ url }: { url: string }) {
  return (
    <>
      <div
        className="calendly-inline-widget"
        data-url={url}
        style={{ minWidth: "280px", height: "700px", width: "100%" }}
      />
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />
    </>
  );
}
