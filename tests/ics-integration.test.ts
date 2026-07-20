/**
 * Integration + idempotency tests for spec-0002: a local HTTP server serves
 * the committed sample ICS, the full pipeline runs, real events appear in
 * SituationView and briefing, re-runs emit nothing new, SEQUENCE bumps emit
 * exactly one update event. Requires: docker compose up -d postgres.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRuntime, type Runtime } from "../src/runtime/index.js";
import { SimClock } from "../src/platform/scheduler/clock.js";
import { findEvents, type StoredEvent } from "../src/platform/events/event-log.js";
import type { Db } from "../src/platform/db/pool.js";
import { freshDb, SIM_NOW } from "./helpers.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = path.join(DIR, "..", "fixtures", "sample-calendar.ics");

let server: Server;
let icsBody: string;
let db: Db;
let runtime: Runtime;

async function calendarObservations(): Promise<StoredEvent[]> {
  const events = await findEvents(db, "perception.observation.captured");
  return events.filter((e) => e.payload.source === "calendar");
}

beforeAll(async () => {
  icsBody = readFileSync(SAMPLE_PATH, "utf8");
  server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/calendar" });
    res.end(icsBody);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  db = await freshDb();
  runtime = await createRuntime({
    db,
    clock: new SimClock(SIM_NOW),
    fixturesDir: path.join(DIR, "..", "fixtures"),
    calendarIcsUrl: `http://127.0.0.1:${port}/sample-calendar.ics`,
  });
  await runtime.interaction.startDay();
});

afterAll(async () => {
  await db.end();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("ICS calendar integration (spec-0002)", () => {
  it("first run ingests all sample instances; other sources still ingest", async () => {
    const cal = await calendarObservations();
    // 1 single + 2 weekly instances + 1 all-day + 1 cancelled
    expect(cal).toHaveLength(5);
    const all = await findEvents(db, "perception.observation.captured");
    expect(all.some((e) => e.payload.source === "email")).toBe(true);
    expect(all.some((e) => e.payload.source === "github")).toBe(true);
  });

  it("ICS events appear in the SituationView with correct UTC times", async () => {
    const week = await runtime.situation.current("week");
    const imh = week.items.find(
      (i) => i.id === "si-calendar-aios-sample-0001@dw-itconsulting.de",
    );
    expect(imh).toBeDefined();
    expect(imh!.occursAt).toBe("2026-07-19T15:00:00.000Z");
    const standups = week.items.filter((i) =>
      i.id.startsWith("si-calendar-aios-sample-0002@dw-itconsulting.de#"),
    );
    expect(standups.map((s) => s.occursAt)).toEqual([
      "2026-07-21T07:00:00.000Z",
      "2026-07-23T07:00:00.000Z",
    ]);
  });

  it("ICS events appear in the rendered briefing (today horizon)", async () => {
    const brief = await runtime.interaction.brief();
    expect(brief).toContain("15:00 UTC — [calendar] IMH proposal preparation");
  });

  it("unknown attendee surfaces as a coverage gap", async () => {
    const view = await runtime.situation.current("today");
    expect(view.coverage.some((c) => c.mention === "Tobias Brandt")).toBe(true);
    const brief = await runtime.interaction.brief();
    expect(brief).toContain('Unrecognized mention "Tobias Brandt"');
  });

  it("cancelled instance is captured with status cancelled", async () => {
    const cal = await calendarObservations();
    const huber = cal.find(
      (e) => e.payload.sourceUid === "aios-sample-0004@dw-itconsulting.de",
    );
    expect(huber).toBeDefined();
    expect(huber!.payload.status).toBe("cancelled");
  });

  it("cancelled status reaches the Situation Model and the briefing", async () => {
    const week = await runtime.situation.current("week");
    const huber = week.items.find(
      (i) => i.id === "si-calendar-aios-sample-0004@dw-itconsulting.de",
    );
    expect(huber).toBeDefined();
    expect(huber!.status).toBe("cancelled");
    if (huber!.horizon === "today") {
      const brief = await runtime.interaction.brief();
      expect(brief).toContain("(cancelled)");
    }
  });

  it("idempotency: same ICS twice emits 0 new events", async () => {
    const before = (await calendarObservations()).length;
    await runtime.interaction.startDay();
    const after = (await calendarObservations()).length;
    expect(after).toBe(before);
  });

  it("bumped SEQUENCE emits exactly 1 update event for that instance", async () => {
    icsBody = icsBody.replace(
      "SEQUENCE:0\nDTSTART;TZID=Europe/Berlin:20260719T170000",
      "SEQUENCE:3\nDTSTART;TZID=Europe/Berlin:20260719T170000",
    );
    expect(icsBody).toContain("SEQUENCE:3"); // guard: replacement actually happened
    const before = await calendarObservations();
    await runtime.interaction.startDay();
    const after = await calendarObservations();
    expect(after.length).toBe(before.length + 1);
    const update = after[after.length - 1]!;
    expect(update.payload.externalId).toBe("aios-sample-0001@dw-itconsulting.de");
    expect(update.payload.status).toBe("confirmed");
    // still a single situation item for that event (updated, not duplicated)
    const week = await runtime.situation.current("week");
    const items = week.items.filter(
      (i) => i.id === "si-calendar-aios-sample-0001@dw-itconsulting.de",
    );
    expect(items).toHaveLength(1);
  });
});
