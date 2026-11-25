import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import type { PendingAttachment } from "../../../attachments/contract";
import { sendMessage } from "../client";
import { optimisticTimelineMessage, type OptimisticUser } from "./optimistic";
import { transcriptKey } from "./query";
import { stageQueuedInput, type TranscriptData } from "./reconciliation";

interface StagedUser extends OptimisticUser {
  accepted?: true;
}
export function useUserMessageSubmissions(
  sessionId: string | undefined,
  transcript: TranscriptData,
) {
  const queryClient = useQueryClient(),
    [staged, setStaged] = useState<StagedUser[]>([]),
    acknowledged = new Set(transcript.queue.map(({ submissionId }) => submissionId)),
    pending = staged.filter(
      (user) =>
        user.sessionId !== sessionId || !user.accepted || !acknowledged.has(user.submissionId),
    ),
    view = [
      ...transcript.view,
      ...pending.filter((user) => user.sessionId === sessionId).map(optimisticTimelineMessage),
    ];
  useEffect(() => {
    if (pending.length === staged.length) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      setStaged((current) => (current === staged ? pending : current));
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pending, staged]);
  const send = useCallback(
    async (optimistic: OptimisticUser, draftRevision: number, attachments: PendingAttachment[]) => {
      setStaged((current) => [...current, optimistic]);
      try {
        const { content, inputId } = await sendMessage(
          optimistic.sessionId,
          optimistic.content,
          draftRevision,
          optimistic.submissionId,
          attachments,
        );
        setStaged((current) =>
          current.map((user) => (user.key === optimistic.key ? { ...user, accepted: true } : user)),
        );
        queryClient.setQueryData<TranscriptData>(
          transcriptKey(optimistic.sessionId),
          (current) =>
            current &&
            stageQueuedInput(current, {
              content,
              error: null,
              id: inputId,
              status: "pending",
              submissionId: optimistic.submissionId,
              userMessageId: null,
            }),
        );
      } catch (error) {
        setStaged((current) => current.filter(({ key }) => key !== optimistic.key));
        throw error;
      }
    },
    [queryClient, setStaged],
  );
  return { send, view };
}
