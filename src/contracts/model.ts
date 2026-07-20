/** MAL seam — MockModel is the deterministic default (no real LLM in skeleton). */

export type ModelRequest = {
  intent: string;
  input: Record<string, string | number>;
};

export type ModelResponse = {
  text: string;
};

export interface ModelPort {
  complete(req: ModelRequest): Promise<ModelResponse>;
}
