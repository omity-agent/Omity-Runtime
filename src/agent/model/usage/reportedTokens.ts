import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { z } from "zod";

import { localize } from "../../../i18n/server";

export const tokenCountSchema = z.number().int().nonnegative(),
  reportedUsageSchema = z
    .strictObject({
      cacheRead: tokenCountSchema.optional(),
      estimatedCacheHitRate: z.number().min(0).max(1).optional(),
      input: tokenCountSchema.optional(),
      output: tokenCountSchema.optional(),
    })
    .refine(
      ({ input, output }) =>
        input === undefined || output === undefined || Number.isSafeInteger(input + output),
      localize("database:messages.tokenTotalUnsafe"),
    )
    .refine(
      ({ input, cacheRead }) =>
        input === undefined || cacheRead === undefined || cacheRead <= input,
      localize("application:timeline.cacheReadExceedsInput"),
    );
export function readReportedUsage(message: BaseMessage) {
  return AIMessage.isInstance(message)
    ? reportedUsageSchema.optional().parse(message.response_metadata["usage"])
    : undefined;
}
