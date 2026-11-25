import type { AIMessage, MessageContent } from "@langchain/core/messages";
import { assistantModelMessageSchema, type ModelMessage } from "ai";
import { isJSONValue } from "es-toolkit";

import { localize } from "../../i18n/server";

export type ModelAssistantContent = Extract<ModelMessage, { role: "assistant" }>["content"];
export type ModelAssistantPart = Exclude<ModelAssistantContent, string>[number];
export type StoredAssistantPart = Extract<
  ModelAssistantPart,
  { type: "reasoning" | "text" | "tool-call" | "tool-result" }
>;
export function isStoredAssistantPart(part: ModelAssistantPart): part is StoredAssistantPart {
  return (
    part.type === "text" ||
    part.type === "reasoning" ||
    part.type === "tool-result" ||
    (part.type === "tool-call" && part.providerExecuted === true)
  );
}
export function assistantContent(message: AIMessage): StoredAssistantPart[] {
  const stored = message.additional_kwargs["aiSdkContent"];
  if (stored !== undefined) {
    const parsed = assistantModelMessageSchema.safeParse({ content: stored, role: "assistant" });
    if (
      !parsed.success ||
      typeof parsed.data.content === "string" ||
      !parsed.data.content.every(isStoredAssistantPart) ||
      parsed.data.content.some((part) => part.type === "tool-call" && !isJSONValue(part.input))
    ) {
      throw new Error(localize("agent:messages.persistedContentInvalid"));
    }
    return parsed.data.content;
  }
  const text = textContent(message.content);
  return text ? [{ text, type: "text" }] : [];
}
export function textContent(content: MessageContent) {
  if (typeof content === "string") {
    return content;
  }
  return content
    .flatMap((part) =>
      typeof part === "string"
        ? [part]
        : part.type === "text" && typeof part["text"] === "string"
          ? [part["text"]]
          : [],
    )
    .join("");
}
