import { replaceEqualDeep } from "@tanstack/react-query";
import { keyBy, sortBy } from "es-toolkit";

import type { FileLinkSet } from "../../../../fileLinks/types";
import {
  buildTimeline,
  type DisplayEvent,
  type DisplayQueue,
  type TimelineMessage,
} from "../../../timeline";
import type { TranscriptSnapshot } from "../../../timeline/contracts/records";

export interface TranscriptData extends TranscriptSnapshot {
  snapshotCursor: number;
  view: TimelineMessage[];
}
export const emptyTranscriptData: TranscriptData = {
  control: "running",
  eventCursor: 0,
  events: [],
  fileLinks: [],
  messages: [],
  queue: [],
  reasoningTranslations: [],
  snapshotCursor: 0,
  transcriptRevision: 0,
  view: [],
};
export function reconcileTranscript(
  snapshot: TranscriptSnapshot,
  current?: TranscriptData,
): TranscriptData {
  if (
    current &&
    (snapshot.transcriptRevision < current.transcriptRevision ||
      snapshot.eventCursor < current.snapshotCursor)
  ) {
    return current;
  }
  const replay = current?.events.filter((event) => event.id > snapshot.eventCursor) ?? [],
    events = mergeEventBatches(snapshot.events, replay),
    replayLinks = replay.flatMap((event) => event.fileLinks ?? []);
  return buildTranscript(
    {
      ...snapshot,
      eventCursor: Math.max(snapshot.eventCursor, current?.eventCursor ?? 0),
      events,
      fileLinks: mergeFileLinks(snapshot.fileLinks, replayLinks),
    },
    current,
    snapshot.eventCursor,
  );
}
export function appendTranscriptEvents(current: TranscriptData, incoming: DisplayEvent[]) {
  const accepted = incoming.filter((event) => event.id > current.snapshotCursor),
    events = mergeEventBatches(current.events, accepted);
  if (events.length === current.events.length) {
    return current;
  }
  return buildTranscript(
    {
      ...current,
      eventCursor: Math.max(current.eventCursor, events.at(-1)?.id ?? 0),
      events,
      fileLinks: mergeFileLinks(
        current.fileLinks,
        accepted.flatMap((event) => event.fileLinks ?? []),
      ),
    },
    current,
    current.snapshotCursor,
  );
}
export function stageQueuedInput(current: TranscriptData, input: DisplayQueue) {
  if (current.queue.some(({ id }) => id === input.id)) {
    return current;
  }
  return buildTranscript(
    { ...current, queue: [...current.queue, input] },
    current,
    current.snapshotCursor,
  );
}
function buildTranscript(
  snapshot: TranscriptSnapshot,
  current: TranscriptData | undefined,
  snapshotCursor: number,
): TranscriptData {
  const view = buildTimeline(snapshot);
  return {
    ...snapshot,
    snapshotCursor,
    view: current ? replaceEqualDeep(current.view, view) : view,
  };
}
function mergeFileLinks(left: FileLinkSet[], right: FileLinkSet[]) {
  return right.length === 0
    ? left
    : Object.values(keyBy([...left, ...right], (link) => `${link.ownerId}\0${link.surface}`));
}
function mergeEventBatches(current: DisplayEvent[], incoming: DisplayEvent[]) {
  if (incoming.length === 0) {
    return current;
  }
  return incoming.every(
    (event, index) =>
      event.id > (index === 0 ? (current.at(-1)?.id ?? 0) : incoming[index - 1]!.id),
  )
    ? [...current, ...incoming]
    : sortBy(Object.values(keyBy([...current, ...incoming], ({ id }) => id)), [({ id }) => id]);
}
