import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

import { sessionNotFound } from "../failures/rejections";
import { resolveSessionPaths } from "../infrastructure/configuration/sessionPaths";
import { sessionOverviewRows } from "../infrastructure/database/projections/sessionOverview";
import { deriveSessionTitle } from "../infrastructure/database/records/transcript/messages/deriveTitle";
import { streamEventCursor } from "../infrastructure/database/records/transcript/streamEvents";
import { runTransaction } from "../infrastructure/database/sqlite/connection";

type SessionOverview = ReturnType<typeof sessionOverviewRows>[number];
export type RegisteredSession = SessionOverview & {
  title: string;
};
export class AppRegistry {
  private readonly sessions = new Map<string, RegisteredSession>();
  constructor(readonly db: Database) {}
  reload() {
    const { db } = this,
      sessions = runTransaction(db, () =>
        sessionOverviewRows(db)
          .filter((row) => existsSync(resolveSessionPaths(row.id).dir))
          .map((row) => toSession(db, row)),
      );
    this.sessions.clear();
    for (const session of sessions) {
      this.sessions.set(session.id, session);
    }
  }
  list() {
    return [...this.sessions.values()].toSorted(compareSessions);
  }
  require(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      throw sessionNotFound(id);
    }
    return session;
  }
  refresh(id: string) {
    const { db } = this,
      session = runTransaction(db, () => {
        const [row] = sessionOverviewRows(db, id);
        if (!row) {
          throw sessionNotFound(id);
        }
        return toSession(db, row);
      });
    this.sessions.set(id, session);
    return session;
  }
  read<T>(id: string, operation: (db: Database) => T): T {
    this.require(id);
    return operation(this.db);
  }
  eventCursor(id: string) {
    return this.read(id, streamEventCursor);
  }
  remove(id: string) {
    if (!this.sessions.delete(id)) {
      throw sessionNotFound(id);
    }
  }
}
function compareSessions(left: RegisteredSession, right: RegisteredSession) {
  return right.updatedAt - left.updatedAt || right.createdAt - left.createdAt;
}
function toSession(db: Database, row: SessionOverview): RegisteredSession {
  return { ...row, title: deriveSessionTitle(db, row.id) };
}
