import type { ActionRequest } from "./execution.js";

/**
 * NO read contract for interfaces (ADR-0017) — recommendations travel via
 * events into the Situation projection.
 */
export type Recommendation = {
  id: string;
  rationale: string;
  goalIds: string[];
  action?: ActionRequest;
};

// spec-0004: Triage schema types (mirrored from registry; enforced by zod)
export type TriageNeedsYou = {
  itemId: string;
  reason: string;
  citedPriorityIds: string[];
};

export type TriageBlocked = {
  itemId: string;
  whoseMove: "your_move" | "not_your_move";
};

export type TriageChanged = {
  itemId: string;
  change: string;
};

export type TriageDisagreement = {
  itemId: string;
  recommendation: string;
  impactComparison: string;
};

export type TriagePayload = {
  triageId: string;
  day: string;
  openingLine: string;
  needsYou: TriageNeedsYou[]; // ≤3 enforced by zod schema
  decideFirst?: { itemId: string; reason: string };
  changed: TriageChanged[];
  blocked: TriageBlocked[];
  ignorable: { count: number; summary: string; itemIds: string[] };
  disagreement?: TriageDisagreement;
  question?: string; // ≤1 per spec
  blindSpots: string[];
  modelId: string;
};
