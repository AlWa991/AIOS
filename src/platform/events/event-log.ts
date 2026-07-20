import type { Db } from "../db/pool.js";
import { validatePayload } from "../../contracts/events/registry.js";

export type StoredEvent = {
  id: number;
  type: string;
  version: number;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export async function appendEvent(
  db: Db,
  type: string,
  version: number,
  occurredAt: Date,
  payload: unknown,
): Promise<StoredEvent> {
  const valid = validatePayload(type, version, payload);
  const res = await db.query(
    `INSERT INTO events (type, version, occurred_at, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id, type, version, occurred_at, payload`,
    [type, version, occurredAt.toISOString(), JSON.stringify(valid)],
  );
  return rowToEvent(res.rows[0]);
}

export async function readEventsAfter(db: Db, lastId: number): Promise<StoredEvent[]> {
  const res = await db.query(
    `SELECT id, type, version, occurred_at, payload FROM events WHERE id > $1 ORDER BY id`,
    [lastId],
  );
  return res.rows.map(rowToEvent);
}

export async function findEvents(db: Db, type: string): Promise<StoredEvent[]> {
  const res = await db.query(
    `SELECT id, type, version, occurred_at, payload FROM events WHERE type = $1 ORDER BY id`,
    [type],
  );
  return res.rows.map(rowToEvent);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(row: any): StoredEvent {
  return {
    id: Number(row.id),
    type: row.type,
    version: row.version,
    occurredAt: new Date(row.occurred_at).toISOString(),
    payload: row.payload,
  };
}
