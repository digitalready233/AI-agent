/**
 * WhatsApp flow verification (workflow + webhook + DB).
 * Run: node scripts/test-whatsapp-flow.mjs
 * Requires: npm run dev, .env.local (Supabase service role, Groq/OpenAI, agent id)
 *
 * Optional for full Meta webhook POST: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN,
 * WHATSAPP_VERIFY_TOKEN, and matching row in whatsapp_settings (or env-only routing).
 */
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { dirname, resolve } from "node:path";
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
  "bdfddb48-d890-4193-8e01-0495f8e38c92";

const results = [];
function pass(step, detail) {
  results.push({ step, ok: true, detail });
  console.log(`✓ ${step}: ${detail}`);
}
function fail(step, detail) {
  results.push({ step, ok: false, detail });
  console.error(`✗ ${step}: ${detail}`);
}
function warn(step, detail) {
  console.warn(`⚠ ${step}: ${detail}`);
}

function httpFetch(url, { method = "GET", headers = {}, body } = {}, ms = 600_000) {
  return new Promise((resolvePromise, reject) => {
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
          resolvePromise({
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

async function postWhatsAppChat(sessionId, message, customerMetadata) {
  const body = JSON.stringify({
    sessionId,
    agentId: AGENT_ID,
    message,
    channel: "whatsapp",
    customerMetadata,
  });
  const res = await httpFetch(`${BASE}/api/platform/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Chat non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  return { status: res.status, data };
}

function buildWebhookPayload({ phoneNumberId, fromPhone, text, customerName, messageId }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "TEST_ENTRY",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: customerName }, wa_id: fromPhone }],
              messages: [
                {
                  id: messageId,
                  from: fromPhone,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signBody(rawBody, secret) {
  const sig = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${sig}`;
}

async function loadWhatsAppConfigFromDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);
  const { data: settings } = await supabase
    .from("whatsapp_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  return settings;
}

async function verifyConversationInDb(sessionId, checks) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    warn("DB verify", "No Supabase — skip");
    return;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!conv) {
    fail("Conversation in dashboard data", `No conversation for session ${sessionId}`);
    return;
  }

  if (conv.channel === "whatsapp") {
    pass("Conversation channel", "whatsapp");
  } else {
    fail("Conversation channel", `Expected whatsapp, got ${conv.channel}`);
  }

  if (checks.expectHandoff && conv.status === "human_needed") {
    pass("Human handoff status", "human_needed");
  } else if (checks.expectHandoff) {
    fail("Human handoff status", `Expected human_needed, got ${conv.status}`);
  }

  if (checks.expectBookingStatus && conv.status === "booked") {
    pass("Conversation booked status", "booked");
  }

  const { count: msgCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conv.id);
  if (msgCount >= 2) pass("Messages stored", `${msgCount} messages`);
  else fail("Messages stored", `Expected ≥2, got ${msgCount ?? 0}`);

  if (conv.lead_id) {
    const { data: lead } = await supabase.from("leads").select("*").eq("id", conv.lead_id).single();
    if (lead) {
      pass("Lead created/updated", `id=${lead.id.slice(0, 8)}… status=${lead.lead_status} source=${lead.source}`);
      if (checks.expectHot && lead.lead_category === "hot") {
        pass("Hot lead category", `score=${lead.lead_score}`);
      } else if (checks.expectHot) {
        fail("Hot lead category", `Expected hot, got ${lead.lead_category}`);
      }
    } else fail("Lead created/updated", "lead_id set but lead missing");
  } else {
    fail("Lead created/updated", "No lead_id on conversation");
  }

  if (checks.expectBooking) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("conversation_id", conv.id)
      .neq("status", "cancelled")
      .maybeSingle();
    if (booking) {
      pass("Booking recorded", `${booking.meeting_date} ${booking.meeting_time ?? ""}`);
    } else {
      fail("Booking recorded", "No booking on conversation");
    }
  }

  const orgId = conv.organization_id;
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId);
  const { data: leads } = await supabase.from("leads").select("id").eq("organization_id", orgId);
  pass(
    "Dashboard data source",
    `org has ${convs?.length ?? 0} conversations, ${leads?.length ?? 0} leads (metrics aggregate these)`
  );

  return conv;
}

async function main() {
  console.log(`\nWhatsApp flow test → ${BASE}\n`);

  // --- Server ---
  try {
    const ping = await httpFetch(BASE);
    if (!ping.ok) fail("Dev server", `HTTP ${ping.status}`);
    else pass("Dev server", `Up (${ping.status})`);
  } catch (e) {
    fail("Dev server", `${e.message} — run: npm run dev`);
    process.exit(1);
  }

  const dbSettings = await loadWhatsAppConfigFromDb();
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    dbSettings?.phone_number_id?.trim() ||
    "";
  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN?.trim() ||
    dbSettings?.webhook_verify_token?.trim() ||
    "";
  const hasAccessToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim());

  if (phoneNumberId) pass("WhatsApp phone_number_id", phoneNumberId);
  else warn("WhatsApp phone_number_id", "Not in env or whatsapp_settings — webhook POST skipped");

  if (hasAccessToken || dbSettings) pass("WhatsApp credentials", hasAccessToken ? "env token set" : "DB settings row");
  else warn("WhatsApp credentials", "No WHATSAPP_ACCESS_TOKEN — real WhatsApp send will fail on webhook path");

  // --- Webhook GET verify ---
  if (verifyToken) {
    const challenge = "test-challenge-12345";
    const verifyUrl = `${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`;
    const vRes = await httpFetch(verifyUrl);
    const body = await vRes.text();
    if (vRes.ok && body === challenge) {
      pass("Webhook GET verify", "Challenge echoed");
    } else {
      fail("Webhook GET verify", `status=${vRes.status} body=${body.slice(0, 80)}`);
    }

    const aliasUrl = `${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`;
    const aRes = await httpFetch(aliasUrl);
    const aBody = await aRes.text();
    if (aRes.ok && aBody === challenge) pass("Webhook alias GET", "/api/webhooks/whatsapp OK");
    else fail("Webhook alias GET", `status=${aRes.status}`);
  } else {
    warn("Webhook GET verify", "No WHATSAPP_VERIFY_TOKEN — skip");
  }

  // --- Workflow via channel=whatsapp (same engine as inbound) ---
  const sessionBooking = `wa_test_book_${Date.now()}`;
  const meta = {
    name: "WhatsApp Test User",
    phone: "+233201234567",
    businessName: "Test Biz Accra",
  };

  let r1 = await postWhatsAppChat(
    sessionBooking,
    "Hi, I run a restaurant in Accra. I need website and marketing. Budget 20,000 GHS, I am the owner, launch in 3 weeks.",
    meta
  );
  if (r1.status !== 200) {
    fail("AI reply (chat/whatsapp)", `${r1.status} ${JSON.stringify(r1.data)}`);
    process.exit(1);
  }
  pass(
    "AI reply (chat/whatsapp)",
    `intent=${r1.data.detectedIntent} category=${r1.data.leadCategory} score=${r1.data.leadScore}`
  );

  let r2 = await postWhatsAppChat(
    sessionBooking,
    "Yes, book a sales consultation for tomorrow at 2pm please.",
    meta
  );
  if (r2.status !== 200) {
    fail("Booking suggestion turn", `${r2.status} ${JSON.stringify(r2.data)}`);
  } else {
    const suggest = r2.data.suggestBooking || r2.data.bookingRecommended;
    const handoff = r2.data.handoffRequired;
    if (suggest && !handoff) {
      pass(
        "Booking suggested (warm/hot)",
        `type=${r2.data.suggestedMeetingType ?? "—"} preferred=${r2.data.preferredDateTime ?? "—"}`
      );
    } else if (suggest && handoff) {
      warn(
        "Booking suggested (warm/hot)",
        `suggest=true but handoff=true — visitor gets handoff message on WhatsApp`
      );
    } else {
      fail(
        "Booking suggested (warm/hot)",
        `suggest=${suggest} handoff=${handoff} category=${r2.data.leadCategory}`
      );
    }
  }

  await verifyConversationInDb(sessionBooking, {
    expectHot: r2.data?.leadCategory === "hot" || r1.data?.leadCategory === "hot",
    expectBooking: false,
  });

  // --- Hot lead → human handoff (separate session) ---
  const sessionHandoff = `wa_test_handoff_${Date.now()}`;
  const phoneHandoff = "+233209998877";
  const metaHandoff = { name: "Handoff Tester", phone: phoneHandoff };

  await postWhatsAppChat(
    sessionHandoff,
    "I run a chain of 5 hotels in Ghana. Budget 100,000 USD, CEO decision maker, need enterprise solution in 2 weeks.",
    metaHandoff
  );
  const rH = await postWhatsAppChat(
    sessionHandoff,
    "This is urgent — I need to speak with a human sales manager now about custom enterprise pricing.",
    metaHandoff
  );
  if (rH.status === 200) {
    if (rH.data.handoffRequired) {
      pass("Hot lead → handoff", `handoffRequired=true status message set`);
    } else {
      warn(
        "Hot lead → handoff",
        `handoffRequired=false (check Settings → Human handoff → hot lead trigger)`
      );
    }
    await verifyConversationInDb(sessionHandoff, {
      expectHandoff: rH.data.handoffRequired,
      expectHot: true,
    });
  }

  // --- Webhook POST (full inbound path) ---
  if (phoneNumberId && (hasAccessToken || dbSettings)) {
    const fromPhone = "233207776655";
    const wamid = `wamid.test.${randomUUID()}`;
    const payload = buildWebhookPayload({
      phoneNumberId,
      fromPhone,
      text: "Hello from webhook integration test",
      customerName: "Webhook Tester",
      messageId: wamid,
    });
    const raw = JSON.stringify(payload);
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) };
    const secret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (secret) headers["x-hub-signature-256"] = signBody(raw, secret);

    const wRes = await httpFetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers,
      body: raw,
    });
    const wText = await wRes.text();
    let wData;
    try {
      wData = JSON.parse(wText);
    } catch {
      wData = { raw: wText.slice(0, 200) };
    }

    if (wRes.ok && (wData.processed > 0 || wData.status === "ok")) {
      pass("Webhook POST inbound", JSON.stringify(wData));
    } else if (wData.errors > 0 && !hasAccessToken) {
      warn(
        "Webhook POST inbound",
        `${JSON.stringify(wData)} — set WHATSAPP_ACCESS_TOKEN for full send path`
      );
    } else {
      fail("Webhook POST inbound", `${wRes.status} ${wText.slice(0, 300)}`);
    }

    await verifyConversationInDb(`wa_${fromPhone}`, { expectHandoff: false });
  }

  // --- Integrations test API (auth required — skip or note) ---
  warn(
    "Manual check",
    "Dashboard → Integrations → WhatsApp → Test connection (requires logged-in session)"
  );
  warn(
    "Manual check",
    "Send a real WhatsApp to your business number and confirm reply in phone + Inbox filter WhatsApp"
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} automated checks passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.step}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAutomated WhatsApp workflow checks passed. Complete manual Meta + phone tests before production.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
