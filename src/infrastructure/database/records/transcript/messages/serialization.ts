import { type BaseMessage, HumanMessage } from "@langchain/core/messages";

import { localize } from "../../../../../i18n/server";
import { contentToText } from "../../../../../runtime/content";
import { countTokens } from "../../../../../runtime/tokenizer";
import { encodeMessage, type MessageStorageMode } from "./payload";

export interface MessageInsert {
  messageJson: string;
  sourceId: string;
  tokenCount: number | null;
}
export type { MessageStorageMode } from "./payload";
export function messageInsert(
  message: BaseMessage,
  mode: MessageStorageMode = "history",
): MessageInsert {
  return { ...serializeMessage(message, mode), tokenCount: messageTokenCount(message) };
}
export function serializeMessage(message: BaseMessage, mode: MessageStorageMode = "history") {
  if (!message.id) {
    throw new Error(localize("database:messages.persistentIdMissing"));
  }
  return {
    messageJson: JSON.stringify(encodeMessage(message, mode)),
    sourceId: message.id,
  };
}
export function messageTokenCount(message: BaseMessage) {
  return HumanMessage.isInstance(message) ? countTokens(contentToText(message.content)) : null;
}
