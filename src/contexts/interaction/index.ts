import * as readline from "node:readline";
import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { dayOf, parseIso } from "../../platform/scheduler/clock.js";
import { appendEvent } from "../../platform/events/event-log.js";
import type { Interaction } from "../../contracts/interaction.js";
import type { Situation, SituationView } from "../../contracts/situation.js";
import type { ModelPort } from "../../contracts/model.js";
import type { TriagePayload } from "../../contracts/deliberation.js";
import { randomUUID } from "node:crypto";

type Deps = {
  db: Db;
  clock: Clock;
  situation: Situation;
  model: ModelPort;
  pump: () => Promise<void>;
  /** spec-0004: injected from runtime to avoid cross-context import */
  produceTriage: (view: SituationView) => Promise<void>;
};

export class InteractionService implements Interaction {
  private lastView: SituationView | undefined;
  private lastTriage: TriagePayload | undefined;

  constructor(private readonly deps: Deps) {}

  async startDay(): Promise<void> {
    const { db, clock, pump } = this.deps;
    await appendEvent(db, "time.day.started", 1, clock.now(), { day: dayOf(clock.now()) });
    await pump();
  }

  /** Legacy English briefing — spec-0001 format. Kept for backward compat with skeleton tests. */
  async brief(): Promise<string> {
    const { db, clock, situation, model, pump } = this.deps;
    const view = await situation.current("today");
    const markdown = await renderBriefing(view, model);
    await appendEvent(db, "interaction.briefing.delivered", 1, clock.now(), {
      day: view.asOf.slice(0, 10),
      horizon: "today",
      recommendationCount: view.recommendations.length,
    });
    return markdown;
  }

  /**
   * spec-0004: German morning briefing with triage, seen-state, and conversation loop.
   * This is the production morning experience. The CLI uses this.
   */
  async briefGerman(): Promise<string> {
    const { db, clock, situation, pump, produceTriage } = this.deps;

    // 1. Produce triage if not yet done today (idempotent inside produceTriage).
    //    The produceTriage closure already pumps internally, so we don't need to.
    const viewBeforeTriage = await situation.current("today");
    await produceTriage(viewBeforeTriage);

    // 2. Read fresh view with triage folded in
    const view = await situation.current("today");
    const triage = view.triage;

    // Store for subsequent runConversation() call
    this.lastView = view;
    this.lastTriage = triage;

    // 3. Render German briefing from SituationView (ADR-0017)
    const markdown = renderBriefingGerman(view, triage);

    // 4. Record presented item IDs for seen-state / delta
    const presentedItemIds = view.items.map((i) => i.id);
    const day = view.asOf.slice(0, 10);
    await appendEvent(db, "interaction.briefing.delivered", 1, clock.now(), {
      day,
      horizon: "today",
      recommendationCount: view.recommendations.length,
      presentedItemIds,
    });
    await pump(); // fold seen-state into situation

    return markdown;
  }

