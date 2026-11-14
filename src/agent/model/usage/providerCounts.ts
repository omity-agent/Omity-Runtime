import type { LanguageModelUsage } from "ai";
import { get } from "es-toolkit/compat";

import type { ModelApi } from "../../../types";
import { reportedUsageSchema, tokenCountSchema } from "./reportedTokens";

const reportedFields: Record<ModelApi, readonly [string, string, string]> = {
  completions: ["prompt_tokens", "prompt_tokens_details.cached_tokens", "completion_tokens"],
  "generate-content": ["promptTokenCount", "cachedContentTokenCount", "candidatesTokenCount"],
  interactions: ["total_input_tokens", "total_cached_tokens", "total_output_tokens"],
  messages: ["input_tokens", "cache_read_input_tokens", "output_tokens"],
  responses: ["input_tokens", "input_tokens_details.cached_tokens", "output_tokens"],
};
export function reportedModelUsage(usage: LanguageModelUsage, api: ModelApi) {
  const [inputField, cacheField, outputField] = reportedFields[api],
    read = (value: number | undefined, field: string) =>
      usage.raw !== undefined && tokenCountSchema.nullish().parse(get(usage.raw, field)) == null
        ? undefined
        : value;
  return reportedUsageSchema.parse({
    cacheRead: read(usage.inputTokenDetails.cacheReadTokens, cacheField),
    input: read(usage.inputTokens, inputField),
    output: read(usage.outputTokens, outputField),
  });
}
