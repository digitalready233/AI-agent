"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Globe,
  Menu,
  MessageSquare,
  Mic,
  MonitorPlay,
  Phone,
  Shield,
  Sparkles,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { StartAiDemoButton } from "@/components/demo/start-ai-demo-button";
import { loginUrl } from "@/lib/auth/login-url";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { RoiCalculator } from "@/components/landing/roi-calculator";
import { LandingPlatformProof } from "@/components/landing/landing-platform-proof";
import styles from "./landing.module.css";

const KEY_CAPABILITIES = [
  {
    icon: Phone,
    title: "Calls & scheduling",
    body: "Voice outbound and scheduling integrations (beta) — qualify leads, capture BANT, and book on your calendar.",
  },
  {
    icon: MonitorPlay,
    title: "Live screen-share demos",
    body: "Personalized product walkthroughs tailored to each prospect — plus optional video avatar demos.",
  },
  {
    icon: Globe,
    title: "Multilingual support",
    body: "Converse in 10+ languages with the same approved knowledge — no invented pricing or policy.",
  },
  {
    icon: Zap,
    title: "Continuous learning",
    body: "Transcripts, scores, and outcomes feed back into your workspace so pitches improve with real data.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    title: "Describe the agent role",
    body: "Short prompt: SDR, inbound qualifier, travel concierge, or pizza-shop order line — we draft tone and rules.",
  },
  {
    title: "Upload FAQs & collateral",
    body: "Product collateral, brand guidelines, and objection handling in your knowledge base — agents answer from source.",
  },
  {
    title: "Deploy & integrate",
    body: "Embed on your site, connect HubSpot, Slack, Gmail, Calendly, Salesforce webhooks, and go live in minutes.",
  },
] as const;

const AGENT_OPENS = [
  "Consultative discovery — one thoughtful question at a time, like a senior AE.",
  "Value-first demo invite — screen share when intent is high, never pushy.",
  "Direct qualify-and-book — for inbound leads ready to schedule now.",
] as const;

const CAPABILITIES = [
  {
    icon: MessageSquare,
    title: "Real-time conversation",
    body: "Fast, reliable chat and voice — no dead-end loops. Staff can join the same thread when humans take over.",
  },
  {
    icon: Users,
    title: "Lead qualification",
    body: "NBAT-style scoring, budget tiers from your KB, and meeting booking — honest handoffs, no misleads.",
  },
  {
    icon: BookOpen,
    title: "Knowledge-grounded",
    body: "Discovery calls, Q&A, and demos draw from uploaded FAQs — not hallucinated rates or promises.",
  },
  {
    icon: Video,
    title: "Demos that convert",
    body: "Live screen share and personalized video demos when your playbook calls for show-don't-tell.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Define your AI SDR",
    body: "Set role, tone, and opening style (2–3 consultative paths). Or describe your business in plain language — we draft the agent.",
  },
  {
    n: "02",
    title: "Load knowledge & deploy",
    body: "Add product collateral, FAQs, and brand guidelines. Paste the website embed, link CRM, and calendar.",
  },
  {
    n: "03",
    title: "Qualify around the clock",
    body: "Agents conduct discovery, deliver demos, answer questions, and book — in 10+ languages while you sleep.",
  },
] as const;

const FAQ = [
  {
    q: "Will the agent mislead prospects with fake pricing?",
    a: "No. Agents answer from your knowledge base and commercial policy. They qualify by tier and route to humans for binding quotes — never invented rate cards.",
  },
  {
    q: "Can it handle voice calls and screen-share demos?",
    a: "Yes. Connect Twilio for outbound/inbound voice and use demo-room flows for live screen share or video avatar presentations.",
  },
  {
    q: "How do I start — free trial or demo?",
    a: "Book a live AI agent demo when available, or sign in for a 14-day trial. Full access unlocks after Paystack payment on your chosen plan.",
  },
  {
    q: "Can I create an agent by describing my business?",
    a: "Yes — e.g. “incoming calls for a pizza shop” or “premium travel documentation concierge.” The builder drafts role, welcome, and qualification rules you can edit.",
  },
  {
    q: "What integrations are supported?",
    a: "HubSpot, Salesforce (webhook), Slack, Gmail/SMTP, Google Calendar, Calendly, Airtable, Google Sheets, WhatsApp, and website embed.",
  },
] as const;

