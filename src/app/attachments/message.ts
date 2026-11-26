import type { Settings } from "../../types";
import type { MessageSubmission } from "./contract";
import { withSavedAttachments } from "./uploads";

export function enqueueMessageWithAttachments(
  settings: Settings["attachments"],
  sessionId: string,
  { attachments, content, draftRevision, submissionId }: MessageSubmission,
  submit: (content: string, draftRevision: number, submissionId: string) => Promise<number>,
) {
  return withSavedAttachments(settings, sessionId, [content], attachments, async (rewrite) => {
    const resolved = rewrite(content);
    const inputId = await submit(resolved, draftRevision, submissionId);
    return { content: resolved, inputId };
  });
}
