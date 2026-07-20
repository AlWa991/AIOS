import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRuntime, type Runtime } from "../src/runtime/index.js";
import { SimClock } from "../src/platform/scheduler/clock.js";
import { rebuildSituation } from "../src/contexts/situation/index.js";
import { rebuildGoals } from "../src/contexts/deliberation/index.js";
import { buildServer } from "../src/apps/dashboard/server.js";
import type { Db } from "../src/platform/db/pool.js";
import { freshDb, SIM_NOW } from "./helpers.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));

const GOLDEN = path.join(DIR, "golden", "briefing.md");

let db: Db;
let runtime: Runtime;

beforeAll(async () => {
  db = await freshDb();
  runtime = await createRuntime({
    db,
    clock: new SimClock(SIM_NOW),
    fixturesDir: path.join(DIR, "..", "fixtures"),
  });
  await runtime.interaction.startDay();
});

afterAll(async () => {
  await db.end();
});

describe("walking skeleton (spec-0001)", () => {
  it("golden: fixtures render the committed Morning Briefing", async () => {
    const brief = await runtime.interaction.brief();
    expect(brief).toBe(readFileSync(GOLDEN, "utf8"));
  });

  it("golden: three recommendations, each citing at least one goal", async () => {
    const view = await runtime.situation.current("today");
    expect(view.recommendations).toHaveLength(3);
    for (const rec of view.recommendations) {
      expect(rec.goalIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("same-model: dashboard JSON deep-equals the briefing's SituationView", async () => {
    const view = await runtime.situation.current("today");
    const app = await buildServer(runtime.situation);
    const res = await app.inject({ method: "GET", url: "/situation?horizon=today" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(JSON.parse(JSON.stringify(view)));
    await app.close();
  });

  it("execution path: approve -> mock adapter -> completion in next brief", async () => {
    const before = await runtime.situation.current("today");
    const target = before.recommendations.find((r) => r.status === "open" && r.id === "rec-2");
    expect(target).toBeDefined();

    const confirmation = await runtime.interaction.approve("rec-2");
    expect(confirmation).toContain("Email draft created");

    const after = await runtime.situation.current("today");
    expect(after.recommendations.find((r) => r.id === "rec-2")?.status).toBe("done");
    expect(after.completions).toHaveLength(1);

    const brief = await runtime.interaction.brief();
    expect(brief).toContain("## Completed");
    expect(brief).toContain("rec-2");
    expect(brief).toContain("Email draft created");
  });

  it("replay: truncate projections + replay event log -> identical rows", async () => {
    const snapshot = async () => ({
      items: (await db.query(`SELECT * FROM situation_items ORDER BY id`)).rows,
      goals: (await db.query(`SELECT * FROM goals_current ORDER BY id`)).rows,
    });

    const before = await snapshot();
    expect(before.items.length).toBeGreaterThan(0);
    expect(before.goals.length).toBe(3);

    await db.query(`TRUNCATE situation_items, goals_current`);
    await rebuildSituation(db);
    await rebuildGoals(db);

    const after = await snapshot();
    expect(after).toEqual(before);
  });
});
