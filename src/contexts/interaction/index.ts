import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { dayOf } from "../../platform/scheduler/clock.js";
import { appendEvent } from "../../platform/events/event-log.js";
import type { Interaction } from "../../contracts/interaction.js";
import type { Situation, SituationView } from "../../contracts/situation.js";
import type { ModelPort } from "../../contracts/model.js";

type Deps = {
  db: Db;
  clock: Clock;
  situation: Situation;
  model: ModelPort;
  pump: () => Promise<void>;
};

export class InteractionService implements Interaction {
  constructor(private readonly deps: Deps) {}

  async startDay(): Promise<void> {
    const { db, clock, pump } = this.deps;
    await appendEvent(db, "time.day.started", 1, clock.now(), { day: dayOf(clock.now()) });
    await pump();
  }

  async brief(): Promise<string> {
    const { db, clock, situation, model } = this.deps;
    const view = await situation.current("today");
    const markdown = await renderBriefing(view, model);
    await appendEvent(db, "interaction.briefing.delivered", 1, clock.now(), {
      day: view.asOf.slice(0, 10),
      horizon: "today",
      recommendationCount: view.recommendations.length,
    });
    return markdown;
  }

  async approve(recommendationId: string): Promise<string> {
    const { db, clock, situation, pump } = this.deps;
    await appendEvent(db, "deliberation.approval.granted", 1, clock.now(), { recommendationId });
    await pump();
    const view = await situation.current("today");
    const completion = view.completions.find((c) => c.recommendationId === recommendationId);
    return completion
      ? `Approved ${recommendationId} — ${completion.detail}`
      : `Approved ${recommendationId} — no executable action attached`;
  }
}

/** Pure presentation: renders ONLY from the SituationView (ADR-0017). */
export async function renderBriefing(view: SituationView, model: ModelPort): Promise<string> {
  const day = view.asOf.slice(0, 10);
  const intro = await model.complete({
    intent: "briefing.intro",
    input: {
      day,
      itemCount: view.items.length,
      recommendationCount: view.recommendations.length,
    },
  });

  const lines: string[] = [];
  lines.push(`# Morning Briefing — ${day}`);
  lines.push("");
  lines.push(intro.text);
  lines.push("");
  lines.push("## Today");
  for (const item of view.items) {
    const time = item.occursAt ? `${item.occursAt.slice(11, 16)} UTC — ` : "";
    lines.push(`- ${time}[${item.kind}] ${item.title} (${item.status})`);
  }
  lines.push("");
  lines.push("## Recommendations");
  let n = 0;
  for (const rec of view.recommendations) {
    n++;
    lines.push(`${n}. \`${rec.id}\` ${rec.rationale} — goals: ${rec.goalIds.join(", ")} [${rec.status}]`);
  }
  if (view.coverage.length > 0) {
    lines.push("");
    lines.push("## Coverage gaps");
    for (const c of view.coverage) {
      lines.push(`- ${c.note}`);
    }
  }
  if (view.completions.length > 0) {
    lines.push("");
    lines.push("## Completed");
    for (const c of view.completions) {
      lines.push(`- \`${c.recommendationId}\` ${c.detail}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
