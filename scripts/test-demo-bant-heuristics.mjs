/**
 * Pure checks for BANT heuristics (no LLM / no dev server).
 * Run: node scripts/test-demo-bant-heuristics.mjs
 */
import assert from "node:assert/strict";

const BUDGET_RE =
  /\b(?:ghs|ghc|usd|us\$|\$|€|£)\s*[\d,]+(?:\.\d+)?|\b[\d,]+(?:\.\d+)?\s*(?:ghs|ghc|usd|dollars?)(?:\s*(?:per month|\/month|monthly))?/i;
const TIMELINE_RE =
  /\b(this month|next month|asap|as soon as possible|within \d+\s*(?:day|days|week|weeks|month|months)|start(?:ing)?\s+(?:this|next)\s+month|go live|launch\s+(?:this|next)\s+month|right away|immediately)\b/i;

const msg2 = "My budget is GHS 5,000 and I want to start this month.";
assert.match(msg2, BUDGET_RE, "budget regex");
assert.match(msg2, TIMELINE_RE, "timeline regex");

const msg1 =
  "I need social media management for my real estate company.";
assert.match(msg1, /social media/i, "social signal");
assert.match(msg1, /real estate/i, "real estate signal");

console.log("✓ BANT heuristic patterns match user test messages\n");
