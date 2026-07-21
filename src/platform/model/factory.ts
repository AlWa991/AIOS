/**
 * Model factory — selects the real adapter or MockModel from environment.
 * AIOS_MODEL=anthropic:<model-id> + ANTHROPIC_API_KEY → AnthropicModel
 * Unset / unknown → MockModel (deterministic, no network).
 */
import type { ModelPort } from "../../contracts/model.js";
import { MockModel } from "./mock-model.js";
import { AnthropicModel } from "./anthropic-model.js";

export function createModelFromEnv(env: NodeJS.ProcessEnv = process.env): ModelPort {
  const spec = env.AIOS_MODEL ?? "";
  if (spec.startsWith("anthropic:")) {
    const modelId = spec.slice("anthropic:".length);
    const apiKey = env.ANTHROPIC_API_KEY ?? "";
    if (!apiKey) {
      console.error(
        JSON.stringify({
          level: "warn",
          msg: "AIOS_MODEL=anthropic:* but ANTHROPIC_API_KEY is unset — falling back to MockModel",
        }),
      );
      return new MockModel();
    }
    return new AnthropicModel(apiKey, modelId);
  }
  return new MockModel();
}
