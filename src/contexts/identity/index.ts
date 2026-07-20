import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import { deterministicUuid } from "../../platform/ids.js";
import { appendEvent, type StoredEvent } from "../../platform/events/event-log.js";
import type { Consumer } from "../../platform/events/consumers.js";
import type { EntityRef, Identity, Mention } from "../../contracts/identity.js";

type KnownEntity = { kind: string; canonicalName: string; aliases: string[] };

/** Skeleton-static registry; real connectors replace this later. */
const KNOWN: KnownEntity[] = [
  { kind: "person", canonicalName: "Alex", aliases: ["alex"] },
  { kind: "person", canonicalName: "Eduard Dinges", aliases: ["eddy", "eduard"] },
  { kind: "org", canonicalName: "IMH", aliases: ["imh"] },
  { kind: "org", canonicalName: "D&W IT Consulting", aliases: ["d&w", "dw"] },
];

export class IdentityService implements Identity {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  async resolve(mention: Mention): Promise<EntityRef> {
    const known = KNOWN.find((k) =>
      k.aliases.includes(mention.text.toLowerCase()),
    );
    const ref: EntityRef = known
      ? {
          id: deterministicUuid(`entity:${known.canonicalName}`),
          kind: known.kind,
          canonicalName: known.canonicalName,
          confidence: "high",
        }
      : {
          id: deterministicUuid(`entity:unknown:${mention.text.toLowerCase()}`),
          kind: "unknown",
          canonicalName: mention.text,
          confidence: "low",
        };
    await this.db.query(
      `INSERT INTO entities (id, kind, canonical_name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [ref.id, ref.kind, ref.canonicalName],
    );
    await this.db.query(
      `INSERT INTO entity_aliases (entity_id, alias) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [ref.id, mention.text.toLowerCase()],
    );
    if (ref.confidence === "high" && ref.canonicalName !== "Alex") {
      // bitemporal edge: entity is related to the self entity
      const selfId = deterministicUuid("entity:Alex");
      const now = this.clock.now().toISOString();
      await this.db.query(
        `INSERT INTO edges (from_id, to_id, type, valid_from, valid_to, recorded_at)
         VALUES ($1, $2, 'related_to', $3, NULL, $3)
         ON CONFLICT DO NOTHING`,
        [ref.id, selfId, now],
      );
    }
    return ref;
  }
}

export function createIdentityConsumer(db: Db, clock: Clock): Consumer {
  const service = new IdentityService(db, clock);
  return {
    name: "identity",
    async handle(event: StoredEvent): Promise<void> {
      if (event.type !== "perception.observation.captured") return;
      const mentions = event.payload.mentions as string[];
      for (const text of mentions) {
        const ref = await service.resolve({ text, sourceEventId: event.id });
        await appendEvent(db, "identity.entity.resolved", 1, clock.now(), {
          mention: text,
          entityId: ref.id,
          canonicalName: ref.canonicalName,
          kind: ref.kind,
          confidence: ref.confidence,
          sourceEventId: event.id,
        });
      }
    },
  };
}
