import "dotenv/config";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "./schema.js";
import { env } from "../config/env.js";

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: env().DATABASE_URL,
  }),
});

export const db = new Kysely<DB>({ dialect });

export function tbl<T extends keyof DB>(name: T): T {
  return name;
}
