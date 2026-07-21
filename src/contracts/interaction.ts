/** User input/output surface — apps talk only to this and to Situation (ADR-0017). */
export interface Interaction {
  /** Start the day: emit time.day.started and drive the cognitive loop. */
  startDay(): Promise<void>;
  /** Render the Morning Briefing (Markdown) from Situation.current() only. Legacy English format. */
  brief(): Promise<string>;
  /**
   * spec-0004: Produce triage, record seen-state, return German briefing markdown.
   * This is the production morning experience.
   */
  briefGerman(): Promise<string>;
  /**
   * spec-0004: Run the interactive conversation loop on stdin.
   * Call after briefGerman() when in interactive mode.
   */
  runConversation(): Promise<void>;
  /** Approve a recommendation; drives execution and returns a short confirmation. */
  approve(recommendationId: string): Promise<string>;
}
