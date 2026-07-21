/** MAL seam — MockModel is the deterministic default (no real LLM in skeleton). */
import type { SituationView } from "./situation.js";
import type { TriagePayload } from "./deliberation.js";

export type ModelRequest = {
  intent: string;
  input: Record<string, string | number>;
};

export type ModelResponse = {
  text: string;
};

// spec-0004: structured triage request — input to the model for triage production
export type TriageRequest = {
  day: string;
  situationView: SituationView;
  /** Previously presented item IDs for delta computation */
  lastPresentedItemIds: string[];
};

export interface ModelPort {
  complete(req: ModelRequest): Promise<ModelResponse>;
  /** spec-0004: produce a triage judgment from the situation view */
  triage(req: TriageRequest): Promise<TriagePayload>;
}
