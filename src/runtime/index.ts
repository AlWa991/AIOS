/**
 * Composition root — the ONLY module that wires contexts together.
 * Apps depend on this factory plus the Situation/Interaction contracts.
 */
import path from "node:path";
import { createPool, databaseUrlFromEnv, type Db } from "../platform/db/pool.js";
import { migrateUp } from "../platform/db/migrate.js";
import { clockFromEnv, type Clock } from "../platform/scheduler/clock.js";
import { ConsumerRunner } from "../platform/events/consumers.js";
import { createModelFromEnv } from "../platform/model/factory.js";
import { createPerceptionConsumer } from "../contexts/perception/index.js";
import { createIdentityConsumer } from "../contexts/identity/index.js";
import { createMemoryConsumer } from "../contexts/memory/index.js";
import { createSituationConsumer, SituationService } from "../contexts/situation/index.js";
import { createDeliberationConsumer, produceTriage } from "../contexts/deliberation/index.js";
import { createExecutionConsumer } from "../contexts/execution/index.js";
import { InteractionService } from "../contexts/interaction/index.js";
import type { Situation } from "../contracts/situation.js";
import type { Interaction } from "../contracts/interaction.js";
import type { ModelPort } from "../contracts/model.js";
import type { SituationView } from "../contracts/situation.js";

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
  /** ICS subscription URL (AIOS_CALENDAR_ICS_URL). Set → real calendar adapter. */
  calendarIcsUrl?: string;
  /** Directory of RFC 822 .eml files (AIOS_EMAIL_EML_DIR). Set → real email adapter. */
  emailEmlDir?: string;
  /** Optional override model (for tests). Default: createModelFromEnv(). */
  model?: ModelPort;
};

export async function createRuntime(opts: RuntimeOptions = {}): Promise<Runtime> {
  const databaseUrl = opts.databaseUrl ?? databaseUrlFromEnv(process.env);
  if (!opts.db) await migrateUp(databaseUrl);
  const db = opts.db ?? createPool(databaseUrl);
  const clock = opts.clock ?? clockFromEnv(process.env);
  const fixturesDir = opts.fixturesDir ?? path.join(process.cwd(), "fixtures");
  const calendarIcsUrl = opts.calendarIcsUrl ?? process.env.AIOS_CALENDAR_ICS_URL;
  const emailEmlDir = opts.emailEmlDir ?? process.env.AIOS_EMAIL_EML_DIR;
  const model = opts.model ?? createModelFromEnv(process.env);

  const runner = new ConsumerRunner(db);
  runner.register(createPerceptionConsumer(db, clock, { fixturesDir, calendarIcsUrl, emailEmlDir }));
  runner.register(createIdentityConsumer(db, clock));
  runner.register(createMemoryConsumer(db, clock));
  runner.register(createSituationConsumer(db));
  runner.register(createDeliberationConsumer(db, clock, fixturesDir));
  runner.register(createExecutionConsumer(db, clock));

  const situation = new SituationService(db, clock);

  // Wire produceTriage as a closure (avoids cross-context import from Interaction)
  const produceTriageFn = async (view: SituationView): Promise<void> => {
    await produceTriage(db, clock, view, model);
    await runner.pump(); // fold triage event into Situation
  };

  const interaction = new InteractionService({
    db,
    clock,
    situation,
    model,
    pump: () => runner.pump(),
    produceTriage: produceTriageFn,
  });

  return {
    situation,
    interaction,
    close: async () => {
      if (!opts.db) await db.end();
    },
  };
}
