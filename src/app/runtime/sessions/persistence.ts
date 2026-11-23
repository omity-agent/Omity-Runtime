import { sessionPaths } from "../../../infrastructure/configuration/sessionPaths";
import { AgentDatabase } from "../../../infrastructure/database/agentDatabase";
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
export function forkSessionStorage(options: Parameters<typeof forkConversation>[1]) {
  initializeSessionStorage(options.targetSessionId, ({ db }) => forkConversation(db, options));
}
function initializeSessionStorage(
  sessionId: string,
  initialize: (db: AgentDatabase) => readonly string[],
) {
  const paths = sessionPaths(sessionId);
  using db = new AgentDatabase(paths.dbPath);
  try {
    runTransaction(
      db.db,
      () => {
        const messages = initialize(db);
        new UserMessageArchive(paths.userMessagesDir).writeAll(messages);
      },
      "immediate",
    );
  } catch (error) {
    if (!db.hasSession(sessionId)) {
      removeDatabaseDirectory(paths.dir);
    }
    throw error;
  }
}
