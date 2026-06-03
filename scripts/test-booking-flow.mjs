/**
 * End-to-end booking flow test (HTTP + optional DB verify).
 * Run: node scripts/test-booking-flow.mjs
 * Requires: npm run dev, .env.local with Supabase + GROQ + SERVICE_ROLE
 */
import { readFileSync } from "fs";
import http from "node:http";
import https from "node:https";
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
const SESSION = `test-booking-${Date.now()}`;

const results = [];
function pass(step, detail) {
  results.push({ step, ok: true, detail });
  console.log(`✓ ${step}: ${detail}`);
}
function fail(step, detail) {
  results.push({ step, ok: false, detail });
  console.error(`✗ ${step}: ${detail}`);
}

function httpFetch(url, { method = "GET", headers = {}, body } = {}, ms = 600_000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers,
        timeout: ms,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => text,
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${ms}ms`));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function postChat(message, customerMetadata) {
  const body = JSON.stringify({
    sessionId: SESSION,
    agentId: AGENT_ID,
    message,
    channel: "website",
    customerMetadata,
  });
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await httpFetch(`${BASE}/api/platform/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      body,
    });
    const text = await res.text();
    if (res.status === 404 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 4000));
      continue;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      lastErr = new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      throw lastErr;
    }
    return { status: res.status, data };
  }
  throw lastErr ?? new Error("Chat request failed");
}

async function seedStaffAvailability(orgId, staffId) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const supabase = createClient(url, key);
  const { data: existing } = await supabase
    .from("staff_availability")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1);

  if (existing?.length) {
    pass("Seed availability", "Already has staff_availability rows");
    return true;
  }

  const rows = [1, 2, 3, 4, 5].map((day) => ({
    organization_id: orgId,
    staff_id: staffId,
    day_of_week: day,
    start_time: "09:00:00",
    end_time: "17:00:00",
    timezone: "Africa/Accra",
    is_available: true,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
  }));

  const { error } = await supabase.from("staff_availability").insert(rows);
  if (error) {
    fail("Seed availability", error.message);
    return false;
  }
  pass("Seed availability", `Inserted ${rows.length} weekday blocks`);
  return true;
}

async function verifyDb(conversationId, leadId, bookingId) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    fail("DB verify", "No Supabase credentials");
    return;
  }
  const supabase = createClient(url, key);

  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (lead) {
    pass("Lead updated", `status=${lead.lead_status}, category=${lead.lead_category ?? "—"}`);
  } else fail("Lead updated", "Lead not found");

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (conv) {
    pass("Conversation saved", `status=${conv.status}, stage=${conv.conversation_stage ?? "—"}`);
  } else fail("Conversation saved", "Conversation not found");

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (booking) {
    pass(
      "Booking in DB",
      `provider=${booking.provider}, status=${booking.status}, date=${booking.meeting_date}`
    );
  } else fail("Booking in DB", "Booking not found");

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  if (count && count >= 2) pass("Messages saved", `${count} messages on conversation`);
  else fail("Messages saved", `Expected ≥2 messages, got ${count ?? 0}`);
}

