/** Unit tests for the ICS calendar adapter's expansion logic (spec-0002) — no HTTP, no DB. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  contentHash,
  exdateCancellations,
  expandIcsInstances,
  safeParseICS,
  type IcsInstance,
} from "../src/contexts/perception/ics-calendar-adapter.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = readFileSync(path.join(DIR, "..", "fixtures", "sample-calendar.ics"), "utf8");

const WINDOW_START = new Date("2026-07-19T00:00:00.000Z");
const WINDOW_END = new Date("2026-07-26T00:00:00.000Z");

const noWarn = () => undefined;

function expand(text: string): IcsInstance[] {
  return expandIcsInstances(safeParseICS(text, noWarn), WINDOW_START, WINDOW_END, noWarn);
}

describe("ICS expansion (spec-0002)", () => {
  const instances = expand(SAMPLE);

  it("converts Europe/Berlin TZID times to UTC", () => {
    const imh = instances.find((i) => i.uid === "aios-sample-0001@dw-itconsulting.de");
    expect(imh).toBeDefined();
    expect(imh!.occursAt).toBe("2026-07-19T15:00:00.000Z"); // 17:00 Berlin (CEST)
    expect(imh!.endsAt).toBe("2026-07-19T16:00:00.000Z");
    expect(imh!.allDay).toBe(false);
    expect(imh!.location).toBe("Office Munich");
    expect(imh!.attendees).toEqual(["Eduard", "Tobias Brandt"]);
    expect(imh!.status).toBe("confirmed");
  });

  it("expands the weekly RRULE into exactly the window's instances", () => {
    const standups = instances.filter((i) => i.uid === "aios-sample-0002@dw-itconsulting.de");
    expect(standups.map((s) => s.occursAt)).toEqual([
      "2026-07-21T07:00:00.000Z", // Tue 09:00 Berlin
      "2026-07-23T07:00:00.000Z", // Thu 09:00 Berlin
    ]);
    expect(standups.map((s) => s.itemUid)).toEqual([
      "aios-sample-0002@dw-itconsulting.de#2026-07-21T07:00:00.000Z",
      "aios-sample-0002@dw-itconsulting.de#2026-07-23T07:00:00.000Z",
    ]);
  });

  it("normalizes all-day events to the calendar date at 00:00 UTC", () => {
    const fair = instances.find((i) => i.uid === "aios-sample-0003@dw-itconsulting.de");
    expect(fair).toBeDefined();
    expect(fair!.allDay).toBe(true);
    expect(fair!.occursAt).toBe("2026-07-22T00:00:00.000Z");
  });

  it("marks STATUS:CANCELLED instances as cancelled", () => {
    const huber = instances.find((i) => i.uid === "aios-sample-0004@dw-itconsulting.de");
    expect(huber).toBeDefined();
    expect(huber!.status).toBe("cancelled");
    expect(huber!.occursAt).toBe("2026-07-24T12:00:00.000Z"); // 14:00 Berlin
  });

  it("keeps every expanded instance inside [today, today+7d)", () => {
    expect(instances).toHaveLength(5);
    for (const i of instances) {
      expect(i.occursAt >= "2026-07-19T00:00:00.000Z").toBe(true);
      expect(i.occursAt < "2026-07-26T00:00:00.000Z").toBe(true);
    }
  });

  it("excludes EXDATEd occurrences and exposes them as cancellation candidates", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:rec-1",
      "DTSTAMP:20260718T060000Z",
      "DTSTART;TZID=Europe/Berlin:20260714T090000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
      "EXDATE;TZID=Europe/Berlin:20260723T090000",
      "SUMMARY:Weekly with exdate",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const parsed = safeParseICS(text, noWarn);
    const expanded = expandIcsInstances(parsed, WINDOW_START, WINDOW_END, noWarn);
    expect(expanded.map((i) => i.occursAt)).toEqual(["2026-07-21T07:00:00.000Z"]);
    const cancelled = exdateCancellations(parsed, WINDOW_START, WINDOW_END);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]!.itemUid).toBe("rec-1#2026-07-23T07:00:00.000Z");
    expect(cancelled[0]!.status).toBe("cancelled");
  });

  it("skips malformed components with a warning but keeps valid ones", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:bad-1",
      "DTSTAMP:20260718T060000Z",
      "DTSTART;TZID=Europe/Berlin:20260720T100000",
      "RRULE:FREQ=BOGUS;BYDAY=XX",
      "SUMMARY:Broken recurring",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:good-1",
      "DTSTAMP:20260718T060000Z",
      "DTSTART;TZID=Europe/Berlin:20260720T110000",
      "SUMMARY:Valid event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const warnings: string[] = [];
    const parsed = safeParseICS(text, (msg) => warnings.push(msg));
    const expanded = expandIcsInstances(parsed, WINDOW_START, WINDOW_END, (msg) =>
      warnings.push(msg),
    );
    expect(expanded.map((i) => i.title)).toEqual(["Valid event"]);
    expect(expanded[0]!.occursAt).toBe("2026-07-20T09:00:00.000Z");
    expect(warnings.some((w) => w.includes("malformed"))).toBe(true);
  });

  it("content hash changes when the revision (SEQUENCE) changes", () => {
    const imh = instances.find((i) => i.uid === "aios-sample-0001@dw-itconsulting.de")!;
    const bumped = { ...imh, revision: "seq:3" };
    expect(contentHash(bumped)).not.toBe(contentHash(imh));
    expect(contentHash({ ...imh })).toBe(contentHash(imh));
  });
});
