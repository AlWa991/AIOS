/**
 * Composition root — the ONLY module that wires contexts together.
 * Apps depend on this factory plus the Situation/Interaction contracts.
 */
import path from "node:path";
import { createPool, databaseUrlFromEnv, type Db } from "../platform/db/pool.js";
import { migrateUp } from "../platform/db/migrate.js";
import { clockFromEnv, type Clock } from "../platform/scheduler/clock.js";
import { ConsumerRunner } from "../platform/events/consumers.js";
import { MockModel } from "../platform/model/mock-model.js";
import { createPerceptionConsumer } from "../contexts/perception/index.js";
import { createIdentityConsumer } from "../contexts/identity/index.js";
import { createMemoryConsumer } from "../contexts/memory/index.js";
import { createSituationConsumer, SituationService } from "../contexts/situation/index.js";
import { createDeliberationConsumer } from "../contexts/deliberation/index.js";
import { createExecutionConsumer } from "../contexts/execution/index.js";
import { InteractionService } from "../contexts/interaction/index.js";
import type { Situation } from "../contracts/situation.js";
import type { Interaction } from "../contracts/interaction.js";

export type Runtime = {
  situation: Situation;
  interaction: Interaction;
  close(): Promise<void>;
};

export type RuntimeOptions = {
  databaseUrl?: string;
  clock?: Clock;
  fixturesDir?: string;
  db?: Db;
};

export async function createRuntime(opts: RuntimeOptions = {}): Promise<Runtime> {
  const databaseUrl = opts.databaseUrl ?? databaseUrlFromEnv(process.env);
  if (!opts.db) await migrateUp(databaseUrl);
  const db = opts.db ?? createPool(databaseUrl);
  const clock = opts.clock ?? clockFromEnv(process.env);
  const fixturesDir = opts.fixturesDir ?? path.join(process.cwd(), "fixtures");

  const runner = new ConsumerRunner(db);
  runner.register(createPerceptionConsumer(db, clock, fixturesDir));
  runner.register(createIdentityConsumer(db, clock));
  runner.register(createMemoryConsumer(db, clock));
  runner.register(createSituationConsumer(db));
  runner.register(createDeliberationConsumer(db, clock, fixturesDir));
  runner.register(createExecutionConsumer(db, clock));

  const situation = new SituationService(db, clock);
  const interaction = new InteractionService({
    db,
    clock,
    situation,
    model: new MockModel(),
    pump: () => runner.pump(),
  });

  return {
    situation,
    interaction,
    close: async () => {
      if (!opts.db) await db.end();
    },
  };
}
