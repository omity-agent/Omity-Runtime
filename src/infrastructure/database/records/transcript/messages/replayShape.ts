import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import { z } from "zod";

import { isProviderOptions } from "../../../../../agent/messages/providerOptions";
import {
  reportedUsageSchema,
  tokenCountSchema,
} from "../../../../../agent/model/usage/reportedTokens";

export const toolProviderOptionsSchema = z.record(
  z.string(),
  z.custom<SharedV4ProviderOptions>(isProviderOptions),
);
const content = z.union([
    z.string(),
    z.array(z.looseObject({ id: z.string().optional(), type: z.string() })),
  ]),
  tokens = tokenCountSchema,
  toolCall = z.strictObject({
    args: z.record(z.string(), z.unknown()),
    id: z.string().optional(),
    isCustomTool: z.boolean().optional(),
    name: z.string(),
    type: z.literal("tool_call"),
  }),
  human = z.strictObject({ content, type: z.literal("human") }),
  ai = z.strictObject({
    aiSdkContent: z.unknown().optional(),
    aiSdkToolProviderOptions: toolProviderOptionsSchema.optional(),
    content,
    reasoning: z.record(z.string(), z.unknown()).optional(),
    toolCalls: z.array(toolCall).optional(),
    type: z.literal("ai"),
    usage: reportedUsageSchema.optional(),
  }),
  tool = z.strictObject({
    builtInTool: z.literal("update_title").optional(),
    content,
    custom: z.boolean().optional(),
    largeOutputTokens: tokens.optional(),
    name: z.string().optional(),
    status: z.enum(["success", "error"]),
    structuredOutput: z.unknown().optional(),
    toolCallId: z.string(),
    type: z.literal("tool"),
  });
export const storedConversationSchema = z.discriminatedUnion("type", [human, ai, tool]);
export type StoredConversationMessage = z.infer<typeof storedConversationSchema>;
export type StoredAi = z.infer<typeof ai>;
export type StoredTool = z.infer<typeof tool>;
