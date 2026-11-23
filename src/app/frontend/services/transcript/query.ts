import { AsyncThrottler } from "@tanstack/pacer/async-throttler";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
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
    queryKey = transcriptKey(sessionId ?? ""),
    query = useQuery({
      queryFn:
        sessionId === undefined
          ? skipToken
          : async ({ signal }) =>
              reconcileTranscript(
                await loadTranscript(sessionId, signal),
                queryClient.getQueryData<TranscriptData>(queryKey),
              ),
      queryKey,
    });
  useEffect(() => {
    if (!sessionId || snapshotThrottleMs === undefined) {
      return;
    }
    const key = transcriptKey(sessionId),
      controller = new AbortController(),
      { signal } = controller,
      deltas = new FrameBatcher<DisplayEvent>((batch) => {
        queryClient.setQueryData<TranscriptData>(key, (current) =>
          appendTranscriptEvents(current ?? emptyTranscriptData, batch),
        );
      }),
      refresh = new AsyncThrottler(
        async () => {
          const snapshot = await loadTranscript(sessionId, signal);
          if (!signal.aborted) {
            queryClient.setQueryData<TranscriptData>(key, (current) =>
              reconcileTranscript(snapshot, current),
            );
          }
        },
        {
          asyncRetryerOptions: {
            backoff: "exponential",
            baseWait: Math.max(snapshotThrottleMs, uiBehavior.transcriptRetry.minimumWaitMs),
            maxAttempts: uiBehavior.transcriptRetry.maxAttempts,
            maxWait: uiBehavior.transcriptRetry.maxWaitMs,
          },
          onError: (error) => {
            if (!signal.aborted) {
              reportError(error);
            }
          },
          wait: snapshotThrottleMs,
        },
      ),
      close = subscribeEvents(contentEvents(sessionId), {
        delta(event) {
          deltas.add(readTranscriptEvent(event));
        },
        sync(event) {
          readContentSyncEvent(event);
          void refresh.maybeExecute();
        },
      });
    return () => {
      close();
      deltas.cancel();
      controller.abort();
      refresh.setOptions({ enabled: false });
      refresh.abort();
    };
  }, [queryClient, sessionId, snapshotThrottleMs]);
  return query.data ?? emptyTranscriptData;
}
