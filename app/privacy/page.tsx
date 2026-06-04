import Link from "next/link";
import { createPageMetadata } from "@/lib/seo/site";
import { brand } from "@/lib/config";

export const metadata = createPageMetadata({
  title: "Privacy & cookies",
  description:
    "How DigiSales.ai uses cookies, stores session data, and handles personal information for AI sales conversations.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-12 sm:py-16">
      <article className="mx-auto max-w-2xl space-y-6">
        <p className="text-sm text-[var(--text-muted)] mb-2">
          <Link href="/" className="text-[var(--brand)] hover:underline">
            ← DigiSales.ai
          </Link>
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-[var(--text)] mb-2">
          Privacy & cookies
        </h1>
        <p className="text-[var(--text-secondary)] mb-10">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <section className="space-y-4 text-[var(--text-secondary)]">
          <h2 className="text-xl text-[var(--text)] font-semibold">Who we are</h2>
          <p>
            {siteOperator()} operates DigiSales.ai on behalf of {brand.name}. Contact:{" "}
            <a href={`mailto:${process.env.ESCALATION_EMAIL ?? "team@digitalreadyghana.com"}`}>
              {process.env.ESCALATION_EMAIL ?? "team@digitalreadyghana.com"}
            </a>
            .
          </p>
        </section>

        <section id="cookies" className="mt-10 space-y-4 text-[var(--text-secondary)] scroll-mt-8">
          <h2 className="text-xl text-[var(--text)] font-semibold">Cookies</h2>
          <p>
            <strong className="text-[var(--text)]">Essential cookies</strong> keep the
            platform secure and functional — for example sign-in state, demo session
            preferences, and your cookie consent choice. These cannot be disabled if you
            use the product.
          </p>
          <p>
            <strong className="text-[var(--text)]">Analytics cookies</strong> (optional)
            help us understand how visitors use the marketing site so we can improve
            content and performance. We only enable these when you choose &quot;Accept all
            cookies&quot; on the banner.
          </p>
          <p>
            You can change your mind by clearing site data in your browser or removing
            the <code className="text-[var(--text)]">digisales_cookie_consent_v1</code>{" "}
            entry from local storage, then reloading the page.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[var(--text-secondary)]">
          <h2 className="text-xl text-[var(--text)] font-semibold">Conversation data</h2>
          <p>
            Messages you send to our AI agents, demo rooms, and live chat may be stored
            in our workspace database for qualification, handoff to staff, and service
            improvement. Do not share passwords or payment card numbers in chat.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[var(--text-secondary)]">
          <h2 className="text-xl text-[var(--text)] font-semibold">Your rights</h2>
          <p>
            You may request access, correction, or deletion of personal data we hold
            about you by emailing the address above. We respond within a reasonable
            timeframe under applicable law.
          </p>
        </section>
      </article>
    </main>
  );
}

function siteOperator() {
  return brand.name;
}
