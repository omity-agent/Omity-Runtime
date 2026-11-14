import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { hasErrorCode } from "../../failures/thrownValues";
import { userDataDirectory } from "../../infrastructure/configuration/settings/files";
import { normalizeWorkspacePath } from "../../infrastructure/configuration/workspacePath";
import type { SessionDefinition } from "../../infrastructure/database/session/sessionDefinition";
import { claimShortIdAsync } from "../../infrastructure/randomId";
import type { Settings } from "../../types";
import type { SessionSubmission } from "../attachments/contract";
import { createSessionWithAttachments } from "../attachments/session";
import { clearPreparationDraft } from "../composition/draftStorage";
import { forkSessionStorage, removeSessionStorage } from "./sessionStorage";

export async function createAppSession(
  appRoot: string,
  submission: SessionSubmission,
  profiles: string[],
  prepare: (
    sessionId: string,
    workspace: string,
  ) => Promise<{ definition: SessionDefinition; settings: Settings }>,
) {
  const workspace = normalizeWorkspacePath(submission.workspace, appRoot),
    sessionId = await reserveSessionId();
  try {
    const { definition, settings } = await prepare(sessionId, workspace);
    await createSessionWithAttachments({
      attachments: submission.attachments,
      definition,
      history: submission.history,
      message: submission.message,
      profiles,
      sessionId,
      settings,
      workspace,
    });
    if (submission.draftRevision !== undefined) {
      clearPreparationDraft(submission.draftRevision);
    }
  } catch (error) {
    removeSessionStorage(sessionId);
    throw error;
  }
  return { sessionId, workspace };
}
export async function materializeAppFork(options: {
  beforeMessageId: number;
  pauseSource: () => Promise<unknown>;
  sourceSessionId: string;
  workspace: string;
  profiles: string[];
}) {
  const targetSessionId = await reserveSessionId();
  let targetCreated = false;
  try {
    forkSessionStorage({
      beforeMessageId: options.beforeMessageId,
      profiles: options.profiles,
      sourceSessionId: options.sourceSessionId,
      targetSessionId,
      workspace: options.workspace,
    });
    targetCreated = true;
    await options.pauseSource();
  } catch (error) {
    if (targetCreated) {
      removeSessionStorage(targetSessionId);
    }
    throw error;
  }
  return targetSessionId;
}
async function reserveSessionId() {
  const sessionsDir = resolve(userDataDirectory(), "sessions");
  await mkdir(sessionsDir, { recursive: true });
  return claimShortIdAsync(async (id) => {
    try {
      await mkdir(resolve(sessionsDir, id));
      return true;
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) {
        return false;
      }
      throw error;
    }
  });
}
