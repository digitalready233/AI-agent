"use client";

import Link from "next/link";
import { loginUrl } from "@/lib/auth/login-url";
import { PAYSTACK_PLANS } from "@/lib/billing/paystack-plans";
import styles from "./landing.module.css";

export function LandingPricing() {
  const trialHref = loginUrl("/dashboard/billing");

  return (
    <section id="pricing" className={styles.sectionAlt}>
      <div className={styles.sectionAltInner}>
        <div className={styles.sectionHeaderCenter}>
          <p className={styles.eyebrow}>Pricing</p>
          <h2 className={`${styles.sectionTitle} font-display`}>
            Free trial, then pay before full access
          </h2>
          <p className={styles.sectionLeadCenter}>
            Start on a 14-day trial. Activate your workspace with Paystack — agent count and usage scale with plan.
          </p>
        </div>
        <div className={styles.pricingGrid}>
          {PAYSTACK_PLANS.map((plan) => (
            <article key={plan.id} className={styles.pricingCard}>
              <p className={styles.pricingName}>{plan.name}</p>
              <p className={styles.pricingPrice}>
                GHS {plan.amountGhs}
                <span>/mo</span>
              </p>
              <p className={styles.pricingDesc}>{plan.description}</p>
              <ul className={styles.pricingFeatures}>
                <li>Up to {plan.agentsAllowed} AI agents</li>
                <li>Knowledge base & embed</li>
                <li>{plan.id === "starter" ? "Chat qualification" : "Voice + demos"}</li>
                <li>{plan.id === "scale" ? "Priority integrations" : "CRM webhooks"}</li>
              </ul>
              <Link href={trialHref} className={styles.pricingCta}>
                Start trial → pay to unlock
              </Link>
            </article>
          ))}
        </div>
        <p className={styles.pricingFoot}>
          Exact cost depends on agent count and channels. Enterprise: book a live demo for custom pricing.
        </p>
      </div>
    </section>
  );
}
