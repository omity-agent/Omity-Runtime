import type { Database } from "bun:sqlite";

import {
  clearPreparationDraftRecord,
  readComposerDraftRecord,
  readPreparationDraftRecord,
  writeComposerDraftRecord,
  writePreparationDraftRecord,
} from "../../infrastructure/database/records/session/composerDrafts";
import { runTransaction } from "../../infrastructure/database/sqlite/connection";
import type { AppRegistry } from "../registry";
import { parsePreparation } from "./draftInput";
import { emptyPreparation } from "./preparation";

export class DraftStorage {
  constructor(private readonly registry: AppRegistry) {}
  session(sessionId: string) {
    return this.registry.read(sessionId, (db) => readComposerDraftRecord(db, sessionId));
  }
  saveSession(sessionId: string, content: string, revision: number) {
    return this.registry.read(sessionId, (db) =>
      writeComposerDraftRecord(db, sessionId, content, revision),
    );
  }
  preparation() {
    return readPreparationDraftRecord(this.registry.db);
  }
  savePreparation(content: string, revision: number) {
    return writePreparationDraftRecord(this.registry.db, content, revision);
  }
}
export function clearPreparationDraft(db: Database, revision: number) {
  runTransaction(db, () => {
    const { content } = readPreparationDraftRecord(db),
      preferences = content === null ? undefined : parsePreparation(content);
    clearPreparationDraftRecord(db, JSON.stringify(emptyPreparation(preferences)), revision);
  });
}
