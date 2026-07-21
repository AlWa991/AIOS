/** The SOLE read surface for all interfaces (ADR-0017). */
import type { TriagePayload } from "./deliberation.js";

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
  /** spec-0004: when was this item last shown in a briefing */
  lastPresentedAt?: string;
  /** spec-0004: is this item permanently ignored by user */
  permanentlyIgnored?: boolean;
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

// spec-0004: stated priority — readable from Situation for provenance checks
export type PriorityView = {
  priorityId: string;
  text: string;
  scope: "day" | "week" | "month";
  sourceEventId: string;
  recordedAt: string;
};

export type SituationView = {
  asOf: string;
  items: SituationItem[];
  recommendations: RecommendationView[];
  coverage: CoverageNote[];
  completions: CompletionView[];
  /** spec-0004: latest triage judgment for today, if produced */
  triage?: TriagePayload;
  /** spec-0004: recorded priorities */
  priorities: PriorityView[];
};

export interface Situation {
  current(horizon: Horizon): Promise<SituationView>;
}
