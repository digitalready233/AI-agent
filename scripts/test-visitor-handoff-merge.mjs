import assert from "node:assert/strict";
import {
  shouldNotifyVisitorAiResumed,
} from "../lib/platform/visitor-handoff-lifecycle.ts";
import {
  conversationRequiresStaffHandling,
  mergeVisitorChatMessages,
} from "../lib/platform/visitor-chat.ts";
import { visitorSyncFingerprint } from "../lib/platform/visitor-chat-sync.ts";

assert.equal(conversationRequiresStaffHandling("human_needed"), true);
assert.equal(conversationRequiresStaffHandling("assigned"), true);
assert.equal(conversationRequiresStaffHandling("ai_handling"), false);

const server = [
  {
    id: "s1",
    role: "user",
    content: "Hello",
    at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "s2",
    role: "staff",
    content: "Hi, I can help.",
    at: "2026-01-01T00:01:00.000Z",
    label: "Alex",
  },
];

const local = [
  {
    id: "u_123",
    role: "user",
    content: "Follow up",
    at: "",
  },
];

const merged = mergeVisitorChatMessages(local, server);
assert.equal(merged.length, 3);
assert.ok(merged.some((m) => m.role === "staff"));
assert.ok(merged.some((m) => m.id === "u_123"));

const deduped = mergeVisitorChatMessages(
  [{ id: "u_1", role: "user", content: "Hello", at: "" }],
  server
);
assert.equal(deduped.length, 2);

assert.equal(shouldNotifyVisitorAiResumed("assigned", "resolved"), true);
assert.equal(shouldNotifyVisitorAiResumed("ai_handling", "resolved"), false);

const fp1 = visitorSyncFingerprint({
  conversationId: "c1",
  status: "assigned",
  staffHandling: true,
  handoffActive: true,
  staffJoined: true,
  messages: [{ id: "m1", role: "staff", content: "Hi", at: "t1" }],
});
const fp2 = visitorSyncFingerprint({
  conversationId: "c1",
  status: "assigned",
  staffHandling: true,
  handoffActive: true,
  staffJoined: true,
  messages: [{ id: "m2", role: "staff", content: "Hi", at: "t2" }],
});
assert.notEqual(fp1, fp2);

console.log("visitor-handoff-merge: ok");
