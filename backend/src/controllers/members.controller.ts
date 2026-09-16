import type { NextFunction, Request, Response } from "express";
import {
  acceptInvite,
  createInvite,
  listInvites,
  listMembers,
  removeMember,
  updateMemberRole,
} from "../business-logic/companies/members.service.js";
import { z } from "zod";

export async function listMembersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const members = await listMembers(
      req.user!.userId,
      req.params["companyId"] as string,
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRoleHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { role } = z
      .object({ role: z.enum(["admin", "accountant", "viewer"]) })
      .parse(req.body);
    const updated = await updateMemberRole(
      req.user!.userId,
      req.params["companyId"] as string,
      req.params["memberId"] as string,
      role,
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeMemberHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await removeMember(
      req.user!.userId,
      req.params["companyId"] as string,
      req.params["memberId"] as string,
    );
    res.json({ removed: true, memberId: result.id });
  } catch (err) {
    next(err);
  }
}

export async function createInviteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, role } = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "accountant", "viewer"]).default("viewer"),
      })
      .parse(req.body);
    const invite = await createInvite(
      req.user!.userId,
      req.params["companyId"] as string,
      email,
      role,
    );
    res.status(201).json(invite);
  } catch (err) {
    next(err);
  }
}

export async function listInvitesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const invites = await listInvites(
      req.user!.userId,
      req.params["companyId"] as string,
    );
    res.json(invites);
  } catch (err) {
    next(err);
  }
}

export async function acceptInviteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token } = z
      .object({ token: z.string().uuid() })
      .parse(req.body);
    const result = await acceptInvite(token, req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
