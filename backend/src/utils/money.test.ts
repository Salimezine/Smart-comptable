import { test } from "node:test";
import assert from "node:assert/strict";
import { roundMoney } from "./money.js";

test("roundMoney rounds to 3 decimals by default", () => {
  assert.equal(roundMoney(19.999), 19.999);
  assert.equal(roundMoney(1.0005), 1.001);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test("roundMoney respects custom digits", () => {
  assert.equal(roundMoney(19.995, 2), 20);
  assert.equal(roundMoney(12.345678, 2), 12.35);
  assert.equal(roundMoney(1.005, 2), 1.01);
});

test("roundMoney handles non-finite values safely", () => {
  assert.equal(roundMoney(Number.NaN), 0);
  assert.equal(roundMoney(Number.POSITIVE_INFINITY), 0);
  assert.equal(roundMoney(Number.NEGATIVE_INFINITY), 0);
});

test("roundMoney preserves zero and negatives", () => {
  assert.equal(roundMoney(0), 0);
  assert.equal(roundMoney(-1.2344), -1.234);
  assert.equal(roundMoney(-1.2345), -1.234);
});
