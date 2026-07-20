/**
 * Test setup — requires a running Postgres (with pgvector):
 *   docker compose up -d postgres
 * Connection via DATABASE_URL, default postgres://aios:aios@localhost:54322/aios.
 */
import { createPool, databaseUrlFromEnv, type Db } from "../src/platform/db/pool.js";
import { migrateUp } from "../src/platform/db/migrate.js";

export const SIM_NOW = "2026-07-19T06:00:00.000Z";

export function testDatabaseUrl(): string {
  return databaseUrlFromEnv(process.env);
}

export async function freshDb(): Promise<Db> {
  const url = testDatabaseUrl();
  await migrateUp(url);
  const db = createPool(url);
  await resetDb(db);
  return db;
}

export async function resetDb(db: Db): Promise<void> {
  await db.query(
    `TRUNCATE events, consumer_cursors, entities, entity_aliases, edges,
             episodes, goals_current, situation_items, perception_watermarks RESTART IDENTITY`,
  );
}
