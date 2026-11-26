import type { Database } from "bun:sqlite";

import {
  prioritizeSettingsProfile,
  selectSettingsProfiles,
  type SettingsContext,
  settingsProfileNames,
} from "../../../infrastructure/configuration/settings/context";
import { loadSettings } from "../../../infrastructure/configuration/settings/load";
import { readDefinitionRecord } from "../../../infrastructure/database/records/session/metadata";
import { writeSessionConfigurationRecord } from "../../../infrastructure/database/records/session/sessionConfiguration";
import { refreshSessionDefinition } from "../../../infrastructure/database/session/sessionDefinition";
import type { RegisteredSession } from "../../registry";

export function storeSessionProfile(
  db: Database,
  root: string,
  baseContext: SettingsContext,
  session: Pick<RegisteredSession, "id" | "profiles" | "workspace">,
  profile?: string,
) {
  const settingsContext =
      profile === undefined
        ? baseContext
        : prioritizeSettingsProfile(selectSettingsProfiles(baseContext, session.profiles), profile),
    settings = loadSettings(root, {
      cwd: session.workspace,
      sessionId: session.id,
      settingsContext,
    }),
    definition = refreshSessionDefinition(settings, readDefinitionRecord(db, session.id));
  writeSessionConfigurationRecord(
    db,
    session.id,
    settingsProfileNames(settingsContext),
    definition,
  );
}
