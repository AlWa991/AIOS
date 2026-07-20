import { readFileSync } from "node:fs";
import type { Db } from "../../platform/db/pool.js";
import { findEvents } from "../../platform/events/event-log.js";
import type { Observation, PerceptionAdapter, SourceName } from "./adapter.js";

type Fixture = {
  externalId: string;
  title: string;
  body?: string;
  from?: string;
  mentions: string[];
  occursAt?: string;
  horizon: "today" | "week";
};

/** Fixture adapter: deterministic observations from a committed JSON file, once per day. */
export class FixtureAdapter implements PerceptionAdapter {
  constructor(
    readonly source: SourceName,
    private readonly db: Db,
    private readonly file: string,
  ) {}

  async collect(day: string): Promise<Observation[]> {
    const existing = await findEvents(this.db, "perception.observation.captured");
    const alreadyIngested = existing.some(
      (e) => e.payload.source === this.source && e.payload.day === day,
    );
    if (alreadyIngested) return []; // idempotent per day
    const fixtures = JSON.parse(readFileSync(this.file, "utf8")) as Fixture[];
    return fixtures.map((f) => ({
      source: this.source,
      externalId: f.externalId,
      title: f.title,
      body: f.body ?? "",
      from: f.from,
      mentions: f.mentions,
      occursAt: f.occursAt,
      horizon: f.horizon,
    }));
  }
}
