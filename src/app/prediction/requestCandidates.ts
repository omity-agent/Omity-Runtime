import { generateText, Output, streamText } from "ai";
import { escape as escapeXml } from "es-toolkit";
import { z } from "zod";

import { buildConfiguredAiModel, structuredRequestOptions } from "../../agent/model/provider";
import type { PredictionSample } from "./samples";
import type { PredictionSettings } from "./selectExamples";

interface PredictionInput {
  assistant: string;
  user: string;
}
export async function requestCandidates(
  config: PredictionSettings,
  conversation: PredictionInput,
  samples: PredictionSample[],
  signal: AbortSignal,
) {
  const options = {
    ...structuredRequestOptions(config.model),
    abortSignal: signal,
    maxRetries: 0,
    model: buildConfiguredAiModel(config.model),
    output: Output.object({
      schema: z.strictObject(
        Object.fromEntries(
          Array.from({ length: config.outputCount }, (_, index) => [
            `candidate_${(index + 1).toString()}`,
            z.string().trim().min(1),
          ]),
        ),
      ),
    }),
    prompt: predictionPrompt(config.task, conversation, samples),
    temperature: config.model.temperature,
  };
  if (config.model.adapter === "codex" || config.model.adapter === "responses-websocket") {
    const result = streamText({ ...options, onError: () => {} });
    for await (const part of result.stream) {
      if (part.type === "error") {
        throw part.error;
      }
    }
    return Object.values(await result.output);
  }
  const result = await generateText(options);
  return Object.values(result.output);
}
function predictionPrompt(
  task: string,
  conversation: PredictionInput,
  samples: PredictionSample[],
) {
  return [
    "<samples>",
    ...samples.flatMap((sample, index) => [
      `<sample index="${(index + 1).toString()}">`,
      "<assistant>",
      escapeXml(sample.assistant),
      "</assistant>",
      "<user>",
      escapeXml(sample.user),
      "</user>",
      "</sample>",
    ]),
    "</samples>",
    "<task-description>",
    escapeXml(task),
    "</task-description>",
    "<current-conversation>",
    "<user>",
    escapeXml(conversation.user),
    "</user>",
    "<assistant>",
    escapeXml(conversation.assistant),
    "</assistant>",
    "</current-conversation>",
  ].join("\n");
}
