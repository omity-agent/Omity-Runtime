import type { Database } from "bun:sqlite";

import { type BaseMessage, HumanMessage } from "@langchain/core/messages";

import { messageFileLinkSources } from "../../../fileLinks/messageSources";
import { clearCompletedCancellations } from "../records/execution/toolCancellations";
import { touchSessionRecord } from "../records/session/metadata";
import {
  clearMessageLinks,
  clearStreamLinks,
  writeFileLinkSets,
} from "../records/transcript/matchedFiles";
import { prepareMessageSync } from "../records/transcript/messages/sync";
import { finishToolStreams } from "../records/transcript/toolCompletion";
import { runTransaction } from "../sqlite/connection";
import type { FileLinkIndexer } from "./surfaceIndexer";

export async function syncIndexedHistory(options: {
  db: Database;
  fileLinks: FileLinkIndexer;
  messages: BaseMessage[];
  sessionId: string;
  workspace: string;
}) {
  const history = prepareMessageSync(options.db, options.sessionId, options.messages),
    prepared = await options.fileLinks.prepareHistory({ ...options, updated: history.updated }),
    obsoleteOwners = messageFileLinkSources(history.previous).map((source) => source.ownerId),
    finished = runTransaction(options.db, () => {
      history.commit();
      clearMessageLinks(
        options.db,
        options.sessionId,
        prepared.replaceAll ? undefined : obsoleteOwners,
      );
      const clearedLinks = clearStreamLinks(options.db, options.sessionId);
      writeFileLinkSets(options.db, options.sessionId, prepared.links);
      const streams = finishToolStreams(options.db, options.sessionId, options.messages);
      clearCompletedCancellations(options.db, options.sessionId, options.messages);
      if (history.changed || streams.changed || clearedLinks > 0) {
        touchSessionRecord(options.db, options.sessionId);
      }
      return streams.events;
    });
  prepared.commit();
  return {
    finished,
    position: history.changed ? history.position : undefined,
    userMessagesChanged:
      history.previous.some((message) => HumanMessage.isInstance(message)) ||
      history.updated.some((message) => HumanMessage.isInstance(message)),
  };
}
