/**
 * IcsCalendarAdapter (spec-0002): first real read-only integration.
 * Fetches an ICS subscription URL, expands recurrences within
 * [today, today+7d], converts all times to UTC and emits only new/changed
 * instances (watermark-based idempotency via perception_watermarks).
 */
import { createHash } from "node:crypto";
import ical from "node-ical";
import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { parseIso } from "../../platform/scheduler/clock.js";
import type { Observation, PerceptionAdapter } from "./adapter.js";

const WATERMARK_SOURCE = "calendar-ics";
const FETCH_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [500, 2000]; // 2 retries with backoff
const WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

/** One concrete event instance inside the ingest window, times in UTC. */
export type IcsInstance = {
  uid: string;
  /** Stable per-instance key: `${uid}#${occursAt}` (single events: uid). */
  itemUid: string;
  title: string;
  body: string;
  occursAt: string; // ISO UTC
  endsAt: string | null; // ISO UTC
  allDay: boolean;
  location?: string;
  attendees: string[];
  status: "confirmed" | "cancelled";
  /** Revision marker: SEQUENCE, falling back to DTSTAMP (spec-0002). */
  revision: string;
};

type Warn = (msg: string, detail: Record<string, unknown>) => void;

const structuredLog =
  (level: "warn" | "error") => (msg: string, detail: Record<string, unknown>) =>
    console.error(JSON.stringify({ level, msg, adapter: WATERMARK_SOURCE, ...detail }));

