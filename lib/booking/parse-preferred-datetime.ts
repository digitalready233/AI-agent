/** Best-effort extraction of date/time hints from customer text. */
export function parsePreferredDateTime(message: string): string | null {
  const text = message.trim();
  if (!text) return null;

  const isoMatch = text.match(
    /\b(20\d{2}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?\b/
  );
  if (isoMatch) {
    return isoMatch[2] ? `${isoMatch[1]}T${isoMatch[2]}` : isoMatch[1];
  }

  const usDate = text.match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i
  );
  if (usDate) {
    const year = usDate[3]
      ? usDate[3].length === 2
        ? `20${usDate[3]}`
        : usDate[3]
      : String(new Date().getFullYear());
    const month = usDate[1].padStart(2, "0");
    const day = usDate[2].padStart(2, "0");
    let hour = Number(usDate[4] ?? 9);
    const minute = usDate[5] ?? "00";
    const ampm = usDate[6]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${minute}`;
  }

  if (/\btomorrow\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const date = d.toISOString().slice(0, 10);
    const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const minute = timeMatch[2] ?? "00";
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      return `${date}T${String(hour).padStart(2, "0")}:${minute}`;
    }
    return date;
  }

  return null;
}
