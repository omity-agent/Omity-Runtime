import { AIMessage, type BaseMessage, type ToolCall, ToolMessage } from "@langchain/core/messages";
import type { LanguageModelUsage, ModelMessage } from "ai";
import { isPlainObject as isRecord } from "es-toolkit";

import { trimFreeformInput } from "../../fileLinks/toolInput";
import { localize } from "../../i18n/server";
import type { ModelApi } from "../../types";
import { reportedModelUsage } from "../model/usage/providerCounts";
import { isStoredAssistantPart, type ModelAssistantContent } from "./assistantContent";
import { omitToolItemIds } from "./providerOptions";

export function fromModelMessages(
  messages: ModelMessage[],
  assistantId: string,
  usage: LanguageModelUsage | undefined,
  api: ModelApi,
): BaseMessage[] {
  const result: BaseMessage[] = [];
  for (const [index, message] of messages.entries()) {
    if (message.role === "assistant") {
      const providerOptions = toolProviderOptions(message.content);
      result.push(
        new AIMessage({
          additional_kwargs: {
            aiSdkContent: storedAssistantContent(message.content),
            ...(providerOptions ? { aiSdkToolProviderOptions: providerOptions } : {}),
          },
          content: assistantText(message.content),
          id: `${assistantId}:assistant:${index.toString()}`,
          response_metadata: usage ? { usage: reportedModelUsage(usage, api) } : undefined,
          tool_calls: toolCalls(message.content),
        }),
      );
    } else if (message.role === "tool") {
      for (const part of message.content) {
        if (part.type === "tool-result") {
          result.push(
            new ToolMessage({
              content: outputText(part.output),
              id: `${assistantId}:tool:${part.toolCallId}`,
              name: part.toolName,
              tool_call_id: part.toolCallId,
            }),
          );
        }
      }
    } else {
      throw new Error(localize("agent:stream.roleUnsupported", { role: message.role }));
    }
  }
  return result;
}
function storedAssistantContent(content: ModelAssistantContent) {
  return typeof content === "string"
    ? [{ text: content, type: "text" as const }]
    : content.filter(isStoredAssistantPart);
}
function assistantText(content: ModelAssistantContent) {
  return typeof content === "string"
    ? content
    : content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
}
function toolCalls(content: ModelAssistantContent): ToolCall[] {
  if (typeof content === "string") {
    return [];
  }
  return content
    .filter((part) => part.type === "tool-call")
    .filter((part) => !part.providerExecuted)
    .map((part) => {
      if (typeof part.input === "string") {
        return {
          args: { input: trimFreeformInput(part.input) },
          id: part.toolCallId,
          isCustomTool: true,
          name: part.toolName,
          type: "tool_call" as const,
        };
      }
      if (!isRecord(part.input)) {
        throw new Error(
          localize("agent:stream.structuredInputNotObject", { toolName: part.toolName }),
        );
      }
      return {
        args: part.input,
        id: part.toolCallId,
        name: part.toolName,
        type: "tool_call" as const,
      };
    });
}
function toolProviderOptions(content: ModelAssistantContent) {
  if (typeof content === "string") {
    return undefined;
  }
  const entries = content.flatMap((part) => {
    if (part.type !== "tool-call" || part.providerExecuted || !part.providerOptions) {
      return [];
    }
    const providerOptions = omitToolItemIds(part.providerOptions);
    return providerOptions ? [[part.toolCallId, providerOptions] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
type ToolResult = Extract<
  Extract<ModelMessage, { role: "tool" }>["content"][number],
  { type: "tool-result" }
>;
function outputText(output: ToolResult["output"]) {
  if (output.type === "text" || output.type === "error-text") {
    return output.value;
  }
  if (output.type === "json" || output.type === "error-json") {
    return JSON.stringify(output.value);
  }
  if (output.type === "execution-denied") {
    return output.reason ?? localize("agent:stream.toolRejected");
  }
  return output.value.flatMap((part) => ("text" in part ? [part.text] : [])).join("");
}
