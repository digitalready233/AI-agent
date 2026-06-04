import { brand } from "@/lib/config";
import { getSiteUrl, siteName } from "@/lib/seo/site";

export function OrganizationJsonLd() {
  const url = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: siteName,
        url,
        description:
          "AI sales agent platform for discovery, qualification, demo rooms, and human handoff.",
        areaServed: ["GH", "Worldwide"],
        parentOrganization: {
          "@type": "Organization",
          name: brand.name,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: siteName,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: "en",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${url}/live-agent?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: siteName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "GHS",
          description: "Free trial available",
        },
        description:
          "24/7 AI sales agents with qualification scoring, knowledge base, and staff handoff.",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
