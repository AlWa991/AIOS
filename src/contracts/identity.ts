export type Mention = {
  text: string;
  sourceEventId: number;
};

export type EntityRef = {
  id: string;
  kind: string;
  canonicalName: string;
  confidence: "high" | "low";
};

export interface Identity {
  resolve(mention: Mention): Promise<EntityRef>;
}
