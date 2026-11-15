import type { BaseMessage } from "@langchain/core/messages";
import type { ModelMessage } from "ai";

import { localize } from "../../../i18n/server";
import { countTokens } from "../../../runtime/tokenizer";
import { readReportedUsage } from "./reportedTokens";

export function estimateCacheHitRate(messages: BaseMessage[], modelMessages: ModelMessage[]) {
  const previousIndex = messages.findLastIndex(
      (message) => readReportedUsage(message) !== undefined,
    ),
    previous = messages[previousIndex];
  if (!previous) {
    return 0;
  }
  const previousTokens = readReportedUsage(previous)?.input;
  if (previousTokens === undefined) {
    return;
  }
  if (previousTokens === 0) {
    return 0;
  }
  const suffixTokens = countTokens(JSON.stringify(modelMessages.slice(previousIndex))),
    estimatedInputTokens = previousTokens + suffixTokens;
  if (!Number.isSafeInteger(estimatedInputTokens)) {
    throw new TypeError(localize("agent:model.cacheInputTokensUnsafe"));
  }
  return previousTokens / estimatedInputTokens;
}
