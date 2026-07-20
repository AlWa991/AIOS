import type { ModelPort, ModelRequest, ModelResponse } from "../../contracts/model.js";

/** Deterministic template-based model — the MAL default for the skeleton. */
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
}
