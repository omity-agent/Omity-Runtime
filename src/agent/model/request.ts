import { AIMessage, type BaseMessage, HumanMessage } from "@langchain/core/messages";
import { type LanguageModel, streamText, type TextStreamPart, type ToolSet } from "ai";
import { raceSignal } from "race-signal";

import { localize } from "../../i18n/server";
import { ModelEmptyResponseError } from "../../runtime/transientErrors";
import type { Settings } from "../../types";
import { fromModelMessages } from "../messages/decode";
import { toModelMessages } from "../messages/encode";
import { buildAiModel, conversationRequestOptions, modelApi } from "./provider";
import { estimateCacheHitRate } from "./usage/cacheExpectation";
import { readReportedUsage } from "./usage/reportedTokens";

interface ModelRequestOptions {
  freeformToolNames?: ReadonlySet<string>;
  messages: BaseMessage[];
  model?: LanguageModel;
  sessionId: string;
  settings: Settings;
  signal?: AbortSignal;
  tools: ToolSet;
  write?: (part: ModelStreamEvent) => void;
}
export interface ModelStreamEvent {
  freeform?: true;
  part: TextStreamPart<ToolSet>;
}
export async function streamAiModel(options: ModelRequestOptions) {
  options.signal?.throwIfAborted();
  const attempts = new Map<number, AbortController>(),
    completed = Promise.withResolvers<AIMessage>(),
    model = options.model ?? buildAiModel(options.settings),
    api = modelApi(options.settings),
    modelMessages = toModelMessages(options.messages, api),
    estimatedCacheHitRate = estimateCacheHitRate(options.messages, modelMessages),
    turnId = options.messages.findLast((message) => HumanMessage.isInstance(message))?.id;
  let finished = false,
    nextAttemptId = 0,
    winnerId: number | undefined;
  const interval = setInterval(() => {
    if (winnerId === undefined && attempts.size < options.settings.model.maxConcurrentRequests) {
      startAttempt();
    }
  }, options.settings.model.raceIntervalMs);
  startAttempt();
  try {
    return await raceSignal(completed.promise, options.signal);
  } finally {
    finished = true;
    clearInterval(interval);
    abortAttempts();
  }
  function abortAttempts(except?: number) {
    for (const [id, controller] of attempts) {
      if (id !== except) {
        controller.abort(new DOMException(localize("agent:model.otherRequestWon"), "AbortError"));
      }
    }
  }
  function selectWinner(id: number, parts: ModelStreamEvent[]) {
    if (winnerId !== undefined) {
      return winnerId === id;
    }
    winnerId = id;
    clearInterval(interval);
    abortAttempts(id);
    for (const part of parts) {
      options.write?.(part);
    }
    return true;
  }
  async function runAttempt(
    id: number,
    controller: AbortController,
  ): Promise<AIMessage | undefined> {
    const buffered: ModelStreamEvent[] = [];
    try {
      const result = streamText({
        abortSignal: options.signal
          ? AbortSignal.any([options.signal, controller.signal])
          : controller.signal,
        ...conversationRequestOptions(options.settings.model, options.sessionId, turnId),
        instructions: options.settings.agent.systemPrompt,
        maxRetries: 0,
        messages: modelMessages,
        model,
        onError: () => {},
        temperature: options.settings.model.temperature,
        tools: options.tools,
      });
      for await (const part of result.stream) {
        if (finished) {
          return undefined;
        }
        if (part.type === "error") {
          throw part.error;
        }
        const event: ModelStreamEvent = {
          ...(part.type === "tool-input-start" && options.freeformToolNames?.has(part.toolName)
            ? { freeform: true }
            : {}),
          part,
        };
        if (winnerId === id) {
          options.write?.(event);
        } else if (winnerId === undefined) {
          buffered.push(event);
          if (hasModelContent(part) && !selectWinner(id, buffered)) {
            return undefined;
          }
        } else {
          return undefined;
        }
      }
      if (winnerId !== id) {
        if (winnerId !== undefined) {
          return undefined;
        }
        throw new ModelEmptyResponseError();
      }
      const step = await result.finalStep,
        messages = fromModelMessages(step.response.messages, step.response.id, step.usage, api),
        response = messages.findLast((message) => AIMessage.isInstance(message));
      if (
        !response ||
        (!response.tool_calls?.length && !response.text && step.rawFinishReason !== "pause_turn")
      ) {
        throw new ModelEmptyResponseError();
      }
      response.response_metadata["rawFinishReason"] = step.rawFinishReason;
      response.response_metadata["usage"] = {
        ...readReportedUsage(response),
        estimatedCacheHitRate,
      };
      return response;
    } finally {
      attempts.delete(id);
    }
  }
  async function monitorAttempt(id: number, controller: AbortController) {
    try {
      const response = await runAttempt(id, controller);
      if (!finished && winnerId === id && response) {
        finished = true;
        completed.resolve(response);
      }
    } catch (error) {
      if (!finished && (winnerId === id || (winnerId === undefined && attempts.size === 0))) {
        finished = true;
        completed.reject(error);
      }
    }
  }
  function startAttempt() {
    const id = nextAttemptId++,
      controller = new AbortController();
    attempts.set(id, controller);
    void monitorAttempt(id, controller);
  }
}
export function hasModelContent(part: TextStreamPart<ToolSet>) {
  switch (part.type) {
    case "file":
    case "reasoning-file":
    case "tool-call": {
      return true;
    }
    case "reasoning-delta":
    case "text-delta": {
      return part.text.length > 0;
    }
    case "tool-input-delta": {
      return part.delta.length > 0;
    }
    default: {
      return false;
    }
  }
}
