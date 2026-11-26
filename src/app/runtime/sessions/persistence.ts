import {
  resolveSessionPaths,
  sessionPaths,
} from "../../../infrastructure/configuration/sessionPaths";
import type { AgentDatabase } from "../../../infrastructure/database/agentDatabase";
import { UserMessageArchive } from "../../../infrastructure/database/session/archive";
import { initializeConversation } from "../../../infrastructure/database/session/initialConversation";
import {
  emptySessionDefinition,
  type SessionDefinition,
} from "../../../infrastructure/database/session/sessionDefinition";
import {
  removeDatabaseDirectory,
  runTransaction,
} from "../../../infrastructure/database/sqlite/connection";
import { initialHistory, type InitialMessagePair } from "../../initialState";
import { forkConversation } from "./branch";

export function createSessionStorage(
  database: AgentDatabase,
  sessionId: string,
  workspace: string,
  profiles: string[],
  history: InitialMessagePair[],
  message: string,
  definition: SessionDefinition = emptySessionDefinition(),
) {
  initializeSessionStorage(database, sessionId, () => {
    database.createSession(sessionId, workspace, profiles, definition);
    initializeConversation(database.db, sessionId, initialHistory(history), message);
    return [...history.map(({ user }) => user), message];
  });
}
export function forkSessionStorage(
  database: AgentDatabase,
  options: Parameters<typeof forkConversation>[1],
) {
  initializeSessionStorage(database, options.targetSessionId, () =>
    forkConversation(database.db, options),
  );
}
export function deleteStoredSession(database: AgentDatabase, sessionId: string) {
  database.deleteSession(sessionId);
  removeDatabaseDirectory(resolveSessionPaths(sessionId).dir);
}
function initializeSessionStorage(
  database: AgentDatabase,
  sessionId: string,
  initialize: () => readonly string[],
) {
  const paths = sessionPaths(sessionId);
  try {
    runTransaction(
      database.db,
      () => {
        const messages = initialize();
        new UserMessageArchive(paths.userMessagesDir).writeAll(messages);
      },
      "immediate",
    );
  } catch (error) {
    if (!database.hasSession(sessionId)) {
      removeDatabaseDirectory(paths.dir);
    }
    throw error;
  }
}