function dateFromMs(ms: number): Date {
  const d = parseIso("1970-01-01T00:00:00.000Z");
  d.setTime(ms);
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * All-day values are parsed by node-ical as midnight in the server's local
 * timezone (marked dateOnly). Normalize to the calendar date at 00:00 UTC.
 */
function normalizeIcsDate(d: Date): { iso: string; allDay: boolean } {
  const dateOnly = (d as Date & { dateOnly?: boolean }).dateOnly === true;
  if (dateOnly) {
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`;
    return { iso, allDay: true };
  }
  return { iso: d.toISOString(), allDay: false };
}

function textValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "val" in v) return String((v as { val: unknown }).val ?? "");
  return "";
}

/** Attendee display name: CN parameter, falling back to the mailto address. */
function attendeeNames(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const names: string[] = [];
  for (const a of list) {
    if (typeof a === "string") {
      names.push(a.replace(/^mailto:/i, ""));
      continue;
    }
    const attendee = a as { params?: { CN?: string }; val?: string };
    const cn = attendee.params?.CN;
    if (cn) names.push(cn);
    else if (attendee.val) names.push(attendee.val.replace(/^mailto:/i, ""));
  }
  return names;
}

type ParsedVEvent = {
  type: string;
  uid?: string;
  summary?: unknown;
  description?: unknown;
  location?: unknown;
  attendee?: unknown;
  status?: string;
  sequence?: number | string;
  dtstamp?: Date;
  rrule?: unknown;
  exdate?: Record<string, Date>;
};

export type ParsedCalendar = Record<string, unknown>;

/**
 * Parse ICS text. Fast path: whole-feed parse. If that throws (node-ical
 * fails the entire feed on one malformed component), fall back to parsing
 * per UID group so malformed components are skipped with a warning and valid
 * ones proceed (partial ingest beats total failure — spec-0002).
 */
export function safeParseICS(icsText: string, warn: Warn = structuredLog("warn")): ParsedCalendar {
  try {
    return ical.sync.parseICS(icsText);
  } catch (err) {
    warn("full ICS parse failed, falling back to per-component parse", { error: String(err) });
  }

  const lines = icsText.split(/\r?\n/);
  const preamble: string[] = [];
  const groups = new Map<string, string[][]>(); // uid -> vevent blocks (lines)
  let block: string[] | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT\s*$/.test(line)) {
      block = [line];
    } else if (block && /^END:VEVENT\s*$/.test(line)) {
      block.push(line);
      const unfolded = block.join("\n").replace(/\r?\n[ \t]/g, "");
      const uid = /^UID[^:]*:(.*)$/m.exec(unfolded)?.[1]?.trim() ?? `no-uid-${groups.size}`;
      const list = groups.get(uid) ?? [];
      list.push(block);
      groups.set(uid, list);
      block = null;
    } else if (block) {
      block.push(line);
    } else {
      preamble.push(line);
    }
  }
  const header = preamble.filter((l) => !/^END:VCALENDAR\s*$/.test(l));

  const merged: ParsedCalendar = {};
  for (const [uid, blocks] of groups) {
    const doc = [...header, ...blocks.flat(), "END:VCALENDAR"].join("\n");
    try {
      const parsed = ical.sync.parseICS(doc);
      for (const [key, component] of Object.entries(parsed)) {
        const c = component as { type?: string } | undefined;
        if (c?.type === "VEVENT") merged[key] = component;
      }
    } catch (err) {
      warn("skipping malformed ICS component", { uid, error: String(err) });
    }
  }
  return merged;
}

/**
 * Expand every VEVENT into concrete instances within [windowStart, windowEnd).
 * Components whose expansion fails are skipped with a warning.
 * Exported separately so unit tests cover expansion without HTTP or DB.
 */
export function expandIcsInstances(
  parsed: ParsedCalendar,
  windowStart: Date,
  windowEnd: Date,
  warn: Warn = structuredLog("warn"),
): IcsInstance[] {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  // Widen the expansion range by one day so all-day events parsed as
  // local-timezone midnight are not lost at the window edges.
  const from = dateFromMs(startMs - DAY_MS);
  const to = dateFromMs(endMs + DAY_MS);

  const instances: IcsInstance[] = [];
  for (const [key, component] of Object.entries(parsed)) {
    const ev = component as ParsedVEvent | undefined;
    if (!ev || ev.type !== "VEVENT") continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expanded = ical.expandRecurringEvent(ev as any, { from, to });
      for (const inst of expanded) {
        const start = normalizeIcsDate(inst.start);
        const startTime = parseIso(start.iso).getTime();
        if (startTime < startMs || startTime >= endMs) continue;
        const instEvent = inst.event as unknown as ParsedVEvent;
        const uid = String(instEvent.uid ?? ev.uid ?? key);
        const end = inst.end ? normalizeIcsDate(inst.end) : null;
        const status =
          String(instEvent.status ?? "").toUpperCase() === "CANCELLED"
            ? "cancelled"
            : "confirmed";
        const sequence = instEvent.sequence ?? ev.sequence;
        const dtstamp = instEvent.dtstamp ?? ev.dtstamp;
        instances.push({
          uid,
          itemUid: inst.isRecurring || inst.isOverride ? `${uid}#${start.iso}` : uid,
          title: textValue(instEvent.summary ?? inst.summary),
          body: textValue(instEvent.description ?? ev.description),
          occursAt: start.iso,
          endsAt: end ? end.iso : null,
          allDay: start.allDay,
          location: textValue(instEvent.location ?? ev.location) || undefined,
          attendees: attendeeNames(instEvent.attendee ?? ev.attendee),
          status,
          revision: sequence !== undefined ? `seq:${sequence}` : `dtstamp:${dtstamp?.toISOString() ?? ""}`,
        });
      }
    } catch (err) {
      warn("skipping malformed ICS component", { uid: ev.uid ?? key, error: String(err) });
    }
  }
  instances.sort((a, b) => (a.itemUid < b.itemUid ? -1 : a.itemUid > b.itemUid ? 1 : 0));
  return instances;
}

/**
 * EXDATE-removed instances within the window. Emitted as cancellations only
 * if the instance was previously seen (watermark exists) — spec-0002.
 */
