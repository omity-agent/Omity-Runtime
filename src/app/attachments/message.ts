import { submitSessionMessage } from "../../client";
import type { Settings } from "../../types";
import type { PendingAttachment } from "./contract";
import { saveAttachments } from "./storage";

export async function enqueueMessageWithAttachments(
  settings: Settings,
  sessionId: string,
  content: string,
  draftRevision: number,
  submissionId: string,
  attachments: PendingAttachment[],
  ensureHost: () => Promise<void>,
) {
  const saved = await saveAttachments(settings, sessionId, [content], attachments);
  try {
    const resolved = saved.rewrite(content);
    await ensureHost();
    const result = submitSessionMessage(sessionId, resolved, draftRevision, submissionId);
    return { ...result, content: resolved };
  } catch (error) {
    await saved.discard();
    throw error;
  }
}
