import type { Request, Response } from "express";
import { z } from "zod";
import { handleWebhookEvent } from "../business-logic/invoices/invoices.service.js";

const TeifWebhookSchema = z.object({
  eventType: z.enum([
    "SIGNED",
    "REJECTED",
    "ACCEPTED",
    "TTN_SUBMITTED",
    "TTN_ACCEPTED",
    "TTN_REJECTED",
  ]),
  invoiceNumber: z.string().optional(),
  payload: z.record(z.unknown()),
});

export async function teifWebhookHandler(
  req: Request,
  res: Response,
) {
  const parsed = TeifWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_PAYLOAD", message: "Invalid webhook payload" });
    return;
  }

  const result = await handleWebhookEvent(
    "elfatoora-middleware",
    parsed.data.eventType,
    parsed.data.invoiceNumber ?? null,
    parsed.data.payload,
  );

  res.status(200).json(result);
}
