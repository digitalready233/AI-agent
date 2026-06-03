"use client";

import { useMemo, useState } from "react";
import styles from "./landing.module.css";

export function RoiCalculator() {
  const [reps, setReps] = useState(3);
  const [salary, setSalary] = useState(3500);
  const [leads, setLeads] = useState(400);
  const [conversion, setConversion] = useState(8);

  const result = useMemo(() => {
    const humanCost = reps * salary * 12;
    const qualified = Math.round(leads * 12 * (conversion / 100));
    const aiPlatformCost = 1499 * 12;
    const savings = Math.max(0, humanCost - aiPlatformCost);
    const hoursSaved = reps * 160 * 12 * 0.35;
    return { humanCost, qualified, savings, hoursSaved, aiPlatformCost };
  }, [reps, salary, leads, conversion]);

  return (
    <section id="roi" className={styles.section}>
      <div className={styles.sectionHeaderCenter}>
        <p className={styles.eyebrow}>ROI calculator</p>
        <h2 className={`${styles.sectionTitle} font-display`}>
          See what always-on AI SDRs save your team
        </h2>
        <p className={styles.sectionLeadCenter}>
          B2B teams scale pipeline without linear headcount. Adjust assumptions — estimates only, not a guarantee.
        </p>
      </div>
      <div className={styles.roiGrid}>
        <div className={styles.roiControls}>
          <label>
            <span>Sales reps covered</span>
            <input
              type="range"
              min={1}
              max={20}
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
            />
            <strong>{reps}</strong>
          </label>
          <label>
            <span>Avg monthly cost per rep (USD)</span>
            <input
              type="range"
              min={1500}
              max={12000}
              step={100}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
            />
            <strong>${salary.toLocaleString()}</strong>
          </label>
          <label>
            <span>Inbound leads / month</span>
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={leads}
              onChange={(e) => setLeads(Number(e.target.value))}
            />
            <strong>{leads}</strong>
          </label>
          <label>
            <span>Qualification rate (%)</span>
            <input
              type="range"
              min={2}
              max={25}
              value={conversion}
              onChange={(e) => setConversion(Number(e.target.value))}
            />
            <strong>{conversion}%</strong>
          </label>
        </div>
        <div className={styles.roiResults}>
          <div className={styles.roiStat}>
            <span>Est. qualified conversations / year</span>
            <strong>{result.qualified.toLocaleString()}</strong>
          </div>
          <div className={styles.roiStat}>
            <span>Human SDR cost / year</span>
            <strong>${result.humanCost.toLocaleString()}</strong>
          </div>
          <div className={styles.roiStat}>
            <span>Platform reference (Growth)</span>
            <strong>GHS {(1499 * 12).toLocaleString()} / yr</strong>
          </div>
          <div className={`${styles.roiStat} ${styles.roiHighlight}`}>
            <span>Potential annual savings vs. headcount</span>
            <strong>${result.savings.toLocaleString()}</strong>
          </div>
          <p className={styles.roiNote}>
            ~{Math.round(result.hoursSaved).toLocaleString()} rep-hours/year redirected to closing — 24/7 coverage, multilingual chat & voice.
          </p>
        </div>
      </div>
    </section>
  );
}
