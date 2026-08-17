import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail } from "./normalize.js";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
  assert.equal(normalizeEmail("A.B+tag@Domain.tn"), "a.b+tag@domain.tn");
});

test("normalizeEmail handles already-normal emails", () => {
  assert.equal(normalizeEmail("user@example.com"), "user@example.com");
});
