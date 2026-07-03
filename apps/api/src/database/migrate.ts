import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadAppConfig } from "@propertyflow/config";

const config = loadAppConfig();
const pool = new Pool({
  connectionString: config.databaseUrl
});

try {
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");
  const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const migrationFile of migrationFiles) {
    const migration = await readFile(join(migrationsDir, migrationFile), "utf8");

    await pool.query(migration);

    console.log(`Applied migration: ${migrationFile}`);
  }
} finally {
  await pool.end();
}
