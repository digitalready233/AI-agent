"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login.module.css";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const next = nextPath;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.mobileBrand}>
        <div className={styles.brandRow}>
          <span className={styles.brandMark} />
          <span className={styles.brandName}>DigiSales.ai</span>
        </div>
      </div>
      <p className={styles.formEyebrow}>Secure access</p>
      <h1 className={styles.formTitle}>Sign in to your agent</h1>
      <p className={styles.formLead}>
        Use your work email and the workspace access code your team shared.
      </p>
      <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
        {error ? <p className={styles.error}>{error}</p> : null}
        <label className={styles.label}>
          Work email
          <input
            className={styles.input}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
        <label className={styles.label}>
          Access code
          <input
            className={styles.input}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Workspace password"
          />
        </label>
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Continue to agent"}
        </button>
      </form>
      <Link href="/" className={styles.back}>
        ← Back to DigiSales.ai
      </Link>
    </div>
  );
}
