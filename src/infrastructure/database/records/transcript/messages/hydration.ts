import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

import { structuredOutputArtifact } from "../../../../mcp/tools/structured";
import { storedConversationSchema } from "./replayShape";

export function decodeMessage(value: string, id?: string) {
  const stored = storedConversationSchema.parse(JSON.parse(value) as unknown);
  if (stored.type === "human") {
    return new HumanMessage({ content: stored.content, id });
  }
  if (stored.type === "ai") {
    return new AIMessage({
      additional_kwargs: {
        ...(stored.aiSdkContent ? { aiSdkContent: stored.aiSdkContent } : {}),
        ...(stored.aiSdkToolProviderOptions
          ? { aiSdkToolProviderOptions: stored.aiSdkToolProviderOptions }
          : {}),
        ...(stored.reasoning ? { reasoning: stored.reasoning } : {}),
      },
      content: stored.content,
      id,
      ...(stored.usage ? { response_metadata: { usage: stored.usage } } : {}),
      ...(stored.toolCalls ? { tool_calls: stored.toolCalls } : {}),
    });
  }
  return new ToolMessage({
    artifact:
      stored.structuredOutput === undefined
        ? undefined
        : structuredOutputArtifact(stored.structuredOutput),
    content: stored.content,
    id,
    metadata:
      stored.custom !== true &&
      stored.largeOutputTokens === undefined &&
      stored.builtInTool === undefined
        ? undefined
        : {
            ...(stored.builtInTool === undefined ? {} : { builtInTool: stored.builtInTool }),
            ...(stored.custom === true ? { customTool: true } : {}),
            ...(stored.largeOutputTokens === undefined
              ? {}
              : { largeOutput: { tokens: stored.largeOutputTokens } }),
          },
    name: stored.name,
    status: stored.status,
    tool_call_id: stored.toolCallId,
  });
}
