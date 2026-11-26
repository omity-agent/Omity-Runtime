import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

import { type BaseMessage, HumanMessage } from "@langchain/core/messages";

import { localize } from "../../../../../i18n/server";
import { transcriptMessageRows } from "../../../projections/transcriptRows";
import { requireSessionRecord } from "../../session/metadata";
import { decodeMessage } from "./hydration";
import { messageInsert, type MessageStorageMode } from "./serialization";
import { messageMutations } from "./writing";

export function insertUserMessage(
  db: Database,
  sessionId: string,
  content: string,
  inputId: number,
) {
  const position = nextPosition(db, sessionId),
    id = storeMessage(
      db,
      sessionId,
      new HumanMessage({ content, id: inputMessageId(sessionId, inputId) }),
      position,
      inputId,
    );
  return { id, position };
}
export function inputMessageId(sessionId: string, inputId: number) {
  return `input:${sessionId}:${inputId.toString()}`;
}
export function messageInputId(sessionId: string, message: BaseMessage) {
  if (message.type !== "human" || !message.id?.startsWith("input:")) {
    return undefined;
  }
  const prefix = `input:${sessionId}:`;
  if (!message.id.startsWith(prefix)) {
    throw new Error(
      localize("database:messages.foreignUserMessage", {
        messageId: message.id,
      }),
    );
  }
  const inputId = Number(message.id.slice(prefix.length));
  if (!Number.isSafeInteger(inputId) || inputId <= 0) {
    throw new Error(
      localize("database:messages.queueIdInvalid", {
        messageId: message.id,
      }),
    );
  }
  return inputId;
}
export function loadMessages(db: Database, sessionId: string): BaseMessage[] {
  requireSessionRecord(db, sessionId);
  return transcriptMessageRows(db, sessionId).map((row) =>
    decodeMessage(row.messageJson, row.sourceId),
  );
}
export function storeMessage(
  db: Database,
  sessionId: string,
  message: BaseMessage,
  position?: number,
  inputId?: number,
  createdAt?: number,
  mode: MessageStorageMode = "history",
) {
  message.id ??= randomUUID();
  return storePreparedMessage(
    db,
    sessionId,
    messageInsert(message, mode),
    position,
    inputId,
    createdAt,
  );
}
export function storePreparedMessage(
  db: Database,
  sessionId: string,
  item: ReturnType<typeof messageInsert>,
  position?: number,
  inputId?: number,
  createdAt?: number,
) {
  const row = messageMutations(db).store.get({
    ...item,
    createdAt: createdAt ?? null,
    inputId: inputId ?? null,
    position: position ?? null,
    sessionId,
  });
  if (inputId !== undefined) {
    messageMutations(db).consume.run({ inputId, sessionId });
  }
  return row.id;
}
function nextPosition(db: Database, sessionId: string) {
  const position = Number(messageMutations(db).nextPosition.get({ sessionId })?.position);
  if (!Number.isSafeInteger(position) || position < 0) {
    throw new Error(localize("database:messages.positionUnavailable"));
  }
  return position;
}
