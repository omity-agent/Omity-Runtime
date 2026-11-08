import { generateText, Output } from "ai";
import { escape as escapeXml } from "es-toolkit";
import { z } from "zod";

import { buildConfiguredAiModel, structuredRequestOptions } from "../../agent/model/provider";
import type { PredictionSample } from "./samples";
import type { PredictionSettings } from "./selectExamples";

export async function requestCandidates(
  config: PredictionSettings,
  assistantResponse: string,
  samples: PredictionSample[],
  signal: AbortSignal,
) {
  const result = await generateText({
    ...structuredRequestOptions(config.model),
    abortSignal: signal,
    maxRetries: 0,
    model: buildConfiguredAiModel(config.model),
    output: Output.array({
      element: z.string().trim().min(1),
      maxItems: config.outputCount,
      minItems: config.outputCount,
    }),
    prompt: predictionPrompt(config.task, assistantResponse, samples),
    temperature: config.model.temperature,
  });
  return result.output;
}
function predictionPrompt(task: string, assistantResponse: string, samples: PredictionSample[]) {
  return [
    "<samples>",
    ...samples.flatMap((sample, index) => [
      `  <sample index="${(index + 1).toString()}">`,
      "    <assistant>",
      escapeXml(sample.assistant),
      "    </assistant>",
      "    <user>",
      escapeXml(sample.user),
      "    </user>",
      "  </sample>",
    ]),
    "</samples>",
    "<task-description>",
    escapeXml(task),
    "</task-description>",
    "<current-assistant-response>",
    escapeXml(assistantResponse),
    "</current-assistant-response>",
  ].join("\n");
}
