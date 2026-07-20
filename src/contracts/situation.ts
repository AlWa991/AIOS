/** The SOLE read surface for all interfaces (ADR-0017). */

export type Horizon = "today" | "week";

export type SituationItem = {
  id: string;
  kind: string;
  horizon: Horizon;
  status: string;
  title: string;
  occursAt: string | null;
  entityIds: string[];
  sourceEventId: number;
  updatedAt: string;
};

export type CoverageNote = {
  mention: string;
  note: string;
};

export type RecommendationView = {
  id: string;
  rationale: string;
  goalIds: string[];
  status: "open" | "approved" | "done";
};

export type CompletionView = {
  recommendationId: string;
  detail: string;
};

export type SituationView = {
  asOf: string;
  items: SituationItem[];
  recommendations: RecommendationView[];
  coverage: CoverageNote[];
  completions: CompletionView[];
};

export interface Situation {
  current(horizon: Horizon): Promise<SituationView>;
}
