import path from "node:path";
import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { appendEvent, type StoredEvent } from "../../platform/events/event-log.js";
import type { Consumer } from "../../platform/events/consumers.js";
import type { PerceptionAdapter } from "./adapter.js";
import { FixtureAdapter } from "./fixture-adapter.js";
import { IcsCalendarAdapter } from "./ics-calendar-adapter.js";

export type PerceptionOptions = {
  fixturesDir: string;
  /** Set (AIOS_CALENDAR_ICS_URL) → real ICS adapter; unset → calendar fixture. */
  calendarIcsUrl?: string;
};

/** Perception: converts the outside world into observation events via adapters. */
export function createPerceptionConsumer(db: Db, clock: Clock, options: PerceptionOptions): Consumer {
  const adapters: PerceptionAdapter[] = [
    options.calendarIcsUrl
      ? new IcsCalendarAdapter(db, clock, options.calendarIcsUrl)
      : new FixtureAdapter("calendar", db, path.join(options.fixturesDir, "calendar.json")),
    new FixtureAdapter("email", db, path.join(options.fixturesDir, "emails.json")),
    new FixtureAdapter("github", db, path.join(options.fixturesDir, "github.json")),
  ];
  return {
    name: "perception",
    async handle(event: StoredEvent): Promise<void> {
      if (event.type !== "time.day.started") return;
      const day = event.payload.day as string;
      for (const adapter of adapters) {
        const observations = await adapter.collect(day);
        for (const o of observations) {
          await appendEvent(db, "perception.observation.captured", 1, clock.now(), {
            ...o,
            day,
          });
        }
      }
    },
  };
}
