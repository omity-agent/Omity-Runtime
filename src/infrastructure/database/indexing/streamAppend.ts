import type { Database } from "bun:sqlite";

import { readWorkspaceRecord, touchSessionRecord } from "../records/session/metadata";
import { writeFileLinkSets } from "../records/transcript/matchedFiles";
import { insertStreamEvent } from "../records/transcript/streamEvents";
import type {
  PlainStreamEventDraft,
  StreamEvent,
  StreamEventDraft,
  TextStreamEventDraft,
} from "../schema/streamEvent";
import { runTransaction } from "../sqlite/connection";
import type { FileLinkIndexer } from "./surfaceIndexer";

interface StreamTarget {
  db: Database;
  notify?: (event: StreamEvent) => void;
  sessionId: string;
}
export function appendFileLinkStream(
  target: StreamTarget & { fileLinks: FileLinkIndexer },
  event: StreamEventDraft,
) {
  if (event.kind === "assistant_text_delta" || event.kind === "assistant_reasoning_delta") {
    return appendIndexedStream(target, event);
  }
  return appendPlainStreams(target, [event])[0]!;
}
export function appendPlainStreams(
  { db, notify, sessionId }: StreamTarget,
  events: readonly PlainStreamEventDraft[],
) {
  if (events.length === 0) {
    return [];
  }
  const inserted = runTransaction(db, () =>
    events.map((event) => {
      touchSessionRecord(db, sessionId);
      return insertStreamEvent(db, sessionId, event);
    }),
  );
  for (const event of inserted) {
    notify?.(event);
  }
  return inserted;
}
async function appendIndexedStream(
  { db, fileLinks, notify, sessionId }: StreamTarget & { fileLinks: FileLinkIndexer },
  event: TextStreamEventDraft,
) {
  const prepared = await fileLinks.prepareDelta({
      delta: event.value,
      inputId: event.inputId,
      ownerId: event.messageId,
      sessionId,
      surface: event.kind === "assistant_text_delta" ? "content" : "reasoning",
      workspace: readWorkspaceRecord(db, sessionId),
    }),
    inserted = runTransaction(db, () => {
      writeFileLinkSets(db, sessionId, prepared.links);
      const result = insertStreamEvent(
        db,
        sessionId,
        prepared.links.length === 0
          ? event
          : {
              ...event,
              fileLinks: prepared.links.map(({ matches, ownerId, surface }) => ({
                matches,
                ownerId,
                surface,
              })),
            },
      );
      touchSessionRecord(db, sessionId);
      return result;
    });
  prepared.commit();
  notify?.(inserted);
  return inserted;
}
