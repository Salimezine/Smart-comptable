import type { Request, Response } from "express";
import { z } from "zod";
import { handleWebhookEvent } from "../business-logic/invoices/invoices.service.js";

const TeifWebhookSchema = z.object({
  eventType: z.string().optional(),
  invoiceNumber: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  type: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

/**
 * Map the elfatoora middleware "document.*" event names to the local
 * event types understood by handleWebhookEvent. Keeps backward
 * compatibility with the legacy { eventType, invoiceNumber, payload } format.
 */
export function normalizeWebhookEvent(
  raw: z.infer<typeof TeifWebhookSchema>,
): { eventType: string; invoiceNumber: string | null; payload: Record<string, unknown> } {
  const eventType = raw.eventType ?? (raw.type ? normalizeName(raw.type) : undefined);
  if (!eventType) {
    throw new Error("Missing eventType or type");
  }

  const invoiceNumber =
    raw.invoiceNumber ??
    (raw.payload?.document as { document_number?: string } | undefined)?.document_number ??
    (raw.data as { document?: { document_number?: string } } | undefined)?.document?.document_number ??
    null;

  const payload = raw.payload ?? (raw.data as Record<string, unknown>) ?? {};

  return { eventType, invoiceNumber, payload };
}

export function normalizeName(type: string): string {
  const map: Record<string, string> = {
    "document.received": "PENDING",
    "document.signing_requested": "PENDING",
    "document.signed": "SIGNED",
    "document.signing_failed": "FAILED",
    "document.ttn.submission_requested": "TTN_PENDING",
    "document.ttn.submitted": "TTN_SUBMITTED",
    "document.ttn.accepted": "TTN_ACCEPTED",
    "document.ttn.rejected": "TTN_REJECTED",
    "document.completed": "ACCEPTED",
    "document.failed": "FAILED",
    "document.cancelled": "FAILED",
    "document.retried": "PENDING",
    "document.status_changed": "PENDING",
  };
  return map[type] ?? type;
}

export async function teifWebhookHandler(
  req: Request,
  res: Response,
) {
  const parsed = TeifWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_PAYLOAD", message: "Invalid webhook payload" });
    return;
  }

  let event;
  try {
    event = normalizeWebhookEvent(parsed.data);
  } catch {
    res.status(400).json({ error: "INVALID_PAYLOAD", message: "Missing eventType or type" });
    return;
  }

  const result = await handleWebhookEvent(
    "elfatoora-middleware",
    event.eventType,
    event.invoiceNumber,
    event.payload,
  );

  res.status(200).json(result);
}
