import { randomUUID } from "node:crypto";
import { db } from "../../db/client.js";
import { AppError } from "../../utils/errors.js";

export async function listMembers(userId: string, companyId: string) {
  await ensureAccess(userId, companyId);

  return db
    .selectFrom("company_members")
    .innerJoin("users", "users.id", "company_members.user_id")
    .select([
      "company_members.id",
      "company_members.user_id",
      "company_members.role",
      "company_members.is_active",
      "company_members.created_at",
      "users.name",
      "users.email",
    ])
    .where("company_members.company_id", "=", companyId)
    .orderBy("company_members.created_at", "asc")
    .execute();
}

export async function updateMemberRole(
  userId: string,
  companyId: string,
  memberId: string,
  newRole: "admin" | "accountant" | "viewer",
) {
  const membership = await db
    .selectFrom("company_members")
    .selectAll()
    .where("company_id", "=", companyId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!membership || membership.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only admins can change member roles");
  }

  const updated = await db
    .updateTable("company_members")
    .set({ role: newRole, updated_at: new Date() })
    .where("id", "=", memberId)
    .where("company_id", "=", companyId)
    .returningAll()
    .executeTakeFirst();

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "Member not found");
  }

  return updated;
}

export async function removeMember(
  userId: string,
  companyId: string,
  memberId: string,
) {
  const membership = await db
    .selectFrom("company_members")
    .selectAll()
    .where("company_id", "=", companyId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!membership || membership.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only admins can remove members");
  }

  const deleted = await db
    .deleteFrom("company_members")
    .where("id", "=", memberId)
    .where("company_id", "=", companyId)
    .returningAll()
    .executeTakeFirst();

  if (!deleted) {
    throw new AppError(404, "NOT_FOUND", "Member not found");
  }

  return deleted;
}

export async function createInvite(
  userId: string,
  companyId: string,
  email: string,
  role: "admin" | "accountant" | "viewer",
) {
  const membership = await db
    .selectFrom("company_members")
    .selectAll()
    .where("company_id", "=", companyId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!membership || membership.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only admins can invite members");
  }

  const existingUser = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", email)
    .executeTakeFirst();

  if (existingUser) {
    const alreadyMember = await db
      .selectFrom("company_members")
      .select("id")
      .where("company_id", "=", companyId)
      .where("user_id", "=", existingUser.id)
      .executeTakeFirst();

    if (alreadyMember) {
      throw new AppError(409, "CONFLICT", "User is already a member of this company");
    }
  }

  const invite = await db
    .insertInto("invites")
    .values({
      company_id: companyId,
      invited_by_user_id: userId,
      email,
      role,
      token: randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return invite;
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await db
    .selectFrom("invites")
    .selectAll()
    .where("token", "=", token)
    .where("status", "=", "PENDING")
    .executeTakeFirst();

  if (!invite) {
    throw new AppError(404, "NOT_FOUND", "Invite not found or already used");
  }

  if (new Date() > invite.expires_at) {
    await db
      .updateTable("invites")
      .set({ status: "EXPIRED", updated_at: new Date() })
      .where("id", "=", invite.id)
      .execute();
    throw new AppError(410, "EXPIRED", "Invite has expired");
  }

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  await db
    .insertInto("company_members")
    .values({
      company_id: invite.company_id,
      user_id: userId,
      role: invite.role,
      created_at: new Date(),
    })
    .execute();

  await db
    .updateTable("invites")
    .set({ status: "ACCEPTED", accepted_at: new Date(), updated_at: new Date() })
    .where("id", "=", invite.id)
    .execute();

  const company = await db
    .selectFrom("companies")
    .selectAll()
    .where("id", "=", invite.company_id)
    .executeTakeFirst();

  return { company, role: invite.role };
}

export async function listInvites(userId: string, companyId: string) {
  await ensureAccess(userId, companyId);

  return db
    .selectFrom("invites")
    .selectAll()
    .where("company_id", "=", companyId)
    .orderBy("created_at", "desc")
    .execute();
}

async function ensureAccess(userId: string, companyId: string) {
  const membership = await db
    .selectFrom("company_members")
    .select("id")
    .where("company_id", "=", companyId)
    .where("user_id", "=", userId)
    .where("is_active", "=", true)
    .executeTakeFirst();

  if (!membership) {
    throw new AppError(403, "FORBIDDEN", "Not a member of this company");
  }
}
