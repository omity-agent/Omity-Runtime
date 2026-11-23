import { submitSessionMessage } from "../../client";
import type { Settings } from "../../types";
import type { MessageSubmission } from "./contract";
import { withSavedAttachments } from "./uploads";

export function enqueueMessageWithAttachments(
  settings: Settings["attachments"],
  sessionId: string,
  { attachments, content, draftRevision, submissionId }: MessageSubmission,
  ensureHost: () => Promise<void>,
) {
  return withSavedAttachments(settings, sessionId, [content], attachments, async (rewrite) => {
    const resolved = rewrite(content);
    await ensureHost();
    const result = submitSessionMessage(sessionId, resolved, draftRevision, submissionId);
    return { ...result, content: resolved };
  });
}
