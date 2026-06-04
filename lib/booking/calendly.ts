/** Normalize a public Calendly link for inline embed widgets. */
export function calendlyEmbedUrl(bookingUrl: string): string | null {
  const raw = bookingUrl.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!u.hostname.replace(/^www\./, "").endsWith("calendly.com")) return null;
    return `${u.origin}${u.pathname.replace(/\/$/, "") || u.pathname}`;
  } catch {
    return null;
  }
}
