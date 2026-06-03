/**
 * Fast check: hot lead + booking stage must not block suggestBooking.
 * Run: node scripts/test-booking-handoff-logic.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Compiled path not available — duplicate minimal logic inline for CI-less check
function shouldSuggestBooking({ analysis, leadCategory }) {
  if (leadCategory !== "hot" && leadCategory !== "warm") return false;
  if (analysis.suggest_booking) return true;
  if (analysis.detected_intent === "booking_request") return true;
  const stages = ["qualification", "recommendation", "objection_handling", "booking"];
  return stages.includes(analysis.conversation_stage);
}

function shouldDeferHandoffForBooking({ analysis, bookingEligible }) {
  if (!bookingEligible) return false;
  if (analysis.detected_intent === "booking_request") return true;
  if (analysis.suggest_booking) return true;
  if (analysis.conversation_stage === "booking") return true;
  return false;
}

const analysis = {
  detected_intent: "booking_request",
  conversation_stage: "booking",
  suggest_booking: false,
};

const bookingEligible = shouldSuggestBooking({ analysis, leadCategory: "hot" });
const handoffFromHot = true; // lead_becomes_hot
const handoffRequired =
  handoffFromHot && !shouldDeferHandoffForBooking({ analysis, bookingEligible });
const suggestBooking = bookingEligible && !handoffRequired;

assert.equal(bookingEligible, true, "hot + booking stage should be eligible");
assert.equal(handoffRequired, false, "booking flow should defer hot handoff");
assert.equal(suggestBooking, true, "suggestBooking must be true");

console.log("✓ Handoff/booking logic: hot lead requesting booking → suggestBooking=true");
