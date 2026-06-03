import type { DemoAsset } from "./types";

export type PathSlideSpec = {
  title: string;
  content: string;
  asset_type: DemoAsset["asset_type"];
  sort_order: number;
};

/** Default slides per demo path (title = asset title in demo room). */
export const PATH_SLIDE_SPECS: Record<string, PathSlideSpec[]> = {
  social_media: [
    {
      title: "Overview",
      asset_type: "slide",
      sort_order: 1,
      content:
        "We manage your social presence end-to-end: strategy, content, publishing, and reporting so your brand stays visible and consistent.",
    },
    {
      title: "Content Strategy",
      asset_type: "service_card",
      sort_order: 2,
      content:
        "Editorial calendars, platform-specific formats, and messaging aligned to your audience and business goals.",
    },
    {
      title: "Creative Design",
      asset_type: "service_card",
      sort_order: 3,
      content:
        "On-brand graphics, carousels, and campaign creatives designed for engagement on Instagram, Facebook, TikTok, and more.",
    },
    {
      title: "Short Video Content",
      asset_type: "product_step",
      sort_order: 4,
      content:
        "Reels, short-form video, and motion content optimized for reach and saves on social platforms.",
    },
    {
      title: "Paid Ads & Lead Generation",
      asset_type: "product_step",
      sort_order: 5,
      content:
        "Boost high-performing posts and run lead campaigns that feed your sales pipeline from social traffic.",
    },
    {
      title: "Monthly Reporting",
      asset_type: "case_study",
      sort_order: 6,
      content:
        "Monthly performance dashboards: reach, engagement, leads, and recommendations for the next period.",
    },
    {
      title: "Recommended Next Step",
      asset_type: "faq",
      sort_order: 7,
      content:
        "Book a social media strategy call. We will review your channels, goals, and budget and propose a tailored plan.",
    },
  ],
  website: [
    {
      title: "Overview",
      asset_type: "slide",
      sort_order: 1,
      content:
        "Professional websites and online stores built for trust, speed, and conversion — mobile-first and easy for your team to update.",
    },
    {
      title: "Business Website",
      asset_type: "service_card",
      sort_order: 2,
      content:
        "Corporate and service sites with clear positioning, service pages, contact flows, and local SEO foundations.",
    },
    {
      title: "Ecommerce Website",
      asset_type: "product_step",
      sort_order: 3,
      content:
        "Online stores with product catalogs, secure checkout, and integrations for payments and inventory.",
    },
    {
      title: "Booking & Payment Integration",
      asset_type: "product_step",
      sort_order: 4,
      content:
        "Appointment booking, deposits, and payment gateways wired into your site so customers can act immediately.",
    },
    {
      title: "SEO & Speed",
      asset_type: "product_step",
      sort_order: 5,
      content:
        "Technical SEO, Core Web Vitals, and structured content so your site ranks and loads fast on mobile networks.",
    },
    {
      title: "Maintenance",
      asset_type: "case_study",
      sort_order: 6,
      content:
        "Ongoing updates, security patches, backups, and small content changes so your site stays reliable.",
    },
    {
      title: "Recommended Next Step",
      asset_type: "faq",
      sort_order: 7,
      content:
        "Book a website discovery call. Share your goals, pages needed, and timeline — we will scope the right build.",
    },
  ],
  digital_advertising: [
    {
      title: "Overview",
      asset_type: "slide",
      sort_order: 1,
      content:
        "Paid campaigns on Google, Meta, and other channels with clear targeting, tracking, and optimization for leads and sales.",
    },
    {
      title: "Campaign Strategy",
      asset_type: "service_card",
      sort_order: 2,
      content:
        "Funnel design, offer positioning, and channel mix based on your margin, market, and acquisition goals.",
    },
    {
      title: "Audience Targeting",
      asset_type: "product_step",
      sort_order: 3,
      content:
        "Lookalike, interest, retargeting, and custom audiences to reach buyers who are ready to act.",
    },
    {
      title: "Ad Creatives",
      asset_type: "product_step",
      sort_order: 4,
      content:
        "Static and video ads, copy variants, and landing-page alignment tested for click-through and conversion.",
    },
    {
      title: "Lead Generation",
      asset_type: "product_step",
      sort_order: 5,
      content:
        "Lead forms, CRM handoff, and qualification flows so your team receives sales-ready contacts.",
    },
    {
      title: "Reporting",
      asset_type: "case_study",
      sort_order: 6,
      content:
        "Spend, CPL, ROAS, and creative performance with actionable next steps each reporting cycle.",
    },
    {
      title: "Recommended Next Step",
      asset_type: "faq",
      sort_order: 7,
      content:
        "Book an ads strategy session. We will review your offer, budget, and past results and propose a campaign plan.",
    },
  ],
  branding: [
    {
      title: "Overview",
      asset_type: "slide",
      sort_order: 1,
      content:
        "Visual identity and creative systems that make your business recognizable and professional across every touchpoint.",
    },
    {
      title: "Brand Identity",
      asset_type: "service_card",
      sort_order: 2,
      content:
        "Core brand story, positioning, and visual direction before production — so every asset feels cohesive.",
    },
    {
      title: "Logo Design",
      asset_type: "product_step",
      sort_order: 3,
      content:
        "Primary and secondary marks, responsive lockups, and export files for print and digital use.",
    },
    {
      title: "Brand Guidelines",
      asset_type: "product_step",
      sort_order: 4,
      content:
        "A practical brand book your team and partners can follow for social, web, ads, and print.",
    },
    {
      title: "Social Media Visual System",
      asset_type: "product_step",
      sort_order: 5,
      content:
        "Templates, grids, and story formats that keep your social feeds on-brand at scale.",
    },
    {
      title: "Campaign Creatives",
      asset_type: "case_study",
      sort_order: 6,
      content:
        "Launch kits, flyers, and ad-ready visuals for promotions and seasonal campaigns.",
    },
    {
      title: "Recommended Next Step",
      asset_type: "faq",
      sort_order: 7,
      content:
        "Book a brand discovery call. Tell us whether you are launching or refreshing — we will outline deliverables and timeline.",
    },
  ],
  full_growth: [
    {
      title: "Overview",
      asset_type: "slide",
      sort_order: 1,
      content:
        "One partner for brand, web, social, and ads — integrated strategy and execution for businesses that want full digital growth.",
    },
    {
      title: "Brand Strategy",
      asset_type: "service_card",
      sort_order: 2,
      content:
        "Positioning and messaging that align your website, social, and paid campaigns to one growth story.",
    },
    {
      title: "Website Development",
      asset_type: "service_card",
      sort_order: 3,
      content:
        "Conversion-focused sites and stores connected to your campaigns and social proof.",
    },
    {
      title: "Social Media Management",
      asset_type: "service_card",
      sort_order: 4,
      content:
        "Content, community, and paid social working together with your website and ads.",
    },
    {
      title: "Digital Advertising",
      asset_type: "service_card",
      sort_order: 5,
      content:
        "Performance campaigns feeding qualified leads into your sales process.",
    },
    {
      title: "Monthly Reporting",
      asset_type: "case_study",
      sort_order: 6,
      content:
        "Unified monthly report across channels: what worked, what to scale, and next-month priorities.",
    },
    {
      title: "Recommended Next Step",
      asset_type: "faq",
      sort_order: 7,
      content:
        "Book a full growth consultation. We will prioritize services, budget, and timeline for your business.",
    },
  ],
};

export function sequenceTitlesForPathKey(pathKey: string): string[] {
  return (PATH_SLIDE_SPECS[pathKey] ?? []).map((s) => s.title);
}
