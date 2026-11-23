import type { Database } from "bun:sqlite";

import { sql } from "drizzle-orm";

import { hookUsage } from "../../infrastructure/database/schema";
import { sessionDatabase } from "../../infrastructure/database/sqlite/connection";

export function consumeHookUsage(
  db: Database,
  sessionId: string,
  hookId: string,
  limit: number,
): boolean {
  if (limit === -1) {
    return true;
  }
  if (limit === 0) {
    return false;
  }
  return Boolean(
    sessionDatabase(db)
      .insert(hookUsage)
      .values({ hookId, sessionId, usedCount: 1 })
      .onConflictDoUpdate({
        set: { usedCount: sql`${hookUsage.usedCount} + 1` },
        setWhere: sql`${hookUsage.usedCount} < ${limit}`,
        target: [hookUsage.sessionId, hookUsage.hookId],
      })
      .returning({ hookId: hookUsage.hookId })
      .get(),
  );
}
export function copyHookUsage(db: Database, sourceSessionId: string, targetSessionId: string) {
  db.run(
    `INSERT INTO hook_usage (session_id, hook_id, used_count)
     SELECT ?, hook_id, used_count FROM hook_usage WHERE session_id = ?`,
    [targetSessionId, sourceSessionId],
  );
}
