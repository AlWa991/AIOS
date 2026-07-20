import type { Horizon } from "./situation.js";

export type Episode = {
  id: string;
  summary: string;
  entityIds: string[];
  validFrom: string;
  validTo: string | null;
  recordedAt: string;
};

export interface Memory {
  recall(q: { entityIds?: string[]; horizon?: Horizon; text?: string }): Promise<Episode[]>;
}