  /** spec-0004: Interactive conversation loop — call after briefGerman(). */
  async runConversation(): Promise<void> {
    const view = this.lastView ?? (await this.deps.situation.current("today"));
    const triage = this.lastTriage ?? view.triage;
    await runConversationLoop(this.deps, view, triage);
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

/**
 * German briefing renderer — reads ONLY from SituationView (ADR-0017).
 * Layout follows experience doc §2 exactly.
 */
export function renderBriefingGerman(view: SituationView, triage: TriagePayload | undefined): string {
  const day = view.asOf.slice(0, 10);
  const lines: string[] = [];

  // Header
  lines.push(`**AIOS — ${formatGermanDate(day)}**`);
  lines.push("");

  if (!triage) {
    lines.push("Triage wird vorbereitet...");
    lines.push("");
    lines.push("*Womit fängst du an?*");
    return lines.join("\n");
  }

  // Opening line
  lines.push(triage.openingLine);
  lines.push("");

  // Braucht dich heute (Needs you — provenance-enforced)
  const validatedNeedsYou = enforceProvenance(triage.needsYou, view, day);
  if (validatedNeedsYou.length > 0) {
    lines.push(`**Braucht dich heute (${validatedNeedsYou.length})**`);
    validatedNeedsYou.forEach((item, idx) => {
      const si = view.items.find((i) => i.id === item.itemId);
      const title = si?.title ?? item.itemId;
      lines.push(`${idx + 1}. **${title}** — ${item.reason}`);
      if (item.citedPriorityIds.length > 0) {
        const prios = item.citedPriorityIds
          .map((pid) => view.priorities.find((p) => p.priorityId === pid)?.text)
          .filter(Boolean)
          .map((t) => `„${t}"`)
          .join(", ");
        if (prios) lines.push(`   *(Priorität: ${prios})*`);
      }
    });
    lines.push("");
  }

  // Entscheide zuerst (Decide first)
  if (triage.decideFirst) {
    const si = view.items.find((i) => i.id === triage.decideFirst!.itemId);
    const title = si?.title ?? triage.decideFirst.itemId;
    lines.push(`**Entscheide zuerst:** ${title} — ${triage.decideFirst.reason}`);
    lines.push("");
  }

  // Verändert seit gestern (Changed since yesterday)
  if (triage.changed.length > 0) {
    const changeList = triage.changed
      .map((c) => {
        const si = view.items.find((i) => i.id === c.itemId);
        return `${si?.title ?? c.itemId}: ${c.change}`;
      })
      .join(" · ");
    lines.push(`**Verändert seit gestern (${triage.changed.length}):** ${changeList}`);
    lines.push("");
  }

  // Blockiert (Blocked)
  const notYourMove = triage.blocked.filter((b) => b.whoseMove === "not_your_move");
  const yourMove = triage.blocked.filter((b) => b.whoseMove === "your_move");
  if (notYourMove.length > 0 || yourMove.length > 0) {
    const blockedCount = notYourMove.length + yourMove.length;
    lines.push(`**Blockiert (${blockedCount}):**`);
    for (const b of notYourMove) {
      const si = view.items.find((i) => i.id === b.itemId);
      lines.push(`- ${si?.title ?? b.itemId} — nicht dein Zug.`);
    }
    for (const b of yourMove) {
      const si = view.items.find((i) => i.id === b.itemId);
      lines.push(`- ${si?.title ?? b.itemId} — wartet auf dich.`);
    }
    lines.push("");
  }

  // Beobachte ich für dich (Ignorable — collapsed by default)
  if (triage.ignorable.count > 0) {
    lines.push(
      `**Beobachte ich für dich (${triage.ignorable.count}):** ${triage.ignorable.summary} [zeigen]`,
    );
    lines.push("");
  }

  // Was ich nicht sehe (Blind spots — permanent per experience doc)
  if (triage.blindSpots.length > 0) {
    lines.push(`**Was ich nicht sehe:** ${triage.blindSpots.join(" ")}`);
    lines.push("");
  }

  // Disagreement — stated once with impact comparison
  if (triage.disagreement) {
    const si = view.items.find((i) => i.id === triage.disagreement!.itemId);
    const title = si?.title ?? triage.disagreement.itemId;
    lines.push(
      `*Ich würde ${title} anders einordnen — ${triage.disagreement.recommendation} ${triage.disagreement.impactComparison}*`,
    );
    lines.push("");
  }

  // Closing question (the one question per morning)
  lines.push(`*${triage.question ?? "Womit fängst du an?"}*`);

  return lines.join("\n");
}

/**
 * Provenance enforcement — "no memory, no claim" (ADR-0014 + experience doc).
 * Drops any citation whose priorityId does not resolve to a recorded priority event.
 * Logs a structured contract violation for each dropped citation.
 */
export function enforceProvenance(
  needsYou: TriagePayload["needsYou"],
  view: SituationView,
  day: string,
): TriagePayload["needsYou"] {
  const knownPriorityIds = new Set(view.priorities.map((p) => p.priorityId));
  return needsYou.map((item) => {
    const validCitedPriorityIds: string[] = [];
    for (const pid of item.citedPriorityIds) {
      if (knownPriorityIds.has(pid)) {
        validCitedPriorityIds.push(pid);
      } else {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "provenance_violation",
            contract: "no-memory-no-claim",
            itemId: item.itemId,
            droppedPriorityId: pid,
            day,
          }),
        );
      }
    }
    return { ...item, citedPriorityIds: validCitedPriorityIds };
  });
}

