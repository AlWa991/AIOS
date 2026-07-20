import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { appendEvent, type StoredEvent } from "../../platform/events/event-log.js";
import type { Consumer } from "../../platform/events/consumers.js";
import type { Episode, Memory } from "../../contracts/memory.js";
import type { Horizon } from "../../contracts/situation.js";

export class MemoryService implements Memory {
  constructor(private readonly db: Db) {}

  async recall(q: { entityIds?: string[]; horizon?: Horizon; text?: string }): Promise<Episode[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (q.entityIds && q.entityIds.length > 0) {
      params.push(q.entityIds);
      clauses.push(`entity_ids && $${params.length}::uuid[]`);
    }
    if (q.text) {
      params.push(`%${q.text}%`);
      clauses.push(`summary ILIKE $${params.length}`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const res = await this.db.query(
      `SELECT id, summary, entity_ids, valid_from, valid_to, recorded_at
       FROM episodes ${where} ORDER BY id`,
      params,
    );
    // pg returns timestamptz columns as Date instances
    return res.rows.map((r) => ({
      id: r.id,
      summary: r.summary,
      entityIds: r.entity_ids,
      validFrom: (r.valid_from as Date).toISOString(),
      validTo: r.valid_to ? (r.valid_to as Date).toISOString() : null,
      recordedAt: (r.recorded_at as Date).toISOString(),
    }));
  }
}

export function createMemoryConsumer(db: Db, clock: Clock): Consumer {
  return {
    name: "memory",
    async handle(event: StoredEvent): Promise<void> {
      if (event.type === "perception.observation.captured") {
        const episodeId = `ep-obs-${event.id}`;
        const summary = `Observed (${event.payload.source}): ${event.payload.title}`;
        const inserted = await db.query(
          `INSERT INTO episodes (id, summary, entity_ids, valid_from, valid_to, recorded_at)
           VALUES ($1, $2, '{}', $3, NULL, $3) ON CONFLICT (id) DO NOTHING`,
          [episodeId, summary, event.occurredAt],
        );
        if (inserted.rowCount === 1) {
          await appendEvent(db, "memory.episode.recorded", 1, clock.now(), {
            episodeId,
            summary,
            entityIds: [],
            sourceEventId: event.id,
          });
        }
      } else if (event.type === "identity.entity.resolved") {
        await db.query(
          `UPDATE episodes
           SET entity_ids = (SELECT array_agg(DISTINCT e ORDER BY e)
                             FROM unnest(entity_ids || $2::uuid) e)
           WHERE id = $1`,
          [`ep-obs-${event.payload.sourceEventId}`, event.payload.entityId],
        );
      } else if (event.type === "execution.action.completed") {
        const episodeId = `ep-action-${event.id}`;
        const summary = `Action ${event.payload.adapter} ${event.payload.status}: ${event.payload.detail}`;
        const inserted = await db.query(
          `INSERT INTO episodes (id, summary, entity_ids, valid_from, valid_to, recorded_at)
           VALUES ($1, $2, '{}', $3, NULL, $3) ON CONFLICT (id) DO NOTHING`,
          [episodeId, summary, event.occurredAt],
        );
        if (inserted.rowCount === 1) {
          await appendEvent(db, "memory.episode.recorded", 1, clock.now(), {
            episodeId,
            summary,
            entityIds: [],
            sourceEventId: event.id,
          });
        }
      }
    },
  };
}
