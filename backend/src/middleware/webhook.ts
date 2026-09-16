import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { verifyWebhookSignature } from "../utils/hmac.js";

/**
 * Verify the HMAC signature (`X-Tekru-Signature`) attached to webhook
 * requests coming from the elfatoora middleware.
 *
 * When `WEBHOOK_SECRET` is not configured, requests are accepted as-is to
 * preserve backward compatibility with existing deployments. When it is
 * configured, requests without a valid, fresh signature are rejected.
 */
export function verifyWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secret = env().WEBHOOK_SECRET;
  if (!secret) {
    return next();
  }

  const rawBody =
    (req as Request & { rawBody?: string }).rawBody ??
    JSON.stringify(req.body ?? {});

  const header = req.headers["x-tekru-signature"];
  const valid = verifyWebhookSignature(
    secret,
    typeof header === "string" ? header : undefined,
    rawBody,
  );

  if (!valid) {
    res
      .status(401)
      .json({ error: "INVALID_SIGNATURE", message: "Invalid webhook signature" });
    return;
  }

  next();
}