async function main() {
  console.log(`\nBooking E2E test → ${BASE} agent=${AGENT_ID} session=${SESSION}\n`);

  // Warm up server
  try {
    const ping = await httpFetch(BASE);
    if (!ping.ok) fail("Server", `HTTP ${ping.status}`);
    else pass("Server", `Up (${ping.status})`);
  } catch (e) {
    fail("Server", e.message);
    process.exit(1);
  }

  const meta = {
    name: "Test Customer",
    email: "booking-test@example.com",
    phone: "+233200000001",
    businessName: "Test Restaurant Accra",
  };

  let r1 = await postChat(
    "Hi, I run a restaurant in Accra and need website plus social media marketing. Budget is 15,000 GHS, I am the owner and decision maker, and I need to launch within 30 days.",
    meta
  );
  if (r1.status !== 200) {
    fail("Chat turn 1", `${r1.status} ${JSON.stringify(r1.data)}`);
    process.exit(1);
  }
  const category1 = r1.data.leadCategory;
  pass(
    "Chat turn 1",
    `intent=${r1.data.detectedIntent}, category=${category1}, score=${r1.data.leadScore}`
  );

  let r2 = await postChat(
    "Yes please — I would like to book a sales consultation. What times do you have this week?",
    meta
  );
  if (r2.status !== 200) {
    fail("Chat booking ask", `${r2.status} ${JSON.stringify(r2.data)}`);
    process.exit(1);
  }

  const category = r2.data.leadCategory;
  const score = r2.data.leadScore;
  if (category === "hot" || category === "warm") {
    pass("AI qualifies lead", `${category} (score ${score})`);
  } else {
    fail("AI qualifies lead", `Expected warm/hot, got ${category} score=${score}`);
  }

  const conversationId = r2.data.conversationId;
  const leadId = r2.data.leadId;
  const suggest =
    r2.data.suggestBooking || r2.data.bookingRecommended;

  if (suggest) {
    pass(
      "AI recommends booking",
      `suggestBooking=true, type=${r2.data.suggestedMeetingType ?? r2.data.meetingTypeKey}, provider=${r2.data.bookingProvider}`
    );
  } else {
    fail(
      "AI recommends booking",
      `suggestBooking=false category=${r2.data.leadCategory} stage=${r2.data.conversationStage} handoff=${r2.data.handoffRequired}`
    );
  }

  if (!conversationId || !leadId) {
    fail("IDs", "Missing conversationId or leadId");
    process.exit(1);
  }
  pass("Conversation + lead", `conv=${conversationId.slice(0, 8)}… lead=${leadId.slice(0, 8)}…`);

  // Meeting types (public)
  const mtRes = await httpFetch(
    `${BASE}/api/platform/calendar/meeting-types?agentId=${encodeURIComponent(AGENT_ID)}`
  );
  const mtData = JSON.parse(await mtRes.text());
  if (!mtRes.ok || !mtData.meetingTypes?.length) {
    fail("Meeting types", JSON.stringify(mtData));
    process.exit(1);
  }
  const meetingSlug = mtData.meetingTypes[0].key;
  pass("Meeting types", `${mtData.meetingTypes.length} types, using ${meetingSlug}`);

  // Seed availability if needed (lookup org from agent)
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", AGENT_ID).single();
  const orgId = agent?.organization_id;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1);
  if (orgId && profiles?.[0]) {
    await seedStaffAvailability(orgId, profiles[0].id);
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  const dateIso = tomorrow.toISOString().slice(0, 10);

  const availRes = await fetch(
    `${BASE}/api/bookings/availability?agentId=${encodeURIComponent(AGENT_ID)}&date=${dateIso}&meetingType=${encodeURIComponent(meetingSlug)}`
  );
  const availData = await availRes.json();
  if (!availRes.ok) {
    fail("Availability", `${availRes.status} ${JSON.stringify(availData)}`);
    process.exit(1);
  }
  if (!availData.slots?.length) {
    fail("Availability", `No slots on ${dateIso} — add staff_availability in Settings → Booking`);
    process.exit(1);
  }
  pass("Customer chooses slot", `${availData.slots.length} slots on ${dateIso}`);
  const slot = availData.slots[0];

  const bookBody = JSON.stringify({
    sessionId: SESSION,
    agentId: AGENT_ID,
    conversationId,
    meetingType: meetingSlug,
    startIso: slot.start,
    endIso: slot.end,
    customerEmail: meta.email,
    customerName: meta.name,
  });
  const bookRes = await httpFetch(`${BASE}/api/bookings/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bookBody) },
    body: bookBody,
  });
  const bookData = JSON.parse(await bookRes.text());
  if (!bookRes.ok || !bookData.booking?.id) {
    fail("Create booking", `${bookRes.status} ${JSON.stringify(bookData)}`);
    process.exit(1);
  }
  pass(
    "Booking created",
    `id=${bookData.booking.id.slice(0, 8)}… status=${bookData.booking.status} provider=${bookData.booking.provider}`
  );

  await verifyDb(conversationId, leadId, bookData.booking.id);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} steps passed ---\n`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
