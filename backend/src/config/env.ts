import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  MIDDLEWARE_URL: z.string().default("http://localhost:3000"),
  MIDDLEWARE_API_TOKEN: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WEBHOOK_SECRET: z.string().min(1).optional(),
});

let _env: z.infer<typeof envSchema>;

export function validateEnv() {
  _env = envSchema.parse(process.env);
}

export function env() {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
