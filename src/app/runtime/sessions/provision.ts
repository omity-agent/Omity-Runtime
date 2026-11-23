import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { hasErrorCode } from "../../../failures/thrownValues";
import { resolveSessionPaths } from "../../../infrastructure/configuration/sessionPaths";
import {
  prioritizeSettingsProfile,
  type SettingsContext,
  settingsProfileNames,
} from "../../../infrastructure/configuration/settings/context";
import { userDataDirectory } from "../../../infrastructure/configuration/settings/files";
import { loadSettings } from "../../../infrastructure/configuration/settings/load";
import { normalizeWorkspacePath } from "../../../infrastructure/configuration/workspacePath";
import { createSessionDefinition } from "../../../infrastructure/database/session/sessionDefinition";
import { removeDatabaseDirectory } from "../../../infrastructure/database/sqlite/connection";
import { claimShortIdAsync } from "../../../infrastructure/randomId";
import { deleteStoredSession } from "../../../storedSessions";
import type { SessionSubmission } from "../../attachments/contract";
import { createSessionWithAttachments } from "../../attachments/session";
import { clearPreparationDraft } from "../../composition/draftStorage";
import type { AppMcp } from "../resources/toolPool";
import { forkSessionStorage } from "./persistence";

export function provisionAppSession({
  baseContext,
  mcp,
  root,
  submission,
}: {
  baseContext: SettingsContext;
  mcp: AppMcp;
  root: string;
  submission: SessionSubmission;
}) {
  const settingsContext = prioritizeSettingsProfile(baseContext, submission.profile),
    profiles = settingsProfileNames(settingsContext),
    workspace = normalizeWorkspacePath(submission.workspace, root);
  return withReservedSession(async (sessionId, rollback) => {
    const { builtInOverrides, hookOverrides, mcpOverrides, model } = submission,
      configured = loadSettings(root, { cwd: workspace, sessionId, settingsContext }),
      settings = {
        ...configured,
        model: { ...configured.model, model: model ?? configured.model.model },
      },
      tools = await mcp.createSession(sessionId, profiles, workspace, {
        builtInOverrides,
        serverOverrides: mcpOverrides,
      });
    rollback.defer(() => mcp.discardSession(sessionId));
    const definition = createSessionDefinition(
      settings,
      tools,
      { cwd: workspace, session: resolveSessionPaths(sessionId).dir },
      { hooks: hookOverrides, servers: mcpOverrides },
    );
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
    rollback.defer(() => deleteStoredSession(sessionId));
    if (submission.draftRevision !== undefined) {
      clearPreparationDraft(submission.draftRevision);
    }
    return { sessionId, workspace };
  });
}
export function materializeAppFork({
  pauseSource,
  ...source
}: Omit<Parameters<typeof forkSessionStorage>[0], "targetSessionId"> & {
  pauseSource: () => Promise<unknown>;
}) {
  return withReservedSession(async (targetSessionId, rollback) => {
    forkSessionStorage({ ...source, targetSessionId });
    rollback.defer(() => deleteStoredSession(targetSessionId));
    await pauseSource();
    return targetSessionId;
  });
}
async function withReservedSession<Result>(
  initialize: (sessionId: string, rollback: AsyncDisposableStack) => Promise<Result>,
) {
  await using rollback = new AsyncDisposableStack();
  const sessionId = await reserveSessionId();
  rollback.defer(() => removeDatabaseDirectory(resolveSessionPaths(sessionId).dir));
  const result = await initialize(sessionId, rollback);
  rollback.move();
  return result;
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
