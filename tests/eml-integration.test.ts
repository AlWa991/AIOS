/**
 * Integration + idempotency tests for spec-0003: a temp copy of the committed
 * sample-emails directory feeds the real EmlDirAdapter, the full pipeline
 * runs, threads appear as SINGLE items in SituationView + briefing, unknown
 * senders surface as coverage gaps, re-runs emit nothing new, and one new
 * reply .eml emits exactly one update event. Requires: docker compose up -d postgres.
 */
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRuntime, type Runtime } from "../src/runtime/index.js";
import { SimClock } from "../src/platform/scheduler/clock.js";
import { findEvents, type StoredEvent } from "../src/platform/events/event-log.js";
import type { Db } from "../src/platform/db/pool.js";
import { freshDb, SIM_NOW } from "./helpers.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.join(DIR, "..", "fixtures", "sample-emails");
const THREAD_ID = "imh-offer-0001@dw-itconsulting.de";
const ITEM_ID = `si-email-${THREAD_ID}`;

let tempDir: string;
let db: Db;
let runtime: Runtime;

async function emailObservations(): Promise<StoredEvent[]> {
  const events = await findEvents(db, "perception.observation.captured");
  return events.filter((e) => e.payload.source === "email");
}

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "aios-eml-"));
  for (const f of readdirSync(SAMPLES).filter((f) => f.endsWith(".eml"))) {
    copyFileSync(path.join(SAMPLES, f), path.join(tempDir, f));
  }
  db = await freshDb();
  runtime = await createRuntime({
    db,
    clock: new SimClock(SIM_NOW),
    fixturesDir: path.join(DIR, "..", "fixtures"),
    emailEmlDir: tempDir,
  });
  await runtime.interaction.startDay();
});

afterAll(async () => {
  await db.end();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("email .eml integration (spec-0003)", () => {
  it("first run ingests one observation per thread; other sources still ingest", async () => {
    const emails = await emailObservations();
    // 5 single mails + 1 three-message thread = 6 threads
    expect(emails).toHaveLength(6);
    const all = await findEvents(db, "perception.observation.captured");
    expect(all.some((e) => e.payload.source === "calendar")).toBe(true);
    expect(all.some((e) => e.payload.source === "github")).toBe(true);
  });

  it("the 3-message thread arrives as ONE observation with thread metadata", async () => {
    const emails = await emailObservations();
    const imh = emails.filter((e) => e.payload.externalId === THREAD_ID);
    expect(imh).toHaveLength(1);
    expect(imh[0]!.payload.threadId).toBe(THREAD_ID);
    expect(imh[0]!.payload.messageCount).toBe(3);
    expect(imh[0]!.payload.title).toBe("IMH Angebot: Klassifizierungs-Webapp Phase 2");
    expect(imh[0]!.payload.sourceUid).toBe("imh-offer-0003@dw-itconsulting.de");
    expect(imh[0]!.payload.occursAt).toBe("2026-07-19T08:05:00.000Z"); // 10:05 Berlin
    expect(imh[0]!.payload.horizon).toBe("today");
  });

  it("the thread is a SINGLE item in the SituationView", async () => {
    const week = await runtime.situation.current("week");
    const items = week.items.filter((i) => i.id === ITEM_ID);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("IMH Angebot: Klassifizierungs-Webapp Phase 2");
    // no per-message items exist
    expect(week.items.some((i) => i.id.includes("imh-offer-0002"))).toBe(false);
    expect(week.items.some((i) => i.id.includes("imh-offer-0003"))).toBe(false);
  });

  it("threads appear in the rendered briefing as single items", async () => {
    const brief = await runtime.interaction.brief();
    expect(brief).toContain("[email] IMH Angebot: Klassifizierungs-Webapp Phase 2");
    expect(brief).toContain("[email] AIOS deployment window on Monday");
    // exactly one line for the whole IMH thread
    const threadLines = brief.split("\n").filter((l) => l.includes("IMH Angebot"));
    expect(threadLines).toHaveLength(1);
  });

  it("unknown sender surfaces as a coverage gap", async () => {
    const view = await runtime.situation.current("today");
    expect(view.coverage.some((c) => c.mention === "Petra Lindner")).toBe(true);
    const brief = await runtime.interaction.brief();
    expect(brief).toContain('Unrecognized mention "Petra Lindner"');
  });

  it("umlauts survive the full pipeline into the SituationView", async () => {
    const week = await runtime.situation.current("week");
    const item = week.items.find((i) => i.id === "si-email-aios-mail-0003@dw-itconsulting.de");
    expect(item).toBeDefined();
    expect(item!.title).toBe("Rückfrage Fördermittel");
  });

  it("idempotency: same directory twice emits 0 new email observations", async () => {
    const before = (await emailObservations()).length;
    await runtime.interaction.startDay();
    const after = (await emailObservations()).length;
    expect(after).toBe(before);
  });

  it("a new reply .eml emits exactly 1 update event and keeps ONE situation item", async () => {
    const reply = [
      "Message-ID: <imh-offer-0004@dw-itconsulting.de>",
      "In-Reply-To: <imh-offer-0003@dw-itconsulting.de>",
      "References: <imh-offer-0001@dw-itconsulting.de> <imh-offer-0002@dw-itconsulting.de> <imh-offer-0003@dw-itconsulting.de>",
      "Date: Sun, 19 Jul 2026 12:00:00 +0200",
      "From: Alex <alex@dw-itconsulting.de>",
      "To: Eddy <eduard.dinges@dw-itconsulting.de>",
      "Subject: Re: IMH Angebot: Klassifizierungs-Webapp Phase 2",
      "",
      "Final PDF looks good — send it out Monday morning.",
      "",
      "On Sun, 19 Jul 2026 at 10:05, Eddy wrote:",
      "> Agreed, updated to 13 days total and adjusted the price.",
      "",
    ].join("\n");
    writeFileSync(path.join(tempDir, "13-imh-offer-4.eml"), reply);

    const before = await emailObservations();
    await runtime.interaction.startDay();
    const after = await emailObservations();
    expect(after.length).toBe(before.length + 1);

    const update = after[after.length - 1]!;
    expect(update.payload.externalId).toBe(THREAD_ID);
    expect(update.payload.messageCount).toBe(4);
    expect(update.payload.sourceUid).toBe("imh-offer-0004@dw-itconsulting.de");
    expect(update.payload.body).toContain("send it out Monday morning");
    expect(update.payload.body).not.toContain("updated to 13 days"); // quoted tail stripped

    const week = await runtime.situation.current("week");
    const items = week.items.filter((i) => i.id === ITEM_ID);
    expect(items).toHaveLength(1);
  });
});
