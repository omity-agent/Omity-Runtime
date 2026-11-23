import { resolveSessionPaths } from "../../infrastructure/configuration/sessionPaths";
import {
  prioritizeSettingsProfile,
  type SettingsContext,
  settingsProfileNames,
} from "../../infrastructure/configuration/settings/context";
import { loadSettings } from "../../infrastructure/configuration/settings/load";
import { createSessionDefinition } from "../../infrastructure/database/session/sessionDefinition";
import { cleanupFailedInitialization } from "../../infrastructure/mcp/lifecycle";
import type { SessionSubmission } from "../attachments/contract";
import type { AppMcp } from "./resources/toolPool";
import { createAppSession } from "./sessionActions";

export async function createSnapshotSession(options: {
  baseContext: SettingsContext;
  mcp: AppMcp;
  root: string;
  submission: SessionSubmission;
}) {
  const settingsContext = prioritizeSettingsProfile(
      options.baseContext,
      options.submission.profile,
    ),
    profiles = settingsProfileNames(settingsContext);
  let reservedSessionId: string | undefined;
  try {
    return await createAppSession(
      options.root,
      options.submission,
      profiles,
      (sessionId, workspace) => {
        reservedSessionId = sessionId;
        return captureSessionSnapshot({
          mcp: options.mcp,
          profiles,
          root: options.root,
          sessionId,
          settingsContext,
          submission: options.submission,
          workspace,
        });
      },
    );
  } catch (error) {
    return cleanupFailedInitialization(error, () =>
      reservedSessionId ? options.mcp.discardSession(reservedSessionId) : undefined,
    );
  }
}
async function captureSessionSnapshot(options: {
  mcp: AppMcp;
  profiles: string[];
  root: string;
  sessionId: string;
  settingsContext: SettingsContext;
  submission: SessionSubmission;
  workspace: string;
}) {
  const { builtInOverrides, hookOverrides, mcpOverrides, model } = options.submission,
    configured = loadSettings(options.root, {
      cwd: options.workspace,
      sessionId: options.sessionId,
      settingsContext: options.settingsContext,
    }),
    settings = {
      ...configured,
      model: { ...configured.model, model: model ?? configured.model.model },
    },
    mcp = await options.mcp.createSession(options.sessionId, options.profiles, options.workspace, {
      builtInOverrides,
      serverOverrides: mcpOverrides,
    }),
    definition = createSessionDefinition(
      settings,
      mcp,
      {
        cwd: options.workspace,
        session: resolveSessionPaths(options.sessionId).dir,
      },
      { hooks: hookOverrides, servers: mcpOverrides },
    );
  return { definition, settings };
}
