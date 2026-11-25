import type { TimelineMessage } from "../../../timeline";
import { composerDraftKey, type ComposerDraftTarget } from "../composerDrafts";
import { optimisticTimelineMessage, type OptimisticUser } from "./optimistic";
import { usePendingFork } from "./pendingFork";
import { useSessionTranscript } from "./query";
import { useUserMessageSubmissions } from "./submissions";

function previewFork(
  view: TimelineMessage[],
  beforeMessageId: number,
  pendingMessage: OptimisticUser | null,
) {
  const index = view.findIndex(
    (message) => message.id === beforeMessageId && message.role === "user",
  );
  return {
    draft: index === -1 ? undefined : view[index]?.content,
    view:
      index === -1
        ? []
        : [
            ...view.slice(0, index),
            ...(pendingMessage ? [optimisticTimelineMessage(pendingMessage)] : []),
          ],
  };
}
export function useForkableTranscript({
  activeSessionId,
  captureNavigation,
  navigate,
  page,
  snapshotThrottleMs,
  sourceSessionId,
}: Omit<Parameters<typeof usePendingFork>[0], "submit"> & {
  activeSessionId?: string;
  snapshotThrottleMs?: number;
  sourceSessionId?: string;
}) {
  const transcript = useSessionTranscript(sourceSessionId, snapshotThrottleMs),
    draftTarget: ComposerDraftTarget =
      page ?? (activeSessionId ? { kind: "session", sessionId: activeSessionId } : { kind: "new" }),
    submissions = useUserMessageSubmissions(
      page ? composerDraftKey(page) : activeSessionId,
      transcript,
    ),
    { busy, ...flow } = usePendingFork({
      captureNavigation,
      navigate,
      page,
      submit: submissions.send,
    }),
    pendingPreview = page
      ? previewFork(submissions.view, page.beforeMessageId, flow.pendingMessage)
      : undefined;
  return { busy, draftTarget, flow, pendingPreview, submissions };
}
