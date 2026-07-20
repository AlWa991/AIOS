/** User input/output surface — apps talk only to this and to Situation (ADR-0017). */
export interface Interaction {
  /** Start the day: emit time.day.started and drive the cognitive loop. */
  startDay(): Promise<void>;
  /** Render the Morning Briefing (Markdown) from Situation.current() only. */
  brief(): Promise<string>;
  /** Approve a recommendation; drives execution and returns a short confirmation. */
  approve(recommendationId: string): Promise<string>;
}