const PIPELINE = [
  {
    stage: "Outreach",
    detail: "Campaigns, website chat, WhatsApp, and voice — one AI SDR motion across channels.",
  },
  {
    stage: "Discover",
    detail: "Discovery calls and chat in 10+ languages — intent, budget, and timeline without scripts that guess.",
  },
  {
    stage: "Demo",
    detail: "Screen-share and personalized video demos when the buyer is ready to see the product.",
  },
  {
    stage: "Close loop",
    detail: "Qualify, book meetings, CRM sync, and human handoff in the same conversation thread.",
  },
] as const;

const METRICS = [
  { value: "24/7", label: "Always-on SDR" },
  { value: "10+", label: "Languages" },
  { value: "<2s", label: "Typical chat response" },
  { value: "3", label: "Opening styles" },
] as const;

const MARQUEE = [
  "AI SDR",
  "Discovery calls",
  "Screen-share demos",
  "Lead qualification",
  "HubSpot",
  "Salesforce",
  "Calendly",
  "Slack",
  "Multilingual",
  "Paystack billing",
  "Website embed",
  "Voice + Zoom",
] as const;

const INTEGRATIONS = [
  "HubSpot",
  "Salesforce",
  "Slack",
  "Gmail",
  "Calendly",
  "Google Calendar",
  "Airtable",
  "WhatsApp",
  "TableSprint",
] as const;

