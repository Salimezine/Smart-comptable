import { z } from "zod";
import { db } from "../../db/client.js";
import { AppError } from "../../utils/errors.js";

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(255),
  tax_id: z.string().min(1).max(35),
  address: z.string().max(500).optional(),
  category_code: z.string().max(10).optional(),
  rne: z.string().max(20).optional(),
});

export const UpdateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional(),
  category_code: z.string().max(10).optional(),
  rne: z.string().max(20).optional(),
});

export async function listCompanies(userId: string) {
  return db
    .selectFrom("companies")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function getCompany(userId: string, companyId: string) {
  const company = await db
    .selectFrom("companies")
    .selectAll()
    .where("id", "=", companyId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!company) {
    throw new AppError(404, "NOT_FOUND", "Company not found");
  }
  return company;
}

export async function createCompany(
  userId: string,
  input: z.infer<typeof CreateCompanySchema>,
) {
  const company = await db
    .insertInto("companies")
    .values({ user_id: userId, ...input })
    .returningAll()
    .executeTakeFirstOrThrow();

  return company;
}

export async function updateCompany(
  userId: string,
  companyId: string,
  input: z.infer<typeof UpdateCompanySchema>,
) {
  const existing = await getCompany(userId, companyId);

  const updated = await db
    .updateTable("companies")
    .set({ ...input, updated_at: new Date() })
    .where("id", "=", companyId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return updated;
}

export async function deleteCompany(userId: string, companyId: string) {
  await getCompany(userId, companyId);

  await db
    .deleteFrom("companies")
    .where("id", "=", companyId)
    .where("user_id", "=", userId)
    .execute();
}
