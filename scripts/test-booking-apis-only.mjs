/**
 * Fast booking path test (no LLM): availability + create + DB verify.
 * Run: node scripts/test-booking-apis-only.mjs
 */
import { readFileSync } from "fs";
import http from "node:http";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    console.warn("Could not load .env.local");
  }
}

loadEnv();

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const AGENT_ID =
  process.env.PLATFORM_AGENT_ID ||
  process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID ||
  "agent-sales-001";
const SESSION = `test-booking-apis-${Date.now()}`;

function httpFetch(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: `${u.pathname}${u.search}`,
        method,
        headers,
        timeout: 120_000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let { data: agent } = await supabase
    .from("agents")
    .select("id, organization_id")
    .eq("id", AGENT_ID)
    .maybeSingle();
  if (!agent) {
    const { data: fallback } = await supabase
      .from("agents")
      .select("id, organization_id")
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    agent = fallback;
  }
  if (!agent) throw new Error(`No enabled agent found (tried ${AGENT_ID})`);
  const agentId = agent.id;

  const convId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const now = new Date().toISOString();

  await supabase.from("leads").insert({
    id: leadId,
    organization_id: agent.organization_id,
    full_name: "API Test Customer",
    email: "api-booking-test@example.com",
    phone: "+233200000099",
    lead_status: "qualified",
    lead_category: "hot",
    lead_score: 90,
    source: "test",
    created_at: now,
    updated_at: now,
  });

  await supabase.from("conversations").insert({
    id: convId,
    organization_id: agent.organization_id,
    agent_id: agent.id,
    lead_id: leadId,
    session_id: SESSION,
    channel: "website",
    status: "ai_handling",
    conversation_stage: "booking",
    customer_name: "API Test Customer",
    customer_email: "api-booking-test@example.com",
    created_at: now,
    updated_at: now,
  });

  console.log("✓ Seeded lead + conversation");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", agent.organization_id)
    .limit(1);

  if (profiles?.[0]) {
    const { data: existing } = await supabase
      .from("staff_availability")
      .select("id")
      .eq("organization_id", agent.organization_id)
      .limit(1);
    if (!existing?.length) {
      const rows = [1, 2, 3, 4, 5].map((day) => ({
        organization_id: agent.organization_id,
        staff_id: profiles[0].id,
        day_of_week: day,
        start_time: "09:00:00",
        end_time: "17:00:00",
        timezone: "Africa/Accra",
        is_available: true,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
      }));
      await supabase.from("staff_availability").insert(rows);
      console.log("✓ Seeded staff_availability");
    }
  }

  const mtRes = await httpFetch(
    `${BASE}/api/platform/calendar/meeting-types?agentId=${encodeURIComponent(agentId)}`
  );
  let mtData;
  try {
    mtData = JSON.parse(mtRes.text);
  } catch {
    throw new Error(`Meeting types non-JSON (${mtRes.status}): ${mtRes.text.slice(0, 200)}`);
  }
  if (mtRes.status !== 200 || !mtData.meetingTypes?.length) {
    throw new Error(`Meeting types failed: ${mtRes.status} ${mtRes.text.slice(0, 200)}`);
  }
  const slug = mtData.meetingTypes[0].key;
  console.log(`✓ Meeting types (${slug})`);

  const date = new Date();
  date.setDate(date.getDate() + 2);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  const dateIso = date.toISOString().slice(0, 10);

  const availRes = await httpFetch(
    `${BASE}/api/bookings/availability?agentId=${encodeURIComponent(agentId)}&date=${dateIso}&meetingType=${encodeURIComponent(slug)}`
  );
  const avail = JSON.parse(availRes.text);
  if (!avail.slots?.length) {
    throw new Error(`No slots: ${availRes.text.slice(0, 300)}`);
  }
  console.log(`✓ Availability (${avail.slots.length} slots on ${dateIso})`);

  const slot = avail.slots[0];
  const bookBody = JSON.stringify({
    sessionId: SESSION,
    agentId,
    conversationId: convId,
    meetingType: slug,
    startIso: slot.start,
    endIso: slot.end,
    customerEmail: "api-booking-test@example.com",
    customerName: "API Test Customer",
  });
  const bookRes = await httpFetch(`${BASE}/api/bookings/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bookBody),
    },
    body: bookBody,
  });
  const bookData = JSON.parse(bookRes.text);
  if (bookRes.status !== 201 || !bookData.booking?.id) {
    throw new Error(`Create failed: ${bookRes.status} ${bookRes.text.slice(0, 400)}`);
  }
  console.log(`✓ Booking created (${bookData.booking.id.slice(0, 8)}…)`);

  const { data: lead } = await supabase.from("leads").select("lead_status").eq("id", leadId).single();
  const { data: conv } = await supabase
    .from("conversations")
    .select("status, conversation_stage")
    .eq("id", convId)
    .single();
  const { data: booking } = await supabase
    .from("bookings")
    .select("provider, status")
    .eq("id", bookData.booking.id)
    .single();

  console.log(`✓ Lead: status=${lead?.lead_status}`);
  console.log(`✓ Conversation: status=${conv?.status} stage=${conv?.conversation_stage}`);
  console.log(`✓ Booking: provider=${booking?.provider} status=${booking?.status}`);
  console.log("\nAll API booking steps passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
