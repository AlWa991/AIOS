import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { appendEvent, findEvents, type StoredEvent } from "../../platform/events/event-log.js";
import type { Consumer } from "../../platform/events/consumers.js";

type Fixture = {
  externalId: string;
  title: string;
  body?: string;
  from?: string;
  mentions: string[];
  occursAt?: string;
  horizon: "today" | "week";
};

const SOURCES = ["calendar", "email", "github"] as const;

const FIXTURE_FILES: Record<(typeof SOURCES)[number], string> = {
  calendar: "calendar.json",
  email: "emails.json",
  github: "github.json",
};

/** Fixture adapters: convert the (mocked) outside world into observations. */
export function createPerceptionConsumer(db: Db, clock: Clock, fixturesDir: string): Consumer {
  return {
    name: "perception",
    async handle(event: StoredEvent): Promise<void> {
      if (event.type !== "time.day.started") return;
      const day = event.payload.day as string;
      const existing = await findEvents(db, "perception.observation.captured");
      if (existing.some((e) => e.payload.day === day)) return; // idempotent per day
      for (const source of SOURCES) {
        const file = path.join(fixturesDir, FIXTURE_FILES[source]);
        const fixtures = JSON.parse(readFileSync(file, "utf8")) as Fixture[];
        for (const f of fixtures) {
          await appendEvent(db, "perception.observation.captured", 1, clock.now(), {
            source,
            externalId: f.externalId,
            title: f.title,
            body: f.body ?? "",
            from: f.from,
            mentions: f.mentions,
            occursAt: f.occursAt,
            horizon: f.horizon,
            day,
          });
        }
      }
    },
  };
}
