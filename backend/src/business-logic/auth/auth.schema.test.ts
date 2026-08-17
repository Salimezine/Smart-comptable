import { test } from "node:test";
import assert from "node:assert/strict";
import { RegisterSchema, LoginSchema } from "./auth.service.js";

test("RegisterSchema requires a valid name field", () => {
  // Frontend (cloudClient) sends nom/prenom instead of name -> must fail.
  const result = RegisterSchema.safeParse({
    email: "user@example.com",
    password: "secret123",
    nom: "Jean",
    prenom: "Dupont",
  });
  assert.equal(result.success, false);
});

test("RegisterSchema accepts a valid payload", () => {
  const result = RegisterSchema.safeParse({
    email: "user@example.com",
    password: "secret123",
    name: "Jean Dupont",
  });
  assert.equal(result.success, true);
  assert.notEqual(result.success && result.data.email, "  user@example.com ");
});

test("RegisterSchema rejects invalid email and short password", () => {
  assert.equal(RegisterSchema.safeParse({ email: "not-an-email", password: "x", name: "A" }).success, false);
  assert.equal(RegisterSchema.safeParse({ email: "a@b.io", password: "short", name: "A" }).success, false);
});

test("LoginSchema requires email and password", () => {
  assert.equal(LoginSchema.safeParse({ email: "a@b.io", password: "x" }).success, true);
  assert.equal(LoginSchema.safeParse({ email: "a@b.io" }).success, false);
  assert.equal(LoginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
});