import { mkdirSync } from "node:fs";

import { databasePath } from "../../infrastructure/configuration/sessionPaths";
import {
  availableSettingsProfiles,
  createSettingsContext,
  type SettingsContext,
} from "../../infrastructure/configuration/settings/context";
import { userDataDirectory } from "../../infrastructure/configuration/settings/files";
import { loadAppSettings } from "../../infrastructure/configuration/settings/load";
import { AgentDatabase } from "../../infrastructure/database/agentDatabase";
import { runTransaction } from "../../infrastructure/database/sqlite/connection";
import type { AppSettings } from "../../types";
import type { BootstrapResponse } from "../contracts/results";
import { AppRegistry } from "../registry";
import type { SessionInfo } from "../sessionState";

export interface ControllerOptions {
  settings?: AppSettings;
  settingsContext?: SettingsContext;
}
export function prepareController(root: string, options: ControllerOptions) {
  const settingsContext = options.settingsContext ?? createSettingsContext(root),
    settings = options.settings ?? loadAppSettings(settingsContext),
    directory = userDataDirectory();
  mkdirSync(directory, { recursive: true });
  const database = new AgentDatabase(databasePath(directory)),
    registry = new AppRegistry(database.db);
  try {
    registry.reload();
    runTransaction(database.db, () => {
      for (const session of registry.list()) {
        if (
          session.runStatus === "running" ||
          session.control === "cancel" ||
          session.control === "pause_cancel" ||
          session.control === "step"
        ) {
          database.recoverInterruptedSession(session.id);
          registry.refresh(session.id);
        }
      }
    });
    return { database, registry, settings, settingsContext };
  } catch (error) {
    database.close();
    throw error;
  }
}
export function bootstrapPayload(
  cwd: string,
  settings: AppSettings,
  context: SettingsContext,
  sessions: SessionInfo[],
): BootstrapResponse {
  return {
    attachments: settings.attachments,
    cwd,
    frontend: settings.frontend,
    profiles: { available: availableSettingsProfiles(context) },
    sessions,
  };
}
