import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { appendEvent, findEvents, type StoredEvent } from "../../platform/events/event-log.js";
import type { Consumer } from "../../platform/events/consumers.js";
import type { ActionRequest, ActionResult, Execution } from "../../contracts/execution.js";

interface ActionAdapter {
  run(payload: unknown): Promise<string>;
}

/** Deterministic mock adapter — drafts an email, sends nothing. */
export class MockEmailDraftAdapter implements ActionAdapter {
  async run(payload: unknown): Promise<string> {
    const p = payload as { to?: string; subject?: string };
    return `Email draft created for ${p.to ?? "unknown"}: "${p.subject ?? "(no subject)"}"`;
  }
}

const ADAPTERS: Record<string, ActionAdapter> = {
  "email.draft": new MockEmailDraftAdapter(),
};

/** ActionGate: reversibility check (ADR-0012) before any adapter runs. */
export class ExecutionService implements Execution {
  async request(a: ActionRequest): Promise<ActionResult> {
    if (a.reversibility === "irreversible") {
      return { status: "rejected", detail: "ActionGate: irreversible actions require explicit human execution" };
    }
    const adapter = ADAPTERS[a.adapter];
    if (!adapter) {
      return { status: "rejected", detail: `ActionGate: unknown adapter "${a.adapter}"` };
    }
    const detail = await adapter.run(a.payload);
    return { status: "completed", detail };
  }
}

export function createExecutionConsumer(db: Db, clock: Clock): Consumer {
  const service = new ExecutionService();
  return {
    name: "execution",
    async handle(event: StoredEvent): Promise<void> {
      if (event.type !== "deliberation.approval.granted") return;
      const recId = event.payload.recommendationId as string;

      const done = await findEvents(db, "execution.action.completed");
      if (done.some((e) => e.payload.recommendationId === recId)) return; // idempotent

      const recs = await findEvents(db, "deliberation.recommendation.created");
      const rec = recs.find((e) => e.payload.recommendationId === recId);
      if (!rec || !rec.payload.action) return; // nothing executable attached

      const result = await service.request(rec.payload.action as ActionRequest);
      await appendEvent(db, "execution.action.completed", 1, clock.now(), {
        recommendationId: recId,
        adapter: (rec.payload.action as ActionRequest).adapter,
        status: result.status,
        detail: result.detail,
      });
    },
  };
}
