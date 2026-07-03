import { readFile } from "node:fs/promises";
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
  const migration = await readFile(join(migrationsDir, "0001_property_inventory.sql"), "utf8");

  await pool.query(migration);

  console.log("Applied migration: 0001_property_inventory.sql");
} finally {
  await pool.end();
}

