import type { Request, Response } from "express";
import { db, tbl } from "../db/client.js";
import type { DB } from "../db/schema.js";

export interface AuditEntry {
  userId: string | null;
  companyId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry, req?: Request) {
  try {
    const xff = req?.headers?.["x-forwarded-for"];
    const ip = Array.isArray(xff) ? xff[0] : (xff ?? req?.ip ?? null);

    await db
      .insertInto(tbl("audit_logs"))
      .values({
        user_id: entry.userId,
        company_id: entry.companyId,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        metadata: (entry.metadata as DB["audit_logs"]["metadata"]) ?? null,
        ip_address: ip,
      })
      .execute();
  } catch {
    // Never let audit logging fail the request
  }
}

export function audit(
  action: string,
  resourceType: string,
  getMeta?: (req: Request) => Record<string, unknown>,
) {
  return (req: Request, _res: unknown, next: () => void) => {
    const res = _res as Response;
    const oldJson = res.json.bind(res);
    (res as any).json = function (body: unknown) {
      const resourceId =
        (body as any)?.id ??
        req.params?.id ??
        req.params?.companyId ??
        null;
      logAudit({
        userId: (req as any).user?.userId ?? null,
        companyId: (req.params?.companyId as string) ?? null,
        action,
        resourceType,
        resourceId: resourceId?.toString() ?? null,
        metadata: getMeta ? getMeta(req) : undefined,
      }, req);
      return oldJson(body);
    };
    next();
  };
}
