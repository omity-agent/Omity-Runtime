import type { BaseMessage } from "@langchain/core/messages";
import { isPlainObject as isRecord } from "es-toolkit";

import { readReportedUsage } from "../../agent/model/usage/reportedTokens";
import { localize } from "../../i18n/server";
import { countTokens } from "../../runtime/tokenizer";
import type { TokenUsage } from "./contracts/projection";

export function toolInputTokens(call: Record<string, unknown>, input: unknown) {
  if (call["isCustomTool"] === true) {
    if (!isRecord(input) || typeof input["input"] !== "string") {
      throw new Error(localize("application:timeline.toolInputNotString"));
    }
    return countTokens(input["input"]);
  }
  if (typeof input === "string") {
    return countTokens(input);
  }
  const serialized: unknown = JSON.stringify(input);
  if (typeof serialized !== "string") {
    throw new TypeError(localize("application:timeline.toolInputNotSerializable"));
  }
  return countTokens(serialized);
}
export function modelTokenUsage(message: BaseMessage): TokenUsage | undefined {
  const usage = readReportedUsage(message);
  if (!usage) {
    return undefined;
  }
  return {
    cacheReadTokens: usage.cacheRead,
    estimatedCacheHitRate: usage.estimatedCacheHitRate,
    inputTokens: usage.input,
    outputTokens: usage.output,
  };
}
