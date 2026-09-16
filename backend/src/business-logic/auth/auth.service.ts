import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../../db/client.js";
import { signToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/errors.js";
import { normalizeEmail } from "../../utils/normalize.js";

export const RegisterSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  name: z.string().trim().min(1).max(200),
});

export const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function register(input: z.infer<typeof RegisterSchema>) {
  const email = normalizeEmail(input.email);

  const existing = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", email)
    .executeTakeFirst();

  if (existing) {
    throw new AppError(409, "CONFLICT", "Email already registered");
  }

  const password_hash = await bcrypt.hash(input.password, 10);

  const user = await db
    .insertInto("users")
    .values({ email, password_hash, name: input.name })
    .returning(["id", "email", "name"])
    .executeTakeFirstOrThrow();

  const token = signToken({ userId: user.id, email: user.email });

  return { user, token };
}

export async function login(input: z.infer<typeof LoginSchema>) {
  const email = normalizeEmail(input.email);

  const user = await db
    .selectFrom("users")
    .select(["id", "email", "name", "password_hash", "is_active"])
    .where("email", "=", email)
    .executeTakeFirst();

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
  }

  if (!user.is_active) {
    throw new AppError(403, "FORBIDDEN", "Account is disabled");
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
  }

  const token = signToken({ userId: user.id, email: user.email });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
}
