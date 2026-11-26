import { AsyncQueuer } from "@tanstack/pacer/async-queuer";
import {
  focusManager,
  type QueryClient,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import type { DisplayEvent } from "../../../timeline";
import { uiBehavior } from "../../presentation/preferences";
import { contentEvents, loadTranscript } from "../client";
import { reportError } from "../errors";
import { readContentSyncEvent, readTranscriptEvent } from "../events/data";
import { subscribeEvents } from "../events/subscription";
import { FrameBatcher } from "../scheduling/frameBatcher";
import {
  appendTranscriptEvents,
  emptyTranscriptData,
  reconcileTranscript,
  type TranscriptData,
} from "./reconciliation";

export const transcriptKey = (sessionId: string) => ["transcript", sessionId] as const;
export function useSessionTranscript(
  sessionId: string | undefined,
  snapshotThrottleMs: number | undefined,
) {
  const queryClient = useQueryClient(),
    { data } = useQuery<TranscriptData>({
      queryFn: skipToken,
      queryKey: transcriptKey(sessionId ?? ""),
    });
  useEffect(
    () =>
      sessionId && snapshotThrottleMs !== undefined
        ? followTranscript(queryClient, sessionId, snapshotThrottleMs)
        : undefined,
    [queryClient, sessionId, snapshotThrottleMs],
  );
  return data ?? emptyTranscriptData;
}
function followTranscript(queryClient: QueryClient, sessionId: string, waitMs: number) {
  const key = transcriptKey(sessionId),
    controller = new AbortController(),
    { signal } = controller,
    deltas = new FrameBatcher<DisplayEvent>((batch) => {
      queryClient.setQueryData<TranscriptData>(key, (current) =>
        appendTranscriptEvents(current ?? emptyTranscriptData, batch),
      );
    }),
    snapshots = new AsyncQueuer<"snapshot">(
      async () => {
        const base = queryClient.getQueryData<TranscriptData>(key)?.messageHistory?.token,
          snapshot = await loadTranscript(sessionId, signal, base);
        if (!signal.aborted) {
          queryClient.setQueryData<TranscriptData>(key, (current) => {
            const offset = snapshot.messageHistory?.offset;
            return offset !== undefined && offset !== 0 && current?.messageHistory?.token !== base
              ? current
              : reconcileTranscript(snapshot, current);
          });
        }
      },
      {
        asyncRetryerOptions: {
          backoff: "exponential",
          baseWait: Math.max(waitMs, uiBehavior.transcriptRetry.minimumWaitMs),
          maxAttempts: uiBehavior.transcriptRetry.maxAttempts,
          maxWait: uiBehavior.transcriptRetry.maxWaitMs,
        },
        concurrency: 1,
        maxSize: 1,
        onError: (error) => {
          if (!signal.aborted) {
            reportError(error);
          }
        },
        wait: () => (signal.aborted ? 0 : waitMs),
      },
    ),
    requestSnapshot = () => {
      if (!snapshots.store.state.isFull) {
        snapshots.addItem("snapshot");
      }
    },
    disconnect = subscribeEvents(contentEvents(sessionId), {
      delta(event) {
        deltas.add(readTranscriptEvent(event));
      },
      sync(event) {
        const point = readContentSyncEvent(event),
          cached = queryClient.getQueryData<TranscriptData>(key);
        if (
          !cached ||
          cached.transcriptRevision < point.transcriptRevision ||
          cached.snapshotCursor < point.eventCursor
        ) {
          requestSnapshot();
        }
      },
    }),
    unfollowFocus = focusManager.subscribe((focused) => {
      if (focused) {
        requestSnapshot();
      }
    });
  requestSnapshot();
  return () => {
    disconnect();
    unfollowFocus();
    deltas.cancel();
    controller.abort();
    snapshots.stop();
    snapshots.clear();
    snapshots.abort();
  };
}
