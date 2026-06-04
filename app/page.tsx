import { Landing } from "@/components/landing/Landing";
import { createPageMetadata } from "@/lib/seo/site";

export const metadata = createPageMetadata({
  title: "AI Sales Agents — Discovery, Demos & Qualification",
  description:
    "Deploy 24/7 AI sales agents with live qualification, demo rooms, NBAT scoring, Paystack billing, and human handoff. Built for growth teams in Ghana and worldwide.",
  path: "/",
});

export default function Home() {
  return <Landing />;
}
