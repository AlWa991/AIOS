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