const NAV_LINKS = [
  { href: "#workflow", label: "AI workflow" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#platform-proof", label: "Platform" },
  { href: "#roi", label: "ROI" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const company = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Digital Ready Ltd";
  const bookDemoHref = "/demo";
  const tagline =
    process.env.NEXT_PUBLIC_COMPANY_TAGLINE ??
    "Digital marketing, branding & business growth";
  const demoAgentId = process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ?? "";
  const liveAgentHref = demoAgentId
    ? `/live-agent/${encodeURIComponent(demoAgentId)}?new=1`
    : "/agent";
  const workspaceHref = loginUrl("/dashboard");
  const knowledgeHref = loginUrl("/dashboard/knowledge");
  const trialHref = loginUrl("/dashboard/billing");

  return (
    <div className={styles.page}>
      <div className={styles.gridOverlay} aria-hidden />
      <div className={styles.ambient} aria-hidden />
      <div className={styles.ambientSecondary} aria-hidden />

      <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <span>
            <span className={`${styles.brandWord} font-display`}>DigiSales.ai</span>
            <span className={styles.brandSub}>by {company}</span>
          </span>
        </Link>
        <nav className={styles.navLinks} aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          {/* <Link href="/voice">Voice</Link> */}
        </nav>
        <div className={styles.navCtas}>
          <Link href={loginUrl()} className={styles.linkMuted}>
            Sign in
          </Link>
          <Link href={bookDemoHref} className={styles.btnSecondary}>
            Book AI agent demo
          </Link>
          <Link href={liveAgentHref} className={styles.btnPrimary}>
            Talk to AI agent
          </Link>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <nav className={styles.mobileNav} aria-label="Mobile">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href={loginUrl()} onClick={() => setMenuOpen(false)}>
            Sign in
          </Link>
          <Link href={liveAgentHref} onClick={() => setMenuOpen(false)}>
            Talk to AI agent
          </Link>
        </nav>
      ) : null}

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.heroIntro}>
              <span className={styles.heroKicker}>
                <Sparkles size={14} aria-hidden />
                AI-driven sales development — outreach to close
              </span>
            </div>
            <h1 className={`${styles.headline} font-display`}>
              The AI closer
              <span className={styles.headlineLine}>your buyers</span>
              <span className={styles.headlineAccent}>actually respect</span>
            </h1>
            <p className={styles.lead}>
              DigiSales.ai helps B2B teams scale faster and cut costs — conversational AI
              that conducts discovery, delivers screen-share demos, answers from your FAQs,
              and chats in 10+ languages. Built for {company} with guardrails that prevent
              misleads.
            </p>
            <div className={styles.heroCtas}>
              <Link href={bookDemoHref} className={styles.btnPrimaryLg}>
                Book your AI agent demo
                <ArrowRight size={18} aria-hidden />
              </Link>
              {demoAgentId ? (
                <StartAiDemoButton
                  agentId={demoAgentId}
                  className={styles.btnGhostLg}
                  label="Talk to AI agent"
                />
              ) : (
                <Link href={liveAgentHref} className={styles.btnGhostLg}>
                  Talk to AI agent
                </Link>
              )}
            </div>
            <ul className={styles.heroStats} role="list">
              {METRICS.map((m) => (
                <li key={m.label}>
                  <strong>{m.value}</strong>
                  <span>{m.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.heroVisual} aria-hidden>
            <div className={styles.heroOrb} />
            <div className={styles.heroFloatChip} data-pos="score">
              <span className={styles.chipLabel}>Lead score</span>
              <strong>84</strong>
              <span className={styles.chipTag}>Warm</span>
            </div>
            <div className={styles.heroFloatChip} data-pos="stage">
              <span className={styles.chipLabel}>Stage</span>
              <strong>Qualify</strong>
            </div>
            <div className={styles.heroFrame}>
              <div className={styles.heroChrome}>
                <span />
                <span />
                <span />
                <p>app.digisales.ai · live session</p>
              </div>
              <div className={styles.heroCard}>
                <div className={styles.heroCardTop}>
                  <div className={styles.heroCardBrand}>
                    <div className={styles.heroCardAvatar} />
                    <div className={styles.heroCardMeta}>
                      <strong>ReadyBot</strong>
                      <span>Lead qualification · {company}</span>
                    </div>
                  </div>
                  <div className={styles.heroLive}>
                    <span className={styles.heroLiveDot} />
                    Live
                  </div>
                </div>
                <div className={styles.heroTranscript}>
                  <div
                    className={`${styles.heroBubble} ${styles.heroBubbleAgent}`}
                  >
                    <span className={styles.heroBubbleLabel}>Agent</span>
                    Are you focusing more on followers, engagement, or
                    conversions?
                  </div>
                  <div
                    className={`${styles.heroBubble} ${styles.heroBubbleUser}`}
                  >
                    <span className={styles.heroBubbleLabel}>Visitor</span>
                    Conversions—we need better Meta ad performance.
                  </div>
                  <div
                    className={`${styles.heroBubble} ${styles.heroBubbleAgent}`}
                  >
                    <span className={styles.heroBubbleLabel}>Agent</span>
                    What's your biggest milestone for growth in the next 6
                    months?
                  </div>
                  <div className={styles.heroTyping}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className={styles.heroCardFooter}>
                  <Shield size={14} aria-hidden />
                  <span>Policy-safe · no public pricing in chat</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <a href="#how-it-works" className={styles.heroScroll}>
          <span>See how it works</span>
          <span className={styles.heroScrollLine} />
        </a>
      </section>

      <div className={styles.marqueeWrap} aria-hidden>
        <div className={styles.marqueeTrack}>
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={`${item}-${i}`} className={styles.marqueeItem}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className={styles.statement}>
        <div className={styles.statementInner}>
          <p className={`${styles.statementQuote} font-display`}>
            “Enterprise-grade AI sales automation — discovery, demos, qualification,
            and human handoff in one workflow. Describe your agent, upload FAQs,
            deploy on your site, and let AI qualify buyers globally in real time.”
          </p>
          <p className={styles.statementMeta}>
            Built for {company} · Adenta, Accra · {tagline}
          </p>
        </div>
      </section>

      <section id="pipeline" className={styles.sectionAlt}>
        <div className={styles.sectionAltInner}>
          <div className={styles.sectionHeaderCenter}>
            <p className={styles.eyebrow}>Automated sales motion</p>
            <h2 className={`${styles.sectionTitle} font-display`}>
              From outreach to closing — with guardrails
            </h2>
            <p className={styles.sectionLeadCenter}>
              An AI SDR platform that conducts discovery calls, delivers demos,
              answers questions, and books meetings — the same pipeline your best rep
              runs, encoded in workflow and knowledge.
            </p>
          </div>
          <div className={styles.pipelineGrid}>
            {PIPELINE.map((step, i) => (
              <article key={step.stage} className={styles.pipelineCard}>
                <div className={styles.pipelineMeta}>
                  <span className={styles.pipelineIndex}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className={`${styles.pipelineTitle} font-display`}>
                  {step.stage}
                </h3>
                <p className={styles.pipelineBody}>{step.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.sectionAlt}>
        <div className={styles.sectionAltInner}>
          <div className={styles.sectionHeaderCenter}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 className={`${styles.sectionTitle} font-display`}>
              Describe · Upload · Deploy
            </h2>
          </div>
          <div className={styles.howGrid}>
            {HOW_IT_WORKS.map((step) => (
              <article key={step.title} className={styles.howStep}>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <div className={styles.stackRow} style={{ marginTop: "2rem", justifyContent: "center" }}>
            {AGENT_OPENS.map((line) => (
              <span key={line} className={styles.stackPill}>
                {line}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" className={styles.section}>
        <div className={styles.sectionHeaderCenter}>
          <p className={styles.eyebrow}>Key capabilities</p>
          <h2 className={`${styles.sectionTitle} font-display`}>
            Calls, demos, languages — one platform
          </h2>
        </div>
        <div className={styles.capGrid} style={{ maxWidth: 960, margin: "0 auto" }}>
          {KEY_CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <article key={c.title} className={styles.capCard}>
                <div className={styles.capIcon} aria-hidden>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className={`${styles.capTitle} font-display`}>{c.title}</h3>
                <p className={styles.capBody}>{c.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="platform" className={styles.sectionAlt}>
        <div className={styles.compareGrid}>
          <article className={styles.compareCard}>
            <p className={styles.compareEyebrow}>The old way</p>
            <h3 className={`${styles.compareTitle} font-display`}>
              Generic support chat
            </h3>
            <ul className={styles.compareList}>
              {[
                "Hallucinated pricing and vague promises",
                "No lead scoring or CRM sync",
                "Dead-end when the buyer pushes back",
              ].map((p) => (
                <li key={p}>
                  <X size={16} aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </article>
          <article className={styles.compareCardHighlight}>
            <p className={styles.compareEyebrowGold}>DigiSales.ai</p>
            <h3 className={`${styles.compareTitle} font-display`}>
              AI sales agent platform
            </h3>
            <ul className={styles.compareList}>
              {[
                "Answers only from approved knowledge articles",
                "Workflow engine: stage, score, lead draft",
                "In-thread human takeover + HubSpot webhook",
              ].map((p) => (
                <li key={p}>
                  <Check size={16} aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <Link href={liveAgentHref} className={styles.compareCta}>
              Start AI qualification
              <ArrowRight size={16} aria-hidden />
            </Link>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.demoCtaBand}>
          <p className={styles.eyebrow}>Onboarding</p>
          <h2 className={`${styles.sectionTitle} font-display`}>
            Book your AI agent demo — or start a free trial
          </h2>
          <p className={styles.sectionLeadCenter}>
            24/7 live chat support during onboarding for early beta teams. Full workspace
            access unlocks after trial via secure Paystack checkout.
          </p>
          <div className={styles.heroCtas} style={{ justifyContent: "center", marginTop: "1.5rem" }}>
            <Link href={bookDemoHref} className={styles.btnPrimaryLg}>
              Book your AI agent demo
            </Link>
            <Link href={trialHref} className={styles.btnGhostLg}>
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      <LandingPlatformProof />
      <RoiCalculator />
      <LandingTestimonials />
      <LandingPricing />

      <section className={styles.sectionAlt}>
        <div className={styles.capShowcase}>
          <div className={styles.capShowcaseCopy}>
            <p className={styles.eyebrow}>Platform</p>
            <h2 className={`${styles.sectionTitle} font-display`}>
              Fast, reliable, real-time conversation
            </h2>
            <p className={styles.sectionLead}>
              Enterprise auth, encrypted sessions, and workflow guardrails — built to
              run continuously without feeling like a scam widget or unresponsive bot.
            </p>
            <div className={styles.stackRow}>
              {INTEGRATIONS.map((item) => (
                <span key={item} className={styles.stackPill}>
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.capGrid}>
            {CAPABILITIES.map((c) => {
              const Icon = c.icon;
              return (
                <article key={c.title} className={styles.capCard}>
                  <div className={styles.capIcon} aria-hidden>
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <h3 className={`${styles.capTitle} font-display`}>{c.title}</h3>
                  <p className={styles.capBody}>{c.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="knowledge" className={styles.section}>
        <div className={styles.sectionAltInner}>
          <div className={styles.sectionHeaderCenter}>
            <p className={styles.eyebrow}>Knowledge base</p>
            <h2 className={`${styles.sectionTitle} font-display`}>
              Product collateral, FAQs & brand guidelines
            </h2>
            <p className={styles.sectionLeadCenter}>
              Premium travel? Agents track documentation for exclusive destinations,
              changing regulations, insurance recommendations, and global concierge
              coordination — all from articles you approve.
            </p>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.n} className={styles.step}>
                <span className={styles.stepNum}>{s.n}</span>
                <h3 className={`${styles.stepTitle} font-display`}>{s.title}</h3>
                <p className={styles.stepBody}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <div className={styles.finalCtaGlow} aria-hidden />
          <p className={styles.eyebrow}>Get started</p>
          <h2 className={`${styles.finalCtaTitle} font-display`}>
            Deploy your AI sales agent tonight
          </h2>
          <p className={styles.finalCtaLead}>
            <strong>{company}</strong> — describe your agent, seed FAQs, connect CRM
            and calendar, paste one embed script. Pay via Paystack when you are ready
            for full access.
          </p>
          <div className={styles.finalCtaActions}>
            <Link href={bookDemoHref} className={styles.btnPrimaryLg}>
              Book your AI agent demo
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href={trialHref} className={styles.btnGhostLg}>
              Start free trial
            </Link>
            <Link href={knowledgeHref} className={styles.btnGhostLg}>
              Add knowledge base
            </Link>
          </div>
        </div>
      </section>

      <section id="faq" className={styles.section}>
        <div className={styles.faqLayout}>
          <div className={styles.faqIntro}>
            <p className={styles.eyebrow}>FAQ</p>
            <h2 className={`${styles.sectionTitle} font-display`}>
              Straight answers
            </h2>
            <p className={styles.sectionLead}>
              No fluff. What buyers, legal, and ops teams ask before go-live.
            </p>
          </div>
          <div className={styles.faq}>
            {FAQ.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <span className={`${styles.brandWord} font-display`}>DigiSales.ai</span>
            <p>
              AI SDR platform for {company} — discovery, demos, qualification, and
              multilingual chat with enterprise security and Paystack billing.
            </p>
            <p className={styles.footerLocale}>Adenta · Accra · Ghana</p>
          </div>
          <div className={styles.footerCol}>
            <h4>Product</h4>
            <Link href={liveAgentHref}>AI qualification</Link>
            <a href="/embed" target="_blank" rel="noreferrer">
              Embed
            </a>
            <Link href={workspaceHref}>Workspace</Link>
            <Link href={knowledgeHref}>Knowledge</Link>
            <Link href={trialHref}>Pricing & billing</Link>
          </div>
          <div className={styles.footerCol}>
            <h4>Company</h4>
            <Link href={bookDemoHref}>Book AI agent demo</Link>
            {/* <Link href="/voice">Voice</Link> */}
            <Link href="/meet">Meet</Link>
            <Link href="/privacy">Privacy & cookies</Link>
            <Link href={loginUrl()}>Sign in</Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} DigiSales.ai</span>
          <span>Crafted for premium buyer experiences</span>
        </div>
      </footer>
    </div>
  );
}
