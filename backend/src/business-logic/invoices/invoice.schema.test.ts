import { test } from "node:test";
import assert from "node:assert/strict";
import { CreateInvoiceSchema, InvoiceLineSchema } from "./invoices.service.js";

const validInvoice = {
  invoice_number: "INV-2026-001",
  client_name: "ACME SARL",
  client_tax_id: "1234567",
  lines: [
    { lineNumber: 1, description: "Prestation", quantity: 2, unitPrice: 150, taxRate: 19 },
  ],
  issue_date: "2026-08-17",
};

const validInvoiceSchema = CreateInvoiceSchema as { safeParse: (v: unknown) => { success: boolean } };

test("CreateInvoiceSchema accepts a valid invoice", () => {
  const result = CreateInvoiceSchema.safeParse(validInvoice);
  assert.equal(result.success, true);
});

test("CreateInvoiceSchema requires at least one line", () => {
  const result = CreateInvoiceSchema.safeParse({ ...validInvoice, lines: [] });
  assert.equal(result.success, false);
});

test("CreateInvoiceSchema validates issue_date format", () => {
  assert.equal(CreateInvoiceSchema.safeParse({ ...validInvoice, issue_date: "17/08/2026" }).success, false);
  assert.equal(CreateInvoiceSchema.safeParse({ ...validInvoice, issue_date: "2026-8-17" }).success, false);
});

test("CreateInvoiceSchema rejects negative quantities and prices", () => {
  assert.equal(
    CreateInvoiceSchema.safeParse({
      ...validInvoice,
      invoice_number: "bx",
      lines: [{ ...validInvoice.lines[0]!, quantity: -1 }],
    }).success,
    false,
  );
  assert.equal(
    CreateInvoiceSchema.safeParse({
      ...validInvoice,
      invoice_number: "bx",
      lines: [{ ...validInvoice.lines[0]!, unitPrice: -5 }],
    }).success,
    false,
  );
});

test("InvoiceLineSchema rejects tax rates above 100 and non-int line numbers", () => {
  assert.equal(InvoiceLineSchema.safeParse({ lineNumber: 1.5, description: "x", quantity: 1, unitPrice: 1, taxRate: 19 }).success, false);
  assert.equal(InvoiceLineSchema.safeParse({ lineNumber: 1, description: "x", quantity: 1, unitPrice: 1, taxRate: 101 }).success, false);
});