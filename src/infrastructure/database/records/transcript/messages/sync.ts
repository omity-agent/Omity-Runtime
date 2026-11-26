import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

import type { BaseMessage } from "@langchain/core/messages";

import { transcriptMessageRows } from "../../../projections/transcriptRows";
import { messageInputId, storePreparedMessage } from "./history";
import { decodeMessage } from "./hydration";
import { messageTokenCount, serializeMessage } from "./serialization";
import { messageMutations, pruneUnreferencedMessages } from "./writing";

export function prepareMessageSync(db: Database, sessionId: string, messages: BaseMessage[]) {
  const items = messages.map((message) => {
      message.id ??= randomUUID();
      return { message, stored: serializeMessage(message) };
    }),
    existing = transcriptMessageRows(db, sessionId),
    changedAt = firstChangedIndex(existing, items),
    changed = changedAt !== items.length || changedAt !== existing.length;
  return {
    changed,
    position: changedAt,
    commit: () => {
      if (!changed) {
        return;
      }
      messageMutations(db).detach.run({ position: changedAt, sessionId });
      for (let position = changedAt; position < items.length; position += 1) {
        const item = items[position]!;
        storePreparedMessage(
          db,
          sessionId,
          { ...item.stored, tokenCount: messageTokenCount(item.message) },
          position,
          messageInputId(sessionId, item.message),
        );
      }
      pruneUnreferencedMessages(db, sessionId);
    },
    previous: existing.slice(changedAt).map((row) => decodeMessage(row.messageJson, row.sourceId)),
    updated: items.slice(changedAt).map((item) => item.message),
  };
}
function firstChangedIndex(
  existing: ReturnType<typeof transcriptMessageRows>,
  incoming: { stored: ReturnType<typeof serializeMessage> }[],
) {
  const length = Math.min(existing.length, incoming.length);
  for (let index = 0; index < length; index += 1) {
    const before = existing[index],
      after = incoming[index]?.stored;
    if (
      !before ||
      before.sourceId !== after?.sourceId ||
      before.messageJson !== after.messageJson
    ) {
      return index;
    }
  }
  return length;
}
