import {
  selectSettingsProfiles,
  type SettingsContext,
} from "../../infrastructure/configuration/settings/context";
import {
  loadMainSettings,
  loadModelSettings,
} from "../../infrastructure/configuration/settings/load";
import {
  readDefinitionRecord,
  readProfilesRecord,
} from "../../infrastructure/database/records/session/metadata";
import { restoreSessionModel } from "../../infrastructure/database/session/sessionDefinition";
import { runTransaction } from "../../infrastructure/database/sqlite/connection";
import type { AppRegistry } from "../registry";
import { PredictionService } from "./service";

export function createSessionPredictions(registry: AppRegistry, baseContext: SettingsContext) {
  return new PredictionService((sessionId) =>
    registry.read(sessionId, (db) =>
      runTransaction(db, () => {
        const context = selectSettingsProfiles(baseContext, readProfilesRecord(db, sessionId)),
          model = restoreSessionModel(
            loadModelSettings(context),
            readDefinitionRecord(db, sessionId).prefix.model,
          );
        return loadMainSettings(context, model).prediction;
      }),
    ),
  );
}
