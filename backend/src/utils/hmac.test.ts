import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./hmac.js";

const SECRET = "test-webhook-secret";

function sign(secret: string, body: string, nowMs = Date.now()) {
  const timestamp = Math.floor(nowMs / 1000);
  const sig = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return { header: `t=${timestamp},v1=${sig}`, timestamp };
}

test("accepts a valid signature", () => {
  const body = JSON.stringify({ eventType: "SIGNED", invoiceNumber: "INV-1" });
  const { header } = sign(SECRET, body);
  assert.equal(verifyWebhookSignature(SECRET, header, body), true);
});

test("rejects a tampered body", () => {
  const { header } = sign(SECRET, "body-a");
  assert.equal(verifyWebhookSignature(SECRET, header, "body-b"), false);
});

test("rejects a wrong secret", () => {
  const body = "body";
  const { header } = sign(SECRET, body);
  assert.equal(verifyWebhookSignature("other-secret", header, body), false);
});

test("rejects a missing header", () => {
  assert.equal(verifyWebhookSignature(SECRET, undefined, "body"), false);
});

test("rejects a malformed header", () => {
  assert.equal(verifyWebhookSignature(SECRET, "garbage", "body"), false);
  assert.equal(verifyWebhookSignature(SECRET, "t=123", "body"), false);
  assert.equal(verifyWebhookSignature(SECRET, "v1=abcdef", "body"), false);
});

test("rejects an expired signature (replay)", () => {
  const now = Date.now();
  const body = "body";
  const { header, timestamp } = sign(SECRET, body, now);
  // 6 minutes later (> 5 min window)
  assert.equal(
    verifyWebhookSignature(SECRET, header, body, timestamp * 1000 + 6 * 60 * 1000),
    false,
  );
});

test("accepts a signature inside the freshness window", () => {
  const now = Date.now();
  const body = "body";
  const { header, timestamp } = sign(SECRET, body, now);
  assert.equal(
    verifyWebhookSignature(SECRET, header, body, timestamp * 1000 + 60 * 1000),
    true,
  );
});

test("rejects a non-numeric timestamp", () => {
  const body = "body";
  const sig = createHmac("sha256", SECRET).update(`abc.${body}`).digest("hex");
  assert.equal(verifyWebhookSignature(SECRET, `t=abc,v1=${sig}`, body), false);
});
