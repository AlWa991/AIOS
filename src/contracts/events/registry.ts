import { z } from "zod";

/** Event registry v1 — additive-only. Key: `${type}@${version}`. */

export const horizonSchema = z.enum(["today", "week"]);

const reversibility = z.enum(["reversible", "compensable", "irreversible"]);

export const actionRequestSchema = z.object({
  adapter: z.string(),
  reversibility,
  payload: z.unknown(),
});

export const eventSchemas = {
  "time.day.started@1": z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  "perception.observation.captured@1": z.object({
    source: z.enum(["calendar", "email", "github"]),
    externalId: z.string(),
    title: z.string(),
    body: z.string().default(""),
    from: z.string().optional(),
    mentions: z.array(z.string()),
    occursAt: z.string().optional(),
    horizon: horizonSchema,
    day: z.string(),
  }),
  "identity.entity.resolved@1": z.object({
    mention: z.string(),
    entityId: z.string().uuid(),
    canonicalName: z.string(),
    kind: z.string(),
    confidence: z.enum(["high", "low"]),
    sourceEventId: z.number().int(),
  }),
  "memory.episode.recorded@1": z.object({
    episodeId: z.string(),
    summary: z.string(),
    entityIds: z.array(z.string().uuid()),
    sourceEventId: z.number().int(),
  }),
  "situation.item.updated@1": z.object({
    itemId: z.string(),
    kind: z.string(),
    status: z.string(),
  }),
  "deliberation.goal.created@1": z.object({
    goalId: z.string(),
    title: z.string(),
    status: z.string(),
    revision: z.number().int(),
    keywords: z.array(z.string()),
  }),
  "deliberation.recommendation.created@1": z.object({
    recommendationId: z.string(),
    day: z.string(),
    rationale: z.string(),
    goalIds: z.array(z.string()).min(1),
    action: actionRequestSchema.optional(),
  }),
  "deliberation.approval.granted@1": z.object({
    recommendationId: z.string(),
  }),
  "execution.action.completed@1": z.object({
    recommendationId: z.string(),
    adapter: z.string(),
    status: z.enum(["completed", "rejected"]),
    detail: z.string(),
  }),
  "interaction.briefing.delivered@1": z.object({
    day: z.string(),
    horizon: horizonSchema,
    recommendationCount: z.number().int(),
  }),
} as const;

export type EventType = keyof typeof eventSchemas extends `${infer T}@${string}` ? T : never;

export function validatePayload(type: string, version: number, payload: unknown): unknown {
  const schema = eventSchemas[`${type}@${version}` as keyof typeof eventSchemas];
  if (!schema) throw new Error(`unknown event ${type} v${version}`);
  return schema.parse(payload);
}
