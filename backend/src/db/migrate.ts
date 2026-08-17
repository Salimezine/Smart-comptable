import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import pg from "pg";
import { env } from "../config/env.js";

async function migrate() {
  const pool = new pg.Pool({ connectionString: env().DATABASE_URL });
  const client = await pool.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        run_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Get all SQL migration files
    const migrationsDir = path.join(process.cwd(), "src/db/migrations");
    let files: string[];
    try {
      files = await fs.readdir(migrationsDir);
    } catch {
      files = await fs.readdir(path.join(process.cwd(), "dist/db/migrations"));
    }

    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    for (const file of sqlFiles) {
      const { rows } = await client.query(
        "SELECT 1 FROM _migrations WHERE name = $1",
        [file],
      );
      if (rows.length > 0) {
        console.log(`[SKIP] ${file} (already run)`);
        continue;
      }

      const sql = await fs.readFile(
        path.join(migrationsDir, file),
        "utf-8",
      );
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`[OK]   ${file}`);
    }

    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

await migrate();
