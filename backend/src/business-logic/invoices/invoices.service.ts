import { z } from "zod";
import { db } from "../../db/client.js";
import { AppError } from "../../utils/errors.js";
import { submitToMiddleware, getTeifStatus } from "../teif/adapter.js";

export const InvoiceLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100),
});

export const CreateInvoiceSchema = z.object({
  invoice_number: z.string().min(1).max(70),
  client_name: z.string().min(1).max(200),
  client_tax_id: z.string().min(1).max(35),
  lines: z.array(InvoiceLineSchema).min(1),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function listInvoices(userId: string, companyId: string) {
  await ensureCompanyAccess(userId, companyId);

  return db
    .selectFrom("invoices")
    .selectAll()
    .where("company_id", "=", companyId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function getInvoice(userId: string, invoiceId: string) {
  const invoice = await db
    .selectFrom("invoices")
    .selectAll()
    .where("id", "=", invoiceId)
    .executeTakeFirst();

  if (!invoice) {
    throw new AppError(404, "NOT_FOUND", "Invoice not found");
  }

  await ensureCompanyAccess(userId, invoice.company_id);
  return invoice;
}

export async function createInvoice(
  userId: string,
  companyId: string,
  input: z.infer<typeof CreateInvoiceSchema>,
) {
  await ensureCompanyAccess(userId, companyId);

  const existing = await db
    .selectFrom("invoices")
    .select("id")
    .where("company_id", "=", companyId)
    .where("invoice_number", "=", input.invoice_number)
    .executeTakeFirst();

  if (existing) {
    throw new AppError(
      409,
      "CONFLICT",
      `Invoice ${input.invoice_number} already exists`,
    );
  }

  const subtotalHT = input.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice,
    0,
  );
  const totalTax = input.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice * (l.taxRate / 100),
    0,
  );
  const totalTTC = subtotalHT + totalTax;

  const invoice = await db
    .insertInto("invoices")
    .values({
      company_id: companyId,
      invoice_number: input.invoice_number,
      client_name: input.client_name,
      client_tax_id: input.client_tax_id,
      lines: JSON.stringify(input.lines),
      totals: JSON.stringify({
        subtotalHT: { amount: subtotalHT, currency: "TND" },
        totalTax: { amount: totalTax, currency: "TND" },
        totalTTC: { amount: totalTTC, currency: "TND" },
      }),
      issue_date: input.issue_date,
      due_date: input.due_date ?? null,
      status: "DRAFT",
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return invoice;
}

export async function validateInvoice(
  userId: string,
  invoiceId: string,
) {
  const invoice = await getInvoice(userId, invoiceId);

  if (invoice.status !== "DRAFT") {
    throw new AppError(400, "BAD_REQUEST", "Only DRAFT invoices can be validated");
  }

  const updated = await db
    .updateTable("invoices")
    .set({ status: "VALIDATED", updated_at: new Date() })
    .where("id", "=", invoiceId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return updated;
}

export async function submitInvoice(
  userId: string,
  invoiceId: string,
  companyTaxId: string,
) {
  const invoice = await getInvoice(userId, invoiceId);

  if (invoice.status !== "VALIDATED") {
    throw new AppError(
      400,
      "BAD_REQUEST",
      "Invoice must be VALIDATED before TEIF submission",
    );
  }

  await db
    .updateTable("invoices")
    .set({ teif_status: "PENDING", updated_at: new Date() })
    .where("id", "=", invoiceId)
    .execute();

  const lines = invoice.lines as Array<{
    lineNumber: number; description: string; quantity: number;
    unitPrice: number; taxRate: number;
  }>;

  try {
    const result = await submitToMiddleware({
      invoice: {
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        client_tax_id: invoice.client_tax_id,
        lines,
        totals: invoice.totals as {
          subtotalHT: { amount: number; currency: string };
          totalTax: { amount: number; currency: string };
          totalTTC: { amount: number; currency: string };
        },
        issue_date: invoice.issue_date,
      },
      sellerTaxId: companyTaxId,
    });

    await db
      .updateTable("invoices")
      .set({
        teif_status: "PENDING",
        teif_xml: result.teifXml,
        middleware_document_id: result.documentId,
        status: "SENT",
        updated_at: new Date(),
      })
      .where("id", "=", invoiceId)
      .execute();

    return result;
  } catch (err) {
    await db
      .updateTable("invoices")
      .set({ teif_status: "FAILED", updated_at: new Date() })
      .where("id", "=", invoiceId)
      .execute();

    throw err;
  }
}

export async function syncTeifStatus(
  userId: string,
  invoiceId: string,
) {
  const invoice = await getInvoice(userId, invoiceId);

  if (!invoice.middleware_document_id) {
    throw new AppError(400, "BAD_REQUEST", "Invoice has not been submitted to TEIF");
  }

  const remoteStatus = await getTeifStatus(invoice.invoice_number);
  const statusMap: Record<string, string> = {
    RECEIVED: "PENDING",
    SIGNING_PENDING: "PENDING",
    SIGNED: "SIGNED",
    SIGNING_FAILED: "FAILED",
    TTN_PENDING: "TTN_PENDING",
    TTN_SUBMITTED: "PENDING",
    ACCEPTED: "ACCEPTED",
    REJECTED: "REJECTED",
  };

  const newStatus = statusMap[remoteStatus.status] ?? "PENDING";

  await db
    .updateTable("invoices")
    .set({ teif_status: newStatus as any, updated_at: new Date() })
    .where("id", "=", invoiceId)
    .execute();

  return { localStatus: newStatus, remoteStatus: remoteStatus.status };
}

export async function handleWebhookEvent(
  source: string,
  eventType: string,
  invoiceNumber: string | null,
  payload: Record<string, unknown>,
) {
  const webhookId = await db
    .insertInto("webhook_events")
    .values({
      source,
      event_type: eventType,
      invoice_number: invoiceNumber,
      payload: payload as any,
      status: "RECEIVED",
      created_at: new Date(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  if (!invoiceNumber) return { webhookId: webhookId.id, processed: false };

  try {
    const invoice = await db
      .selectFrom("invoices")
      .selectAll()
      .where("invoice_number", "=", invoiceNumber)
      .executeTakeFirst();

    if (!invoice) {
      await markWebhookFailed(webhookId.id, "Invoice not found");
      return { webhookId: webhookId.id, processed: false };
    }

    const statusMap: Record<string, string> = {
      SIGNED: "SIGNED",
      REJECTED: "REJECTED",
      ACCEPTED: "ACCEPTED",
      TTN_SUBMITTED: "TTN_PENDING",
      TTN_ACCEPTED: "ACCEPTED",
      TTN_REJECTED: "REJECTED",
    };

    const newStatus = statusMap[eventType] ?? "PENDING";

    if (eventType === "SIGNED" && payload.xmlBase64) {
      await db
        .updateTable("invoices")
        .set({
          teif_status: newStatus as any,
          teif_xml: payload.xmlBase64 as string,
          updated_at: new Date(),
        })
        .where("id", "=", invoice.id)
        .execute();
    } else {
      await db
        .updateTable("invoices")
        .set({ teif_status: newStatus as any, updated_at: new Date() })
        .where("id", "=", invoice.id)
        .execute();
    }

    await db
      .updateTable("webhook_events")
      .set({ status: "PROCESSED", processed_at: new Date() })
      .where("id", "=", webhookId.id)
      .execute();

    return { webhookId: webhookId.id, processed: true };
  } catch (err) {
    await markWebhookFailed(
      webhookId.id,
      err instanceof Error ? err.message : "Unknown error",
    );
    return { webhookId: webhookId.id, processed: false };
  }
}

async function markWebhookFailed(id: string, error: string) {
  await db
    .updateTable("webhook_events")
    .set({ status: "FAILED", error, processed_at: new Date() })
    .where("id", "=", id)
    .execute();
}

async function ensureCompanyAccess(userId: string, companyId: string) {
  const company = await db
    .selectFrom("companies")
    .select("companies.id")
    .where("companies.id", "=", companyId)
    .where((eb) =>
      eb("companies.user_id", "=", userId).or(
        "companies.id",
        "in",
        db
          .selectFrom("company_members")
          .select("company_id")
          .where("company_id", "=", companyId)
          .where("user_id", "=", userId)
          .where("is_active", "=", true),
      ),
    )
    .executeTakeFirst();

  if (!company) {
    throw new AppError(404, "NOT_FOUND", "Company not found");
  }
}
