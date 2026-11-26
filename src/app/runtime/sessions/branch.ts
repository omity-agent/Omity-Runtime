import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

import { HumanMessage } from "@langchain/core/messages";
import { and, eq, lt, sql } from "drizzle-orm";

import { DomainError } from "../../../failures/domain";
import { copyHookUsage } from "../../../hooks/storage/usage";
import { localize } from "../../../i18n/server";
import { createRunRecord } from "../../../infrastructure/database/records/execution/runs/mutations";
import { writeComposerDraftRecord } from "../../../infrastructure/database/records/session/composerDrafts";
import {
  createSessionRecord,
  readDefinitionRecord,
} from "../../../infrastructure/database/records/session/metadata";
import {
  inputMessageId,
  storeMessage,
} from "../../../infrastructure/database/records/transcript/messages/history";
import { decodeMessage } from "../../../infrastructure/database/records/transcript/messages/hydration";
import { inputs, messages } from "../../../infrastructure/database/schema";
import { sessionDatabase } from "../../../infrastructure/database/sqlite/connection";
import { contentToText } from "../../../runtime/content";

const messageJson = sql<string>`${messages.message}`;
export function forkConversation(
  db: Database,
  {
    beforeMessageId,
    profiles,
    sourceSessionId,
    targetSessionId,
    workspace,
  }: {
    beforeMessageId: number;
    profiles: string[];
    sourceSessionId: string;
    targetSessionId: string;
    workspace: string;
  },
) {
  const orm = sessionDatabase(db),
    definition = readDefinitionRecord(db, sourceSessionId),
    point = readForkPoint(db, sourceSessionId, beforeMessageId),
    history = orm
      .select({ createdAt: messages.createdAt, messageJson })
      .from(messages)
      .where(and(eq(messages.sessionId, sourceSessionId), lt(messages.position, point.position)))
      .orderBy(messages.position)
      .all()
      .map((row) => ({ createdAt: row.createdAt, message: decodeMessage(row.messageJson) }));
  createSessionRecord(db, targetSessionId, workspace, profiles, definition, "pause");
  const userMessages = seedBranch(db, targetSessionId, history);
  copyHookUsage(db, sourceSessionId, targetSessionId);
  writeComposerDraftRecord(db, targetSessionId, point.content, 0);
  return userMessages;
}
function readForkPoint(db: Database, sessionId: string, messageId: number) {
  if (!Number.isSafeInteger(messageId) || messageId <= 0) {
    throw new Error(
      localize("application:fork.messageIdInvalid", { messageId: messageId.toString() }),
    );
  }
  const row = sessionDatabase(db)
    .select({ messageJson, position: messages.position })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.id, messageId)))
    .get();
  if (row?.position == null) {
    throw new DomainError(
      "FORK_MESSAGE_NOT_FOUND",
      localize("application:fork.messageMissing", { messageId: messageId.toString() }),
    );
  }
  const message = decodeMessage(row.messageJson);
  if (!HumanMessage.isInstance(message)) {
    throw new Error(localize("application:fork.userMessageRequired"));
  }
  return { content: contentToText(message.content), position: row.position };
}
function seedBranch(
  db: Database,
  sessionId: string,
  history: { createdAt: number; message: ReturnType<typeof decodeMessage> }[],
) {
  const lastUserIndex = history.findLastIndex(({ message }) => HumanMessage.isInstance(message)),
    lastUser = history[lastUserIndex]?.message;
  if (!lastUser) {
    throw new Error(localize("application:fork.userInputMissing"));
  }
  const runId = createRunRecord(db, sessionId, "paused"),
    inputId = sessionDatabase(db)
      .insert(inputs)
      .values({
        content: contentToText(lastUser.content),
        delivery: "consumed",
        ordinal: 0,
        runId,
        sessionId,
      })
      .returning({ id: inputs.id })
      .get().id,
    userMessages: string[] = [];
  for (const [position, { createdAt, message }] of history.entries()) {
    const continuation = position === lastUserIndex;
    message.id = continuation ? inputMessageId(sessionId, inputId) : randomUUID();
    storeMessage(db, sessionId, message, position, continuation ? inputId : undefined, createdAt);
    if (HumanMessage.isInstance(message)) {
      userMessages.push(contentToText(message.content));
    }
  }
  return userMessages;
}
