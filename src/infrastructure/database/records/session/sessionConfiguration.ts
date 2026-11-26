import type { Database } from "bun:sqlite";

import { and, eq, exists, not } from "drizzle-orm";

import { sessionProfileBusy } from "../../../../failures/rejections";
import { runs, sessions } from "../../schema";
import type { SessionDefinition } from "../../session/sessionDefinition";
import { runTransaction, sessionDatabase } from "../../sqlite/connection";
import { requireSessionRecord, touchSessionRecord } from "./metadata";

export function writeSessionConfigurationRecord(
  db: Database,
  sessionId: string,
  profiles: readonly string[],
  definition: SessionDefinition,
) {
  runTransaction(db, () => {
    requireSessionRecord(db, sessionId);
    const orm = sessionDatabase(db),
      running = orm
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.sessionId, sessionId), eq(runs.status, "running"))),
      updated = orm
        .update(sessions)
        .set({ definition, profiles: [...profiles] })
        .where(and(eq(sessions.id, sessionId), not(exists(running))))
        .run();
    if (updated.changes !== 1) {
      throw sessionProfileBusy(sessionId);
    }
    touchSessionRecord(db, sessionId);
  });
}
