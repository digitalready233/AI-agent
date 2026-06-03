"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";

interface Summary {
  conversations: number;
  leads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  bookings: number;
  escalations: number;
  followUps: number;
  intentClassifications: number;
  hotLeadAlerts: number;
  totalEvents: number;
  recentEvents: { type: string; createdAt: string; channel: string }[];
}

interface KnowledgeStatus {
  loaded: boolean;
  missing: boolean;
  charCount: number;
  sectionCount: number;
  lastModified?: string;
  sections: { title: string; charCount: number }[];
}

interface LeadRow {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  serviceNeeded?: string;
  status: string;
  budgetRange?: string;
  timeline?: string;
  updatedAt: string;
  channel: string;
}

export default function AdminDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [kb, setKb] = useState<KnowledgeStatus | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics").then((r) => {
        if (!r.ok) throw new Error("Failed to load analytics");
        return r.json();
      }),
      fetch("/api/knowledge").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/leads").then((r) => (r.ok ? r.json() : { leads: [] })),
    ])
      .then(([analytics, knowledge, leadsRes]) => {
        setData(analytics);
        if (knowledge) setKb(knowledge);
        setLeads(leadsRes.leads ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>Agent Dashboard</h1>
        <p>Knowledge base, leads, CRM sync, and conversation analytics</p>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {kb && (
        <section className={styles.section}>
          <h2>Knowledge base</h2>
          {kb.missing ? (
            <p className={styles.muted}>
              Missing file: knowledge/company-knowledge.md
            </p>
          ) : (
            <ul className={styles.kbMeta}>
              <li>
                <strong>{kb.sectionCount}</strong> sections ·{" "}
                <strong>{kb.charCount.toLocaleString()}</strong> characters
              </li>
              {kb.lastModified && (
                <li>Updated {new Date(kb.lastModified).toLocaleString()}</li>
              )}
            </ul>
          )}
          {kb.sections.length > 0 && (
            <ul className={styles.list}>
              {kb.sections.map((s) => (
                <li key={s.title}>
                  <span>{s.title}</span>
                  <span className={styles.muted}>{s.charCount} chars</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && (
        <>
          <div className={styles.grid}>
            <Stat label="Conversations" value={data.conversations} />
            <Stat label="Leads saved" value={data.leads} />
            <Stat label="Hot leads" value={data.hotLeads} highlight />
            <Stat label="Warm leads" value={data.warmLeads} />
            <Stat label="Cold leads" value={data.coldLeads} />
            <Stat label="Bookings" value={data.bookings} />
            <Stat label="Escalations" value={data.escalations} />
            <Stat label="Follow-ups" value={data.followUps} />
          </div>

          <section className={styles.section}>
            <h2>CRM leads ({leads.length})</h2>
            <p className={styles.muted}>
              Persisted in data/leads.json and data/crm-leads.json on the server.
            </p>
            {leads.length === 0 ? (
              <p className={styles.muted}>No leads captured yet.</p>
            ) : (
              <ul className={styles.leadList}>
                {leads.slice(0, 20).map((lead) => (
                  <li key={lead.id} className={styles.leadCard}>
                    <div className={styles.leadTop}>
                      <span className={styles.badge}>{lead.status}</span>
                      <span className={styles.muted}>{lead.channel}</span>
                      <time>{new Date(lead.updatedAt).toLocaleString()}</time>
                    </div>
                    <p className={styles.leadName}>
                      {lead.fullName ?? lead.businessName ?? "Unnamed lead"}
                    </p>
                    <p className={styles.leadDetail}>
                      {lead.serviceNeeded ?? "—"}
                      {lead.budgetRange ? ` · ${lead.budgetRange}` : ""}
                      {lead.timeline ? ` · ${lead.timeline}` : ""}
                    </p>
                    <p className={styles.leadContact}>
                      {[lead.email, lead.phone].filter(Boolean).join(" · ") ||
                        "No contact yet"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section}>
            <h2>Recent events</h2>
            <ul className={styles.list}>
              {data.recentEvents.map((e, i) => (
                <li key={i}>
                  <span className={styles.badge}>{e.type}</span>
                  <span>{e.channel}</span>
                  <time>{new Date(e.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? `${styles.stat} ${styles.hot}` : styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
