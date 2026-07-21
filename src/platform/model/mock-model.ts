import type { ModelPort, ModelRequest, ModelResponse, TriageRequest } from "../../contracts/model.js";
import type { TriagePayload } from "../../contracts/deliberation.js";

/** Deterministic template-based model — the MAL default for tests. Produces valid German triage from fixtures. */
export class MockModel implements ModelPort {
  async complete(req: ModelRequest): Promise<ModelResponse> {
    switch (req.intent) {
      case "briefing.intro":
        return {
          text: `Good morning. You have ${req.input.itemCount} items on the radar and ${req.input.recommendationCount} recommendations for ${req.input.day}.`,
        };
      default:
        return { text: `[mock:${req.intent}]` };
    }
  }

  async triage(req: TriageRequest): Promise<TriagePayload> {
    const { day, situationView, lastPresentedItemIds } = req;
    const presented = new Set(lastPresentedItemIds);

    // Build needsYou: calendar + email items, max 3
    const candidates = situationView.items
      .filter((i) => i.status !== "cancelled" && !i.permanentlyIgnored)
      .slice(0, 3);

    const needsYou = candidates.map((item) => ({
      itemId: item.id,
      reason: `${item.kind === "calendar" ? "Termin" : "Aufgabe"}: ${item.title}`,
      citedPriorityIds: [] as string[],
    }));

    // Changed: items not previously presented
    const changed = situationView.items
      .filter((i) => !presented.has(i.id))
      .slice(0, 5)
      .map((i) => ({ itemId: i.id, change: "Neu seit gestern" }));

    // Blocked: nothing blocked in mock
    const blocked: TriagePayload["blocked"] = [];

    // Ignorable: remaining items beyond needsYou
    const ignorableItems = situationView.items
      .filter((i) => !candidates.find((c) => c.id === i.id))
      .map((i) => i.id);

    const ignorable = {
      count: ignorableItems.length,
      summary:
        ignorableItems.length > 0
          ? "Newsletter, Bestätigungen und CC-Mails — nichts davon braucht dich heute."
          : "Keine weiteren Punkte.",
      itemIds: ignorableItems,
    };

    // Blind spots from coverage notes
    const blindSpots = situationView.coverage.map((c) => c.note);
    if (blindSpots.length === 0) {
      blindSpots.push("Notion und GitHub sind noch nicht verbunden; E-Mails erst seit heute 06:00. Dort können blinde Flecken liegen.");
    }

    const itemCount = situationView.items.length;
    const openingLine =
      itemCount === 0
        ? "Ruhiger Start — noch keine neuen Einträge."
        : `${itemCount === 1 ? "Ein Punkt" : `${itemCount} Punkte`} auf dem Radar — ${candidates.length > 0 ? `${candidates.length} braucht dich heute` : "alles im Griff"}.`;

    return {
      triageId: `triage-mock-${day}`,
      day,
      openingLine,
      needsYou,
      changed,
      blocked,
      ignorable,
      blindSpots,
      modelId: "mock",
    };
  }
}
