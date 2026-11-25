import type { SharedV4ProviderOptions as ProviderOptions } from "@ai-sdk/provider";
import { AIMessage, type BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { ModelMessage } from "ai";
import { isPlainObject } from "es-toolkit";

import { localize } from "../../i18n/server";
import { modelToolOutput } from "../../runtime/multimodal";
import type { ModelApi } from "../../types";
import { assistantContent, type ModelAssistantPart, textContent } from "./assistantContent";
import { isProviderOptions } from "./providerOptions";

type ModelToolCallPart = Extract<ModelAssistantPart, { type: "tool-call" }>;
export function toModelMessages(
  messages: BaseMessage[],
  api: ModelApi = "completions",
): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    if (HumanMessage.isInstance(message)) {
      return { content: textContent(message.content), role: "user" };
    }
    if (AIMessage.isInstance(message)) {
      return {
        content: [
          ...assistantContent(message),
          ...(message.tool_calls ?? []).map((call) => modelToolCall(message, call)),
        ],
        role: "assistant",
      };
    }
    if (ToolMessage.isInstance(message)) {
      return {
        content: [
          {
            output: modelToolOutput(message.content, api),
            toolCallId: message.tool_call_id,
            toolName: message.name ?? "tool",
            type: "tool-result",
          },
        ],
        role: "tool",
      };
    }
    throw new Error(localize("agent:messages.typeUnsupported", { value0: message.type }));
  });
}
function modelToolCall(
  message: AIMessage,
  call: NonNullable<AIMessage["tool_calls"]>[number],
): ModelToolCallPart {
  if (!call.id) {
    throw new Error(localize("agent:messages.toolCallIdMissing", { value0: call.name }));
  }
  const part: ModelToolCallPart = {
      input: customToolInput(call),
      toolCallId: call.id,
      toolName: call.name,
      type: "tool-call",
    },
    providerOptions = toolProviderOptions(message, call.id);
  if (providerOptions) {
    part.providerOptions = providerOptions;
  }
  return part;
}
function toolProviderOptions(message: AIMessage, callId: string): ProviderOptions | undefined {
  const byCall = message.additional_kwargs["aiSdkToolProviderOptions"];
  if (!isPlainObject(byCall) || !isProviderOptions(byCall[callId])) {
    return undefined;
  }
  return byCall[callId];
}
function customToolInput(call: NonNullable<AIMessage["tool_calls"]>[number]) {
  if (Reflect.get(call, "isCustomTool") !== true) {
    return call.args;
  }
  const input: unknown = isPlainObject(call.args) ? call.args["input"] : undefined;
  if (typeof input !== "string") {
    throw new TypeError(localize("agent:messages.freeformInputNotString", { value0: call.name }));
  }
  return input;
}
