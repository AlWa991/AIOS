import type { Db } from "../db/pool.js";
import { readEventsAfter, type StoredEvent } from "./event-log.js";

export interface Consumer {
  name: string;
  /** Handle one event. Must be idempotent (replay-safe). */
  handle(event: StoredEvent): Promise<void>;
  /** Called once after a batch with >=1 handled event. */
  onBatchEnd?(): Promise<void>;
}

const MAX_ATTEMPTS = 3;

export class ConsumerRunner {
  private readonly consumers: Consumer[] = [];

  constructor(private readonly db: Db) {}

  register(consumer: Consumer): void {
    this.consumers.push(consumer);
  }

  /** Run every consumer over its pending events until the log is drained. */
  async pump(): Promise<void> {
    let processed = 0;
    do {
      processed = 0;
      for (const consumer of this.consumers) {
        processed += await this.runConsumerOnce(consumer);
      }
    } while (processed > 0);
  }

  private async runConsumerOnce(consumer: Consumer): Promise<number> {
    const cursor = await this.getCursor(consumer.name);
    const events = await readEventsAfter(this.db, cursor);
    let handled = 0;
    for (const event of events) {
      await this.handleWithRetry(consumer, event);
      await this.setCursor(consumer.name, event.id);
      handled++;
    }
    if (handled > 0 && consumer.onBatchEnd) await consumer.onBatchEnd();
    return handled;
  }

  private async handleWithRetry(consumer: Consumer, event: StoredEvent): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await consumer.handle(event);
        return;
      } catch (err) {
        if (attempt === MAX_ATTEMPTS) {
          console.error(
            JSON.stringify({
              level: "error",
              msg: "consumer halted",
              consumer: consumer.name,
              eventId: event.id,
              eventType: event.type,
              attempts: attempt,
              error: String(err),
            }),
          );
          throw err;
        }
      }
    }
  }

  private async getCursor(consumer: string): Promise<number> {
    const res = await this.db.query(
      `SELECT last_event_id FROM consumer_cursors WHERE consumer = $1`,
      [consumer],
    );
    return res.rows[0] ? Number(res.rows[0].last_event_id) : 0;
  }

  private async setCursor(consumer: string, lastEventId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO consumer_cursors (consumer, last_event_id) VALUES ($1, $2)
       ON CONFLICT (consumer) DO UPDATE SET last_event_id = EXCLUDED.last_event_id`,
      [consumer, lastEventId],
    );
  }
}
