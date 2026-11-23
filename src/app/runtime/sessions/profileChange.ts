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
import { openStoredSession } from "../../../storedSessions";
import type { RegisteredSession } from "../../registry";

export function storeSessionProfile(
  root: string,
  baseContext: SettingsContext,
  session: Pick<RegisteredSession, "id" | "profiles" | "workspace">,
  profile?: string,
) {
  using database = openStoredSession(session.id);
  const settingsContext =
      profile === undefined
        ? baseContext
        : prioritizeSettingsProfile(selectSettingsProfiles(baseContext, session.profiles), profile),
    settings = loadSettings(root, {
      cwd: session.workspace,
      sessionId: session.id,
      settingsContext,
    }),
    definition = refreshSessionDefinition(settings, readDefinitionRecord(database.db, session.id));
  writeSessionConfigurationRecord(
    database.db,
    session.id,
    settingsProfileNames(settingsContext),
    definition,
  );
}
