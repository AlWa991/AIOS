import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { parseIso } from "../../platform/scheduler/clock.js";
import {
  appendEvent,
  readEventsAfter,
  type StoredEvent,
} from "../../platform/events/event-log.js";
import type { Consumer } from "../../platform/events/consumers.js";
import type {
  Horizon,
  Situation,
  SituationView,
} from "../../contracts/situation.js";

const OBSERVATION_KINDS = ["calendar", "email", "github"];

/** Fold one event into the situation_items projection. Pure w.r.t. the log. */
async function fold(db: Db, event: StoredEvent, publish: boolean): Promise<void> {
  const at = event.occurredAt;
  const changed: { itemId: string; kind: string; status: string }[] = [];

  if (event.type === "perception.observation.captured") {
    const p = event.payload;
    const id = `si-${p.source}-${p.externalId}`;
    await db.query(
      `INSERT INTO situation_items (id, kind, horizon, status, entity_ids, source_event_id, payload, updated_at)
       VALUES ($1, $2, $3, 'open', '{}', $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
      [id, p.source, p.horizon, event.id, JSON.stringify({ title: p.title, body: p.body ?? "", occursAt: p.occursAt ?? null, from: p.from ?? null }), at],
    );
    changed.push({ itemId: id, kind: p.source as string, status: "open" });
  } else if (event.type === "identity.entity.resolved") {
    const p = event.payload;
    await db.query(
      `UPDATE situation_items
       SET entity_ids = (SELECT array_agg(DISTINCT e ORDER BY e)
                         FROM unnest(entity_ids || $2::uuid) e)
       WHERE source_event_id = $1`,
      [p.sourceEventId, p.entityId],
    );
    if (p.confidence === "low") {
      const id = `cov-${p.entityId}`;
      await db.query(
        `INSERT INTO situation_items (id, kind, horizon, status, entity_ids, source_event_id, payload, updated_at)
         VALUES ($1, 'coverage', 'today', 'open', '{}', $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [id, event.id, JSON.stringify({ mention: p.mention, note: `Unrecognized mention "${p.mention}" — low-confidence entity created` }), at],
      );
      changed.push({ itemId: id, kind: "coverage", status: "open" });
    }
  } else if (event.type === "deliberation.recommendation.created") {
    const p = event.payload;
    const id = p.recommendationId as string;
    await db.query(
      `INSERT INTO situation_items (id, kind, horizon, status, entity_ids, source_event_id, payload, updated_at)
       VALUES ($1, 'recommendation', 'today', 'open', '{}', $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, event.id, JSON.stringify({ rationale: p.rationale, goalIds: p.goalIds, action: p.action ?? null }), at],
    );
    changed.push({ itemId: id, kind: "recommendation", status: "open" });
  } else if (event.type === "deliberation.approval.granted") {
    const id = event.payload.recommendationId as string;
    await db.query(
      `UPDATE situation_items SET status = 'approved', updated_at = $2
       WHERE id = $1 AND kind = 'recommendation' AND status = 'open'`,
      [id, at],
    );
    changed.push({ itemId: id, kind: "recommendation", status: "approved" });
  } else if (event.type === "execution.action.completed") {
    const p = event.payload;
    if (p.status === "completed") {
      const recId = p.recommendationId as string;
      await db.query(
        `UPDATE situation_items SET status = 'done', updated_at = $2
         WHERE id = $1 AND kind = 'recommendation'`,
        [recId, at],
      );
      const doneId = `done-${recId}`;
      await db.query(
        `INSERT INTO situation_items (id, kind, horizon, status, entity_ids, source_event_id, payload, updated_at)
         VALUES ($1, 'completion', 'today', 'done', '{}', $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [doneId, event.id, JSON.stringify({ recommendationId: recId, detail: p.detail }), at],
      );
      changed.push({ itemId: recId, kind: "recommendation", status: "done" });
      changed.push({ itemId: doneId, kind: "completion", status: "done" });
    }
  }

  if (publish) {
    for (const c of changed) {
      await appendEvent(db, "situation.item.updated", 1, parseIso(at), c);
    }
  }
}

export function createSituationConsumer(db: Db): Consumer {
  return {
    name: "situation",
    async handle(event: StoredEvent): Promise<void> {
      await fold(db, event, true);
    },
  };
}

/** Replay the whole event log into an (externally truncated) projection. */
export async function rebuildSituation(db: Db): Promise<void> {
  const events = await readEventsAfter(db, 0);
  for (const event of events) {
    await fold(db, event, false);
  }
}

export class SituationService implements Situation {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  async current(horizon: Horizon): Promise<SituationView> {
    const res = await this.db.query(`SELECT * FROM situation_items ORDER BY id`);
    const rows = res.rows;

    const items = rows
      .filter((r) => OBSERVATION_KINDS.includes(r.kind))
      .filter((r) => (horizon === "today" ? r.horizon === "today" : true))
      .map((r) => ({
        id: r.id as string,
        kind: r.kind as string,
        horizon: r.horizon as Horizon,
        status: r.status as string,
        title: (r.payload.title ?? "") as string,
        occursAt: (r.payload.occursAt ?? null) as string | null,
        entityIds: (r.entity_ids as string[]).slice().sort(),
        sourceEventId: Number(r.source_event_id),
        updatedAt: (r.updated_at as Date).toISOString(),
      }))
      .sort((a, b) => {
        const ka = `${a.occursAt ?? "9999"}|${a.id}`;
        const kb = `${b.occursAt ?? "9999"}|${b.id}`;
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });

    const recommendations = rows
      .filter((r) => r.kind === "recommendation")
      .map((r) => ({
        id: r.id as string,
        rationale: r.payload.rationale as string,
        goalIds: r.payload.goalIds as string[],
        status: r.status as "open" | "approved" | "done",
      }));

    const coverage = rows
      .filter((r) => r.kind === "coverage")
      .map((r) => ({
        mention: r.payload.mention as string,
        note: r.payload.note as string,
      }))
      .sort((a, b) => (a.mention < b.mention ? -1 : a.mention > b.mention ? 1 : 0));

    const completions = rows
      .filter((r) => r.kind === "completion")
      .map((r) => ({
        recommendationId: r.payload.recommendationId as string,
        detail: r.payload.detail as string,
      }));

    return {
      asOf: this.clock.now().toISOString(),
      items,
      recommendations,
      coverage,
      completions,
    };
  }
}