export function exdateCancellations(
  parsed: ParsedCalendar,
  windowStart: Date,
  windowEnd: Date,
): IcsInstance[] {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  const out: IcsInstance[] = [];
  const seenUids = new Set<string>();
  for (const [key, component] of Object.entries(parsed)) {
    const ev = component as ParsedVEvent | undefined;
    if (!ev || ev.type !== "VEVENT" || !ev.exdate) continue;
    const uid = String(ev.uid ?? key);
    for (const ex of Object.values(ev.exdate)) {
      if (!(ex instanceof Date)) continue;
      const { iso, allDay } = normalizeIcsDate(ex);
      const ms = parseIso(iso).getTime();
      if (ms < startMs || ms >= endMs) continue;
      const itemUid = `${uid}#${iso}`;
      if (seenUids.has(itemUid)) continue; // node-ical keys the same EXDATE twice
      seenUids.add(itemUid);
      out.push({
        uid,
        itemUid,
        title: textValue(ev.summary),
        body: textValue(ev.description),
        occursAt: iso,
        endsAt: null,
        allDay,
        location: textValue(ev.location) || undefined,
        attendees: attendeeNames(ev.attendee),
        status: "cancelled",
        revision: "exdate",
      });
    }
  }
  return out;
}

/** Content hash per spec-0002: uid + instance date + SEQUENCE/DTSTAMP + summary + times + status. */
export function contentHash(inst: IcsInstance): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        uid: inst.uid,
        itemUid: inst.itemUid,
        revision: inst.revision,
        title: inst.title,
        occursAt: inst.occursAt,
        endsAt: inst.endsAt,
        status: inst.status,
      }),
    )
    .digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, warn: Warn): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) throw err;
      warn("ICS fetch failed, retrying", { url, attempt: attempt + 1, delayMs: delay, error: String(err) });
      await sleep(delay);
    }
  }
}

export class IcsCalendarAdapter implements PerceptionAdapter {
  readonly source = "calendar" as const;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly url: string,
  ) {}

  async collect(day: string): Promise<Observation[]> {
    const warn = structuredLog("warn");
    let icsText: string;
    try {
      icsText = await fetchWithRetry(this.url, warn);
    } catch (err) {
      // Total failure is non-fatal: keep last ingested state, other sources proceed.
      structuredLog("error")("ICS fetch failed after retries, skipping calendar ingest", {
        url: this.url,
        error: String(err),
      });
      return [];
    }

    const windowStart = parseIso(`${day}T00:00:00.000Z`);
    const windowEnd = dateFromMs(windowStart.getTime() + WINDOW_DAYS * DAY_MS);

    let instances: IcsInstance[];
    let exdates: IcsInstance[];
    try {
      const parsed = safeParseICS(icsText, warn);
      instances = expandIcsInstances(parsed, windowStart, windowEnd, warn);
      exdates = exdateCancellations(parsed, windowStart, windowEnd);
    } catch (err) {
      structuredLog("error")("ICS parse failed, skipping calendar ingest", {
        url: this.url,
        error: String(err),
      });
      return [];
    }

    const res = await this.db.query(
      `SELECT item_uid, content_hash FROM perception_watermarks WHERE source = $1`,
      [WATERMARK_SOURCE],
    );
    const seen = new Map<string, string>(
      res.rows.map((r) => [r.item_uid as string, r.content_hash as string]),
    );

    // EXDATE removals count as cancellations only for previously seen instances.
    const candidates = [...instances, ...exdates.filter((e) => seen.has(e.itemUid))];

    const observations: Observation[] = [];
    const now = this.clock.now().toISOString();
    for (const inst of candidates) {
      const hash = contentHash(inst);
      if (seen.get(inst.itemUid) === hash) {
        await this.db.query(
          `UPDATE perception_watermarks SET last_seen_at = $3
           WHERE source = $1 AND item_uid = $2`,
          [WATERMARK_SOURCE, inst.itemUid, now],
        );
        continue;
      }
      observations.push({
        source: this.source,
        externalId: inst.itemUid,
        title: inst.title,
        body: inst.body,
        mentions: inst.attendees,
        occursAt: inst.occursAt,
        horizon: inst.occursAt.slice(0, 10) === day ? "today" : "week",
        attendees: inst.attendees,
        location: inst.location,
        allDay: inst.allDay,
        sourceUid: inst.uid,
        status: inst.status,
      });
      await this.db.query(
        `INSERT INTO perception_watermarks (source, item_uid, content_hash, last_seen_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (source, item_uid)
         DO UPDATE SET content_hash = EXCLUDED.content_hash, last_seen_at = EXCLUDED.last_seen_at`,
        [WATERMARK_SOURCE, inst.itemUid, hash, now],
      );
    }
    return observations;
  }
}
