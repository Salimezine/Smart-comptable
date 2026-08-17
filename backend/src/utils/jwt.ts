import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, env().JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(
  token: string,
): { userId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, env().JWT_SECRET) as {
      userId: string;
      email: string;
    };
    return decoded;
  } catch {
    return null;
  }
}
