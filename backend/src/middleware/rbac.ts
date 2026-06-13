import type { NextFunction, Request, Response } from "express";
import { db } from "../db/client.js";

export function requireCompanyRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.params["companyId"] as string ?? req.body?.companyId as string;
      if (!companyId) {
        res.status(400).json({ error: "BAD_REQUEST", message: "companyId required" });
        return;
      }

      const membership = await db
        .selectFrom("company_members")
        .selectAll()
        .where("company_id", "=", companyId)
        .where("user_id", "=", req.user!.userId)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (!membership) {
        res.status(403).json({ error: "FORBIDDEN", message: "Not a member of this company" });
        return;
      }

      if (roles.length > 0 && !roles.includes(membership.role)) {
        res.status(403).json({
          error: "FORBIDDEN",
          message: `Requires one of roles: ${roles.join(", ")}`,
        });
        return;
      }

      (req as any).membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
