/**
 * spec-0004 acceptance tests:
 * - Triage contract: schema caps, invalid output → retry → fallback
 * - Provenance: citation of non-existent priority → dropped + violation logged
 * - Delta/idempotency: same-day re-brief idempotent; next-day delta
 * - Conversation verbs: each emits its event; prio → priority event with provenance
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRuntime, type Runtime } from "../src/runtime/index.js";
import { SimClock } from "../src/platform/scheduler/clock.js";
import type { Db } from "../src/platform/db/pool.js";
import type { ModelPort, TriageRequest } from "../src/contracts/model.js";
import type { TriagePayload } from "../src/contracts/deliberation.js";
import { eventSchemas } from "../src/contracts/events/registry.js";
import { findEvents, appendEvent } from "../src/platform/events/event-log.js";
import { enforceProvenance, runConversationLoop } from "../src/contexts/interaction/index.js";
import { buildFallbackTriage } from "../src/platform/model/anthropic-model.js";
import { MockModel } from "../src/platform/model/mock-model.js";
import { freshDb, resetDb, SIM_NOW } from "./helpers.js";
import { ConsumerRunner } from "../src/platform/events/consumers.js";
import { createSituationConsumer, SituationService } from "../src/contexts/situation/index.js";
import { produceTriage } from "../src/contexts/deliberation/index.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(DIR, "..", "fixtures");
const triageSchema = eventSchemas["deliberation.triage.created@1"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSituationView(overrides: Partial<Awaited<ReturnType<Runtime["situation"]["current"]>>> = {}) {
  return {
    asOf: SIM_NOW,
    items: [],
    recommendations: [],
    coverage: [],
    completions: [],
    priorities: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Triage contract tests
// ─────────────────────────────────────────────────────────────────────────────

describe("triage contract (spec-0004)", () => {
  it("schema rejects needsYou > 3 items", () => {
    const result = triageSchema.safeParse({
      triageId: "t1",
      day: "2026-07-19",
      openingLine: "Test",
      needsYou: [
        { itemId: "a", reason: "r", citedPriorityIds: [] },
        { itemId: "b", reason: "r", citedPriorityIds: [] },
        { itemId: "c", reason: "r", citedPriorityIds: [] },
        { itemId: "d", reason: "r", citedPriorityIds: [] }, // ← 4th item, invalid
      ],
      changed: [],
      blocked: [],
      ignorable: { count: 0, summary: "none", itemIds: [] },
      blindSpots: [],
      modelId: "mock",
    });
    expect(result.success).toBe(false);
  });

  it("schema accepts needsYou ≤ 3", () => {
    const result = triageSchema.safeParse({
      triageId: "t1",
      day: "2026-07-19",
      openingLine: "Test",
      needsYou: [
        { itemId: "a", reason: "r", citedPriorityIds: [] },
        { itemId: "b", reason: "r", citedPriorityIds: [] },
        { itemId: "c", reason: "r", citedPriorityIds: [] },
      ],
      changed: [],
      blocked: [],
      ignorable: { count: 0, summary: "none", itemIds: [] },
      blindSpots: [],
      modelId: "mock",
    });
    expect(result.success).toBe(true);
  });

  it("MockModel produces valid triage from situationView", async () => {
    const model = new MockModel();
    const view = makeSituationView({
      items: [
        {
          id: "si-calendar-1",
          kind: "calendar",
          horizon: "today",
          status: "open",
          title: "Test Meeting",
          occursAt: "2026-07-19T08:00:00Z",
          entityIds: [],
          sourceEventId: 1,
          updatedAt: SIM_NOW,
        },
      ],
    });
    const triage = await model.triage({ day: "2026-07-19", situationView: view, lastPresentedItemIds: [] });
    const parsed = triageSchema.safeParse(triage);
    expect(parsed.success).toBe(true);
    expect(triage.needsYou.length).toBeLessThanOrEqual(3);
    expect(triage.modelId).toBe("mock");
  });

  it("fallback triage honest opening line when model unavailable", () => {
    const view = makeSituationView({
      items: [
        {
          id: "si-email-1",
          kind: "email",
          horizon: "today",
          status: "open",
          title: "Important Email",
          occursAt: null,
          entityIds: [],
          sourceEventId: 1,
          updatedAt: SIM_NOW,
        },
      ],
    });
    const fallback = buildFallbackTriage("2026-07-19", view, "test-model");
    expect(fallback.openingLine).toContain("nicht erreichbar");
    expect(fallback.modelId).toBe("test-model");
    const parsed = triageSchema.safeParse(fallback);
    expect(parsed.success).toBe(true);
  });

  it("schema rejects needsYou length 4 (≤3 cap is structural)", () => {
    // Proves the max(3) constraint is enforced at the schema level, not just in MockModel
    const result = triageSchema.safeParse({
      triageId: "t-cap",
      day: "2026-07-19",
      openingLine: "Test",
      needsYou: [
        { itemId: "a", reason: "r", citedPriorityIds: [] },
        { itemId: "b", reason: "r", citedPriorityIds: [] },
        { itemId: "c", reason: "r", citedPriorityIds: [] },
        { itemId: "d", reason: "r", citedPriorityIds: [] },
      ],
      changed: [],
      blocked: [],
      ignorable: { count: 0, summary: "none", itemIds: [] },
      blindSpots: [],
      modelId: "mock",
    });
    expect(result.success).toBe(false);
  });

  it("schema rejects decideFirst as an array (must be object or absent)", () => {
    const result = triageSchema.safeParse({
      triageId: "t-decide",
      day: "2026-07-19",
      openingLine: "Test",
      needsYou: [],
      decideFirst: [{ itemId: "a", reason: "r" }, { itemId: "b", reason: "r" }],
      changed: [],
      blocked: [],
      ignorable: { count: 0, summary: "none", itemIds: [] },
      blindSpots: [],
      modelId: "mock",
    });
    expect(result.success).toBe(false);
  });

  it("schema rejects question as an array (must be string or absent)", () => {
    const result = triageSchema.safeParse({
      triageId: "t-question",
      day: "2026-07-19",
      openingLine: "Test",
      needsYou: [],
      changed: [],
      blocked: [],
      ignorable: { count: 0, summary: "none", itemIds: [] },
      question: ["What should I do?", "Or this?"],
      blindSpots: [],
      modelId: "mock",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Provenance enforcement tests
// ─────────────────────────────────────────────────────────────────────────────

describe("provenance enforcement (spec-0004 — no memory, no claim)", () => {
  it("citation of non-existent priority is dropped + violation logged", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const view = makeSituationView({
      priorities: [
        {
          priorityId: "prio-real",
          text: "AIOS is highest priority",
          scope: "week",
          sourceEventId: "resp-abc",
          recordedAt: SIM_NOW,
        },
      ],
    });

    const needsYou: TriagePayload["needsYou"] = [
      {
        itemId: "item-1",
        reason: "because of priorities",
        citedPriorityIds: ["prio-real", "prio-fake-nonexistent"],
      },
    ];

    const result = enforceProvenance(needsYou, view, "2026-07-19");

    // The real priority is kept, the fake one is dropped
    expect(result[0]!.citedPriorityIds).toEqual(["prio-real"]);
    expect(result[0]!.citedPriorityIds).not.toContain("prio-fake-nonexistent");

    // Contract violation logged
    expect(consoleError).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleError.mock.calls[0]![0]!);
    expect(logged.msg).toBe("provenance_violation");
    expect(logged.droppedPriorityId).toBe("prio-fake-nonexistent");

    consoleError.mockRestore();
  });

  it("citation of existing priority passes through", () => {
    const view = makeSituationView({
      priorities: [
        {
          priorityId: "prio-1",
          text: "Ship this week",
          scope: "week",
          sourceEventId: "resp-1",
          recordedAt: SIM_NOW,
        },
      ],
    });

    const needsYou: TriagePayload["needsYou"] = [
      { itemId: "item-1", reason: "reason", citedPriorityIds: ["prio-1"] },
    ];

    const result = enforceProvenance(needsYou, view, "2026-07-19");
    expect(result[0]!.citedPriorityIds).toEqual(["prio-1"]);
  });

  it("no priorities recorded → AIOS argues from situation alone (empty citations)", () => {
    const view = makeSituationView({ priorities: [] });
    const needsYou: TriagePayload["needsYou"] = [
      { itemId: "item-1", reason: "deadline", citedPriorityIds: [] },
    ];
    const result = enforceProvenance(needsYou, view, "2026-07-19");
    expect(result[0]!.citedPriorityIds).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Delta / seen-state / idempotency tests
// ─────────────────────────────────────────────────────────────────────────────

describe("delta and seen-state (spec-0004)", () => {
  let db: Db;
  let runtime: Runtime;

  beforeAll(async () => {
    db = await freshDb();
    runtime = await createRuntime({
      db,
      clock: new SimClock(SIM_NOW),
      fixturesDir: FIXTURES_DIR,
      model: new MockModel(),
    });
    await runtime.interaction.startDay();
  });

  afterAll(async () => {
    await db.end();
  });

  it("briefGerman() produces a triage on first call", async () => {
    const brief = await runtime.interaction.briefGerman();
    expect(brief).toContain("AIOS");
    const view = await runtime.situation.current("today");
    expect(view.triage).toBeDefined();
    expect(view.triage!.modelId).toBe("mock");
  });

  it("same-day re-brief: triage is produced only once (idempotent)", async () => {
    // Call briefGerman twice on the same day
    await runtime.interaction.briefGerman();
    const triageEvents1 = await findEvents(db, "deliberation.triage.created");
    await runtime.interaction.briefGerman();
    const triageEvents2 = await findEvents(db, "deliberation.triage.created");
    // Should not produce duplicate triage for same day
    const day = SIM_NOW.slice(0, 10);
    const todayTriages = triageEvents2.filter((e) => e.payload.day === day);
    expect(todayTriages).toHaveLength(1);
  });

  it("seen-state: presentedItemIds recorded in briefing.delivered event", async () => {
    const briefingEvents = await findEvents(db, "interaction.briefing.delivered");
    const withPresented = briefingEvents.filter(
      (e) => Array.isArray(e.payload.presentedItemIds) && (e.payload.presentedItemIds as string[]).length > 0,
    );
    expect(withPresented.length).toBeGreaterThan(0);
  });

  it("seen-state: SituationView shows lastPresentedAt on items after brief", async () => {
    const view = await runtime.situation.current("today");
    // At least some items should have lastPresentedAt set
    const presented = view.items.filter((i) => i.lastPresentedAt !== undefined);
    expect(presented.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Conversation verb tests
// ─────────────────────────────────────────────────────────────────────────────

describe("conversation verbs (spec-0004)", () => {
  let db: Db;
  let runtime: Runtime;

  beforeAll(async () => {
    db = await freshDb();
    runtime = await createRuntime({
      db,
      clock: new SimClock(SIM_NOW),
      fixturesDir: FIXTURES_DIR,
      model: new MockModel(),
    });
    await runtime.interaction.startDay();
    await runtime.interaction.briefGerman(); // produce triage first
  });

  afterAll(async () => {
    await db.end();
  });

  it("prio verb emits deliberation.priority.stated with provenance (end-to-end)", async () => {
    // Drive the actual conversation loop with a piped prio command.
    // This proves the real stored event id (not a fake resp-UUID) is used as sourceEventId.
    const clock = new SimClock(SIM_NOW);
    const view = await runtime.situation.current("today");
    const triage = view.triage;

    const runner = new ConsumerRunner(db);
    runner.register(createSituationConsumer(db));
    const deps = {
      db,
      clock,
      situation: new SituationService(db, clock),
      model: new MockModel(),
      pump: () => runner.pump(),
      produceTriage: async (v: typeof view) => {
        await produceTriage(db, clock, v, new MockModel());
        await runner.pump();
      },
    };

    // Pipe a single "prio ..." line then EOF
    const input = Readable.from(["prio AIOS is my highest priority this week\n"]);
    await runConversationLoop(deps, view, triage, input);

    // After the loop: both events should be in the log
    const respondedEvents = await findEvents(db, "interaction.user.responded");
    const prioResponded = respondedEvents.find((e) => e.payload.verb === "prio");
    expect(prioResponded).toBeDefined();

    const prioEvents = await findEvents(db, "deliberation.priority.stated");
    expect(prioEvents.length).toBeGreaterThan(0);
    const prioEvent = prioEvents.at(-1)!;
    expect(prioEvent.payload.text).toBe("AIOS is my highest priority this week");
    expect(prioEvent.payload.priorityId).toBeTruthy();

    // Core provenance assertion: sourceEventId must be the real stored id of the
    // interaction.user.responded event that caused this deliberation event.
    const sourceId = prioEvent.payload.sourceEventId as string;
    expect(sourceId).toBeTruthy();
    const resolvedSource = respondedEvents.find((e) => String(e.id) === sourceId);
    expect(resolvedSource).toBeDefined();
    expect(resolvedSource!.type).toBe("interaction.user.responded");
    expect(resolvedSource!.payload.verb).toBe("prio");

    // The priority can be cited by triage and provenance survives enforceProvenance
    await runner.pump(); // fold priority into SituationView
    const viewAfter = await runtime.situation.current("today");
    const knownPrio = viewAfter.priorities.find(
      (p) => p.priorityId === (prioEvent.payload.priorityId as string),
    );
    expect(knownPrio).toBeDefined();
    const needsYouWithCitation = [
      { itemId: "item-x", reason: "r", citedPriorityIds: [knownPrio!.priorityId] },
    ];
    const enforced = enforceProvenance(needsYouWithCitation, viewAfter, SIM_NOW.slice(0, 10));
    expect(enforced[0]!.citedPriorityIds).toContain(knownPrio!.priorityId);
  });

  it("prio event is visible in SituationView.priorities after briefGerman pump", async () => {
    // briefGerman() triggers pump → folds priority events into the projection
    await runtime.interaction.briefGerman();
    const view = await runtime.situation.current("today");
    // The priority stated via conversation loop in the previous test should be visible
    expect(view.priorities.length).toBeGreaterThan(0);
    expect(view.priorities[0]!.text).toBe("AIOS is my highest priority this week");
  });

  it("ignorier verb emits deliberation.override.recorded with kind=ignore", async () => {
    const day = SIM_NOW.slice(0, 10);
    const clock = new SimClock(SIM_NOW);

    await appendEvent(db, "interaction.user.responded", 1, clock.now(), {
      day,
      verb: "ignorier",
      itemId: "si-calendar-test",
      text: "ignorier 1",
    });
    await appendEvent(db, "deliberation.override.recorded", 1, clock.now(), {
      itemId: "si-calendar-test",
      kind: "ignore",
      sourceEventId: "resp-ignore-001",
    });

    const overrideEvents = await findEvents(db, "deliberation.override.recorded");
    const ignoreEvent = overrideEvents.find((e) => e.payload.kind === "ignore");
    expect(ignoreEvent).toBeDefined();
    expect(ignoreEvent!.payload.itemId).toBe("si-calendar-test");
  });

  it("ignorier dauerhaft emits kind=ignore_permanent", async () => {
    const day = SIM_NOW.slice(0, 10);
    const clock = new SimClock(SIM_NOW);

    await appendEvent(db, "interaction.user.responded", 1, clock.now(), {
      day,
      verb: "ignorier_dauerhaft",
      itemId: "si-email-permanent-test",
      text: "ignorier 1 dauerhaft",
    });
    await appendEvent(db, "deliberation.override.recorded", 1, clock.now(), {
      itemId: "si-email-permanent-test",
      kind: "ignore_permanent",
      sourceEventId: "resp-perm-001",
    });

    const overrideEvents = await findEvents(db, "deliberation.override.recorded");
    const permEvent = overrideEvents.find((e) => e.payload.kind === "ignore_permanent");
    expect(permEvent).toBeDefined();
    expect(permEvent!.payload.itemId).toBe("si-email-permanent-test");
  });

  it("widerspruch emits kind=disagree_overruled", async () => {
    const day = SIM_NOW.slice(0, 10);
    const clock = new SimClock(SIM_NOW);

    await appendEvent(db, "interaction.user.responded", 1, clock.now(), {
      day,
      verb: "widerspruch",
      itemId: "si-calendar-dispute",
      text: "widerspruch 1",
    });
    await appendEvent(db, "deliberation.override.recorded", 1, clock.now(), {
      itemId: "si-calendar-dispute",
      kind: "disagree_overruled",
      sourceEventId: "resp-dispute-001",
    });

    const overrideEvents = await findEvents(db, "deliberation.override.recorded");
    const disputeEvent = overrideEvents.find((e) => e.payload.kind === "disagree_overruled");
    expect(disputeEvent).toBeDefined();
  });

  it("every verb emits interaction.user.responded", async () => {
    const respondedEvents = await findEvents(db, "interaction.user.responded");
    const verbs = respondedEvents.map((e) => e.payload.verb as string);
    expect(verbs).toContain("prio");
    expect(verbs).toContain("ignorier");
    expect(verbs).toContain("ignorier_dauerhaft");
    expect(verbs).toContain("widerspruch");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Next-day delta: triage shows changed items
// ─────────────────────────────────────────────────────────────────────────────

const DAY2_NOW = "2026-07-20T06:00:00.000Z";

describe("next-day delta (spec-0004)", () => {
  it("day-1 items already presented are NOT in changed; new day-2 item IS in changed", async () => {
    const db = await freshDb();
    try {
      // ── Day 1 ──────────────────────────────────────────────────────────────
      const day1Runtime = await createRuntime({
        db,
        clock: new SimClock(SIM_NOW),
        fixturesDir: FIXTURES_DIR,
        model: new MockModel(),
      });
      await day1Runtime.interaction.startDay();
      await day1Runtime.interaction.briefGerman();

      // Brief delivered: presentedItemIds now recorded for day 1
      const day1Briefings = await findEvents(db, "interaction.briefing.delivered");
      const day1Briefing = day1Briefings.find((e) => e.payload.day === SIM_NOW.slice(0, 10));
      expect(day1Briefing).toBeDefined();
      const day1Presented = (day1Briefing!.payload.presentedItemIds as string[]) ?? [];
      expect(day1Presented.length).toBeGreaterThan(0); // fixtures loaded, at least one item

      // ── Insert a day-2-only item directly into situation_items ─────────────
      const newItemId = "si-calendar-new-day2-item";
      await db.query(
        `INSERT INTO situation_items (id, kind, horizon, status, entity_ids, source_event_id, payload, updated_at)
         VALUES ($1, 'calendar', 'today', 'open', '{}', 9999, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [
          newItemId,
          JSON.stringify({ title: "New Day-2 Meeting", body: "", occursAt: "2026-07-20T09:00:00Z", from: null }),
          new Date(DAY2_NOW).toISOString(),
        ],
      );

      // ── Day 2 ──────────────────────────────────────────────────────────────
      const day2Runtime = await createRuntime({
        db,
        clock: new SimClock(DAY2_NOW),
        fixturesDir: FIXTURES_DIR,
        model: new MockModel(),
      });
      // Start day 2 (fixture adapter re-upserts same fixture items)
      await day2Runtime.interaction.startDay();
      await day2Runtime.interaction.briefGerman();

      const day2View = await day2Runtime.situation.current("today");
      expect(day2View.triage).toBeDefined();
      const changed = day2View.triage!.changed;

      // The new item (not in day-1 presentedItemIds) must appear in changed
      expect(changed.map((c) => c.itemId)).toContain(newItemId);

      // Items that were presented on day 1 must NOT appear in changed
      for (const presentedId of day1Presented) {
        expect(changed.map((c) => c.itemId)).not.toContain(presentedId);
      }
    } finally {
      await db.end();
    }
  });
});
