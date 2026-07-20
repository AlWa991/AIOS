import path from "node:path";
import { runner } from "node-pg-migrate";

export async function migrateUp(databaseUrl: string): Promise<void> {
  await runner({
    databaseUrl,
    dir: path.join(process.cwd(), "migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    log: () => undefined,
  });
}
