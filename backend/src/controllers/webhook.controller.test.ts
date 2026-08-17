import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWebhookEvent, normalizeName } from "./webhook.controller.js";

test("normalizeName maps middleware document.* events", () => {
  assert.equal(normalizeName("document.signed"), "SIGNED");
  assert.equal(normalizeName("document.signing_failed"), "FAILED");
  assert.equal(normalizeName("document.ttn.submitted"), "TTN_SUBMITTED");
  assert.equal(normalizeName("document.ttn.accepted"), "TTN_ACCEPTED");
  assert.equal(normalizeName("document.completed"), "ACCEPTED");
  assert.equal(normalizeName("document.received"), "PENDING");
  assert.equal(normalizeName("unknown.event"), "unknown.event");
});

test("normalizeWebhookEvent accepts legacy format", () => {
  const out = normalizeWebhookEvent({
    eventType: "SIGNED",
    invoiceNumber: "INV-1",
    payload: { xmlBase64: "..." },
  });
  assert.deepEqual(out, {
    eventType: "SIGNED",
    invoiceNumber: "INV-1",
    payload: { xmlBase64: "..." },
  });
});

test("normalizeWebhookEvent accepts middleware format", () => {
  const middlewarePayload = {
    id: "evt-1",
    type: "document.signed",
    data: {
      document: { id: "d-1", document_number: "INV-9" },
    },
  };
  const out = normalizeWebhookEvent(middlewarePayload);
  assert.equal(out.eventType, "SIGNED");
  assert.equal(out.invoiceNumber, "INV-9");
  const doc = out.payload.document as { document_number?: string } | undefined;
  assert.equal(doc?.document_number, "INV-9");
});

test("normalizeWebhookEvent throws without any event name", () => {
  assert.throws(() => normalizeWebhookEvent({ payload: {} }), /Missing eventType or type/);
});