/**
 * Anthropic adapter behind the MAL seam — spec-0004.
 * Selected via AIOS_MODEL=anthropic:<model-id> + ANTHROPIC_API_KEY.
 * Validates output against triage schema; one retry on invalid; then deterministic fallback.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { eventSchemas } from "../../contracts/events/registry.js";
import type { ModelPort, ModelRequest, ModelResponse, TriageRequest } from "../../contracts/model.js";
import type { TriagePayload } from "../../contracts/deliberation.js";
import type { SituationView } from "../../contracts/situation.js";

const triageSchema = eventSchemas["deliberation.triage.created@1"];
type TriageEvent = z.infer<typeof triageSchema>;

export class AnthropicModel implements ModelPort {
  private readonly client: Anthropic;
  private readonly modelId: string;

  constructor(apiKey: string, modelId: string) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const result = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Intent: ${req.intent}\nInput: ${JSON.stringify(req.input)}\nRespond with a brief German sentence.`,
        },
      ],
    });
    const block = result.content[0] ?? null;
    return { text: block && block.type === "text" ? block.text : "[no text]" };
  }

  async triage(req: TriageRequest): Promise<TriagePayload> {
    const prompt = buildTriagePrompt(req);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await this.client.messages.create({
          model: this.modelId,
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        });
        const block = result.content[0] ?? null;
        if (!block || block.type !== "text") throw new Error("no text block in response");

        const parsed = parseTriageJson(block.text, req.day, this.modelId);
        if (parsed) return parsed;
        // loop to retry
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "triage model attempt failed",
            attempt,
            modelId: this.modelId,
            error: String(err),
          }),
        );
      }
    }

    // Deterministic fallback: honest opening line, deadline/blocked ordering
    return buildFallbackTriage(req.day, req.situationView, this.modelId);
  }
}

function buildTriagePrompt(req: TriageRequest): string {
  const { day, situationView, lastPresentedItemIds } = req;
  const presented = new Set(lastPresentedItemIds);

  const itemList = situationView.items
    .map(
      (i) =>
        `- id=${i.id} kind=${i.kind} status=${i.status} title="${i.title}"${i.occursAt ? ` occursAt=${i.occursAt}` : ""}${i.permanentlyIgnored ? " [permanently-ignored]" : ""}`,
    )
    .join("\n");

  const priorityList =
    situationView.priorities.length > 0
      ? situationView.priorities
          .map((p) => `- priorityId=${p.priorityId} scope=${p.scope} text="${p.text}"`)
          .join("\n")
      : "(keine bekannten Prioritäten)";

  const presentedList = lastPresentedItemIds.length > 0
    ? lastPresentedItemIds.join(", ")
    : "(keine vorherige Präsentation)";

  return `Du bist AIOS, ein persönlicher KI-Betriebssystempartner. Erstelle ein Triage-Urteil für den Tag ${day}.

AKTUELLE SITUATION:
${itemList}

BEKANNTE PRIORITÄTEN:
${priorityList}

ZULETZT PRÄSENTIERTE ITEMS (für Delta-Berechnung):
${presentedList}

REGELN:
- needsYou: max. 3 Items, jedes mit einem Satz Begründung. Zitiere nur priorityIds die oben gelistet sind.
- decideFirst: max. 1 Item (optional).
- question: max. 1 Frage (optional).
- Alles auf Deutsch, nüchtern, kein Emoji, kein Filler.
- "changed": Items die NICHT in der zuletzt präsentierten Liste stehen.
- "blocked" whoseMove: "your_move" wenn du handeln musst, "not_your_move" wenn andere am Zug sind.
- "blindSpots": ehrliche Aussagen über was AIOS NICHT sehen kann.
- openingLine: 1 Satz der die Form des Tages beschreibt + wichtigste zeitkritische Tatsache.

Antworte NUR mit validem JSON (kein Markdown, keine Erklärung) in diesem Format:
{
  "triageId": "triage-${day}-001",
  "day": "${day}",
  "openingLine": "...",
  "needsYou": [{"itemId": "...", "reason": "...", "citedPriorityIds": []}],
  "decideFirst": {"itemId": "...", "reason": "..."},
  "changed": [{"itemId": "...", "change": "..."}],
  "blocked": [{"itemId": "...", "whoseMove": "your_move|not_your_move"}],
  "ignorable": {"count": 0, "summary": "...", "itemIds": []},
  "disagreement": {"itemId": "...", "recommendation": "...", "impactComparison": "..."},
  "question": "...",
  "blindSpots": ["..."],
  "modelId": "${req.situationView.asOf}"
}

Lasse "decideFirst", "disagreement" und "question" weg wenn nicht zutreffend.`;
}

function parseTriageJson(text: string, day: string, modelId: string): TriagePayload | null {
  // Strip markdown code fences if model wraps the JSON
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return null;
  }

  // Enforce modelId from our side, not from model output
  if (typeof raw === "object" && raw !== null) {
    (raw as Record<string, unknown>).modelId = modelId;
    (raw as Record<string, unknown>).day = day;
  }

  const result = triageSchema.safeParse(raw);
  if (!result.success) return null;

  return result.data as TriagePayload;
}

/** Deterministic fallback when model is unavailable — honest opening line. */
export function buildFallbackTriage(day: string, view: SituationView, modelId: string): TriagePayload {
  const items = view.items.filter((i) => i.status !== "cancelled" && !i.permanentlyIgnored);

  // Sort: calendar with occursAt first (deadline proximity), then blocked, then rest
  const sorted = [...items].sort((a, b) => {
    const aTime = a.occursAt ?? "9999";
    const bTime = b.occursAt ?? "9999";
    return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
  });

  const needsYou = sorted.slice(0, 3).map((i) => ({
    itemId: i.id,
    reason: `${i.kind === "calendar" ? "Terminbasiert" : "Offene Aufgabe"}: ${i.title}`,
    citedPriorityIds: [] as string[],
  }));

  const ignorableItems = sorted.slice(3).map((i) => i.id);
  const blindSpots = view.coverage.map((c) => c.note);
  if (blindSpots.length === 0) {
    blindSpots.push("Modell war nicht verfügbar — Triage basiert auf Regelwerk, nicht auf Urteil.");
  }

  return {
    triageId: `triage-fallback-${day}`,
    day,
    openingLine:
      "Das Sprachmodell war gerade nicht erreichbar — diese Triage wurde regelbasiert erstellt. Die Einschätzung kann unvollständig sein.",
    needsYou,
    changed: [],
    blocked: [],
    ignorable: {
      count: ignorableItems.length,
      summary:
        ignorableItems.length > 0
          ? "Weitere Punkte vorhanden — nach Fristennähe sortiert."
          : "Keine weiteren Punkte.",
      itemIds: ignorableItems,
    },
    blindSpots,
    modelId,
  };
}
