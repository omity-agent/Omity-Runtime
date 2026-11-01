import { existsSync } from "node:fs";

import {
  databasePath,
  resolveSessionPaths,
  sessionPaths,
} from "../../infrastructure/configuration/sessionPaths";
import { AgentDatabase } from "../../infrastructure/database/agentDatabase";
import { UserMessageArchive } from "../../infrastructure/database/session/archive";
import { initializeConversation } from "../../infrastructure/database/session/initialConversation";
import {
  emptySessionDefinition,
  type SessionDefinition,
} from "../../infrastructure/database/session/sessionDefinition";
import {
  removeDatabaseDirectory,
  runTransaction,
} from "../../infrastructure/database/sqlite/connection";
import { openStoredSession } from "../../storedSessions";
import { forkDatabaseBeforeMessage } from "../fork";
import { initialHistory, type InitialMessagePair } from "../initialState";

export function createSessionStorage(
  sessionId: string,
  workspace: string,
  profiles: string[],
  history: InitialMessagePair[],
  message: string,
  definition: SessionDefinition = emptySessionDefinition(),
) {
  initializeSessionStorage(sessionId, (db) => {
    db.createSession(sessionId, workspace, profiles, definition);
    initializeConversation(db.db, sessionId, initialHistory(history), message);
    return [...history.map(({ user }) => user), message];
  });
}
export function forkSessionStorage({
  sourceSessionId,
  targetSessionId,
  workspace,
  profiles,
  beforeMessageId,
}: {
  sourceSessionId: string;
  targetSessionId: string;
  workspace: string;
  profiles: string[];
  beforeMessageId: number;
}) {
  initializeSessionStorage(targetSessionId, (target) => {
    using source = openStoredSession(sourceSessionId);
    return forkDatabaseBeforeMessage({
      beforeMessageId,
      profiles,
      source,
      sourceSessionId,
      target,
      targetSessionId,
      workspace,
    });
  });
}
export function removeSessionStorage(sessionId: string) {
  const paths = resolveSessionPaths(sessionId);
  if (existsSync(paths.dbPath)) {
    using db = new AgentDatabase(databasePath());
    if (db.hasSession(sessionId)) {
      db.deleteSession(sessionId);
    }
  }
  removeDatabaseDirectory(paths.dir);
}
function initializeSessionStorage(
  sessionId: string,
  initialize: (db: AgentDatabase) => readonly string[],
) {
  const paths = sessionPaths(sessionId);
  using db = new AgentDatabase(paths.dbPath);
  try {
    runTransaction(db.db, () => {
      const messages = initialize(db);
      new UserMessageArchive(paths.userMessagesDir).writeAll(messages);
    });
  } catch (error) {
    if (!db.hasSession(sessionId)) {
      removeDatabaseDirectory(paths.dir);
    }
    throw error;
  }
}
