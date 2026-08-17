import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PATTERN = /^t=(\d+),v1=([0-9a-fA-F]+)$/;
const MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Verify an HMAC-SHA256 webhook signature in the format produced by the
 * elfatoora middleware: `t=<timestamp>,v1=<hex signature>` where
 * signature = HMAC-SHA256(secret, `${timestamp}.${rawBody}`).
 *
 * Returns false for missing, malformed, expired or mismatched signatures.
 */
export function verifyWebhookSignature(
  secret: string,
  headerValue: string | undefined,
  rawBody: string,
  nowMs = Date.now(),
): boolean {
  if (!headerValue) return false;

  const match = SIGNATURE_PATTERN.exec(headerValue.trim());
  if (!match) return false;

  const timestamp = match[1];
  const providedHex = match[2];
  if (!timestamp || !providedHex) return false;

  const timestampNum = Number(timestamp);
  if (!Number.isFinite(timestampNum)) return false;

  // Reject replay of stale signatures.
  if (nowMs - timestampNum * 1000 > MAX_AGE_MS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(providedHex, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
