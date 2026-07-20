/**
 * Perception adapter port (spec-0002). An adapter converts one outside-world
 * source into observations. Change detection / idempotency is the adapter's
 * responsibility: `collect(day)` returns ONLY the observations that must be
 * emitted for this run (re-running on unchanged input returns []).
 */

export type SourceName = "calendar" | "email" | "github";

export type Observation = {
  source: SourceName;
  externalId: string;
  title: string;
  body: string;
  from?: string;
  mentions: string[];
  occursAt?: string;
  horizon: "today" | "week";
  /** Optional fields introduced by spec-0002 (additive, calendar shape). */
  attendees?: string[];
  location?: string;
  allDay?: boolean;
  sourceUid?: string;
  status?: "confirmed" | "cancelled";
};

export interface PerceptionAdapter {
  readonly source: SourceName;
  /** Observations to emit for the given day (ISO date). Must be idempotent. */
  collect(day: string): Promise<Observation[]>;
}