/** Format ISO date (YYYY-MM-DD) as German weekday + date. */
export function formatGermanDate(day: string): string {
  // parseIso is the only allowed way to construct Date from strings outside platform
  const date = parseIso(`${day}T12:00:00Z`);
  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  const wd = weekdays[date.getUTCDay()];
  const d = date.getUTCDate();
  const m = months[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return `${wd}, ${d}. ${m} ${y}`;
}

/**
 * Interactive conversation loop for `aios brief`.
 * Each user response emits interaction.user.responded.
 * Verb handlers emit the appropriate deliberation events.
 */
export async function runConversationLoop(
  deps: Deps,
  view: SituationView,
  triage: TriagePayload | undefined,
  inputStream?: NodeJS.ReadableStream,
): Promise<void> {
  const { db, clock, pump } = deps;
  const day = view.asOf.slice(0, 10);

  const rl = readline.createInterface({
    input: inputStream ?? process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const needsYou = triage?.needsYou ?? [];
  let disagreementStated = false;

  /** Appends interaction.user.responded, pumps, and returns the real stored event id. */
  const responded = async (verb: string, itemId?: string, text?: string): Promise<string> => {
    const stored = await appendEvent(db, "interaction.user.responded", 1, clock.now(), {
      day,
      verb,
      ...(itemId !== undefined && { itemId }),
      ...(text !== undefined && { text }),
    });
    await pump();
    return String(stored.id);
  };

  for await (const line of rl) {
    const input = line.trim();
    if (!input) continue;
    if (input === "exit" || input === "quit" || input === "bye") break;

    const warum = input.match(/^warum\s+(\d+)$/i);
    const mehr = input.match(/^mehr\s+(\d+)$/i);
    const ignorierDauerhaft = input.match(/^ignorier\s+(\d+)\s+dauerhaft$/i);
    const ignorier = !ignorierDauerhaft && input.match(/^ignorier\s+(\d+)$/i);
    const wichtiger = input.match(/^wichtiger\s+(\d+)$/i);
    const prioMatch = input.match(/^prio\s+(.+)$/i);
    const widerspruch = input.match(/^widerspruch\s+(\d+)$/i);
    const zeigIgnorierte = input.match(/^zeig\s+ignorierte$/i);
    const startN = input.match(/^start\s+(\d+)$/i);

    if (warum) {
      const n = parseInt(warum[1]!) - 1;
      const item = needsYou[n];
      if (!item) { process.stdout.write(`(Punkt ${warum[1]!} nicht gefunden)\n`); continue; }
      const si = view.items.find((i) => i.id === item.itemId);
      await responded("warum", item.itemId, input);
      process.stdout.write(`${si?.title ?? item.itemId}:\n${item.reason}\n`);
      if (item.citedPriorityIds.length > 0) {
        const prios = item.citedPriorityIds
          .map((pid) => view.priorities.find((p) => p.priorityId === pid)?.text)
          .filter(Boolean)
          .join(", ");
        if (prios) process.stdout.write(`Basiert auf: „${prios}"\n`);
      }
    } else if (mehr) {
      const n = parseInt(mehr[1]!) - 1;
      const item = needsYou[n];
      if (!item) { process.stdout.write(`(Punkt ${mehr[1]!} nicht gefunden)\n`); continue; }
      const si = view.items.find((i) => i.id === item.itemId);
      await responded("mehr", item.itemId, input);
      process.stdout.write(
        `**${si?.title ?? item.itemId}**\n${si?.kind ?? "?"} — ${si?.status ?? "?"}\n${si?.occursAt ? `Zeit: ${si.occursAt}\n` : ""}${item.reason}\n`,
      );
    } else if (ignorierDauerhaft) {
      const n = parseInt(ignorierDauerhaft[1]!) - 1;
      const item = needsYou[n];
      if (!item) { process.stdout.write(`(Punkt ${ignorierDauerhaft[1]!} nicht gefunden)\n`); continue; }
      const responseId = await responded("ignorier_dauerhaft", item.itemId, input);
      await appendEvent(db, "deliberation.override.recorded", 1, clock.now(), {
        itemId: item.itemId,
        kind: "ignore_permanent",
        sourceEventId: responseId,
      });
      await pump();
      process.stdout.write(`(dauerhaft ignoriert)\n`);
    } else if (ignorier) {
      const n = parseInt(ignorier[1]!) - 1;
      const item = needsYou[n];
      if (!item) { process.stdout.write(`(Punkt ${ignorier[1]!} nicht gefunden)\n`); continue; }
      const responseId = await responded("ignorier", item.itemId, input);
      await appendEvent(db, "deliberation.override.recorded", 1, clock.now(), {
        itemId: item.itemId,
        kind: "ignore",
        sourceEventId: responseId,
      });
      await pump();
      process.stdout.write(`(ignoriert für heute)\n`);
    } else if (wichtiger) {
      const n = parseInt(wichtiger[1]!) - 1;
      const item = needsYou[n];
      if (!item) { process.stdout.write(`(Punkt ${wichtiger[1]!} nicht gefunden)\n`); continue; }
      const responseId = await responded("wichtiger", item.itemId, input);
      await appendEvent(db, "deliberation.override.recorded", 1, clock.now(), {
        itemId: item.itemId,
        kind: "promote",
        sourceEventId: responseId,
      });
      await pump();
      process.stdout.write(`(Priorität erhöht)\n`);
    } else if (prioMatch) {
      const text = (prioMatch[1]!).trim();
      const priorityId = `prio-${randomUUID().slice(0, 8)}`;
      const responseId = await responded("prio", undefined, text);
      await appendEvent(db, "deliberation.priority.stated", 1, clock.now(), {
        priorityId,
        text,
        scope: "week",
        sourceEventId: responseId,
      });
      await pump();
      process.stdout.write(`(Priorität: „${text}")\n`);
    } else if (widerspruch) {
      const n = parseInt(widerspruch[1]!) - 1;
      const item = needsYou[n];
      if (!item) { process.stdout.write(`(Punkt ${widerspruch[1]!} nicht gefunden)\n`); continue; }
      const responseId = await responded("widerspruch", item.itemId, input);
      if (triage?.disagreement && !disagreementStated) {
        disagreementStated = true;
        process.stdout.write(
          `${triage.disagreement.recommendation} — ${triage.disagreement.impactComparison}\nDu entscheidest.\n`,
        );
        await appendEvent(db, "deliberation.override.recorded", 1, clock.now(), {
          itemId: item.itemId,
          kind: "disagree_overruled",
          sourceEventId: responseId,
        });
        await pump();
      } else {
        process.stdout.write(`(Bereits notiert)\n`);
      }
    } else if (zeigIgnorierte) {
      await responded("zeig_ignorierte", undefined, input);
      if (triage?.ignorable.itemIds.length) {
        process.stdout.write("Beobachtete Items:\n");
        for (const id of triage.ignorable.itemIds) {
          const si = view.items.find((i) => i.id === id);
          process.stdout.write(`- ${si?.title ?? id}\n`);
        }
      } else {
        process.stdout.write("(Keine weiteren Items)\n");
      }
    } else if (startN) {
      const n = parseInt(startN[1]!) - 1;
      const item = needsYou[n];
      if (!item) { process.stdout.write(`(Punkt ${startN[1]!} nicht gefunden)\n`); continue; }
      const si = view.items.find((i) => i.id === item.itemId);
      await responded("start", item.itemId, input);
      process.stdout.write(`Starte: **${si?.title ?? item.itemId}**\n${item.reason}\n`);
      break; // Context handoff — exit loop
    } else {
      // Free-text answer to the daily question or open dialogue
      await responded("antwort", undefined, input);
      process.stdout.write(`(Antwort notiert)\n`);
    }
  }

  rl.close();
}

/**
 * Legacy English renderer — kept for backward compatibility with existing golden tests.
 * spec-0001 format; called directly by tests, not by the production brief() flow.
 */
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
