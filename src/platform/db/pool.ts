import pg from "pg";

export type Db = pg.Pool;

export function createPool(databaseUrl: string): Db {
  return new pg.Pool({ connectionString: databaseUrl, max: 5 });
}

export function databaseUrlFromEnv(env: NodeJS.ProcessEnv): string {
  return env.DATABASE_URL ?? "postgres://aios:aios@localhost:54322/aios";
}
