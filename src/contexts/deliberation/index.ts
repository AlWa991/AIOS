import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import {
  appendEvent,
  findEvents,
  readEventsAfter,
  type StoredEvent,
} from "../../platform/events/event-log.js";
import type { Consumer } from "../../platform/events/consumers.js";
import type { Recommendation } from "../../contracts/deliberation.js";
import type { ActionRequest } from "../../contracts/execution.js";
import type { ModelPort } from "../../contracts/model.js";
import type { SituationView } from "../../contracts/situation.js";

type GoalFixture = { id: string; title: string; keywords: string[] };

const OBSERVATION_KINDS = ["calendar", "email", "github"];

async function upsertGoal(db: Db, p: Record<string, unknown>): Promise<void> {
  await db.query(
    `INSERT INTO goals_current (id, title, status, revision) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status, revision = EXCLUDED.revision`,
    [p.goalId, p.title, p.status, p.revision],
  );
}

/** Replay goal events into an (externally truncated) goals_current projection. */
export async function rebuildGoals(db: Db): Promise<void> {
  const events = await readEventsAfter(db, 0);
  for (const e of events) {
    if (e.type === "deliberation.goal.created") await upsertGoal(db, e.payload);
  }
}

/**
 * Produce a triage judgment from the current SituationView and emit it as an event.
 * Called from InteractionService.brief() before rendering — ADR-0017.
 */
export async function produceTriage(
  db: Db,
  clock: Clock,
  situation: SituationView,
  model: ModelPort,
): Promise<void> {
  const day = situation.asOf.slice(0, 10);

  // Check if triage already produced for today (idempotent)
  const existingTriage = await findEvents(db, "deliberation.triage.created");
  if (existingTriage.some((e) => (e.payload.day as string) === day)) {
    return; // Already produced today — idempotent
  }

  // Get previously presented item IDs for delta computation
  const briefingEvents = await findEvents(db, "interaction.briefing.delivered");
  const lastBriefing = briefingEvents
    .filter((e) => (e.payload.day as string) !== day) // Only past briefings for delta
    .at(-1);
  const lastPresentedItemIds = lastBriefing
    ? ((lastBriefing.payload.presentedItemIds as string[] | undefined) ?? [])
    : [];

  const triage = await model.triage({
    day,
    situationView: situation,
    lastPresentedItemIds,
  });

  // Ensure day and triageId are correct (model may have set them, override to be safe)
  triage.day = day;
  if (!triage.triageId) triage.triageId = `triage-${day}-${randomUUID().slice(0, 8)}`;

  await appendEvent(db, "deliberation.triage.created", 1, clock.now(), triage);
}

/** Rule-based recommender v1: deadline proximity x goal linkage (ADR-0014). */
export function createDeliberationConsumer(db: Db, clock: Clock, fixturesDir: string): Consumer {
  return {
    name: "deliberation",

    async handle(event: StoredEvent): Promise<void> {
      if (event.type === "time.day.started") {
        const existing = await findEvents(db, "deliberation.goal.created");
        if (existing.length === 0) {
          const goals = JSON.parse(
            readFileSync(path.join(fixturesDir, "goals.json"), "utf8"),
          ) as GoalFixture[];
          for (const g of goals) {
            await appendEvent(db, "deliberation.goal.created", 1, clock.now(), {
              goalId: g.id,
              title: g.title,
              status: "active",
              revision: 1,
              keywords: g.keywords,
            });
          }
        }
      } else if (event.type === "deliberation.goal.created") {
        await upsertGoal(db, event.payload);
      }
    },

    async onBatchEnd(): Promise<void> {
      const days = await findEvents(db, "time.day.started");
      const latest = days[days.length - 1];
      if (!latest) return;
      const day = latest.payload.day as string;

      const recEvents = await findEvents(db, "deliberation.recommendation.created");
      if (recEvents.some((e) => e.payload.day === day)) return;

      const goalEvents = await findEvents(db, "deliberation.goal.created");
      const goals = goalEvents.map((e) => e.payload as unknown as {
        goalId: string; title: string; keywords: string[];
      });
      if (goals.length === 0) return;

      const res = await db.query(
        `SELECT id, kind, horizon, payload FROM situation_items WHERE kind = ANY($1) ORDER BY id`,
        [OBSERVATION_KINDS],
      );
      if (res.rows.length === 0) return;

      const scored = res.rows
        .map((r) => {
          const text = `${r.payload.title ?? ""} ${r.payload.body ?? ""}`.toLowerCase();
          const matched = goals.filter((g) =>
            g.keywords.some((k) => text.includes(k.toLowerCase())),
          );
          const deadlineScore =
            (r.horizon === "today" ? 2 : 0) + (r.payload.occursAt ? 1 : 0);
          return { row: r, matched, score: matched.length * 2 + deadlineScore };
        })
        .filter((s) => s.matched.length > 0)
        .sort((a, b) => b.score - a.score || (a.row.id < b.row.id ? -1 : 1))
        .slice(0, 3);

      let n = 0;
      for (const s of scored) {
        n++;
        const goalTitles = s.matched.map((g) => g.title).join(", ");
        const rec: Recommendation = {
          id: `rec-${n}`,
          rationale: `"${s.row.payload.title}" (${s.row.kind}, ${s.row.horizon}) serves: ${goalTitles}`,
          goalIds: s.matched.map((g) => g.goalId),
        };
        let action: ActionRequest | undefined;
        if (s.row.kind === "email") {
          action = {
            adapter: "email.draft",
            reversibility: "compensable",
            payload: { to: s.row.payload.from ?? "unknown", subject: `Re: ${s.row.payload.title}` },
          };
        }
        await appendEvent(db, "deliberation.recommendation.created", 1, clock.now(), {
          recommendationId: rec.id,
          day,
          rationale: rec.rationale,
          goalIds: rec.goalIds,
          action,
        });
      }
    },
  };
}
