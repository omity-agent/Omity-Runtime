import type { Database } from "bun:sqlite";

import { and, eq, exists, inArray, not } from "drizzle-orm";

import { controlNotReady } from "../../../../failures/rejections";
import { localize } from "../../../../i18n/server";
import type { ControlCommand } from "../../../../types";
import { forcePauseRequests, runs, sessions } from "../../schema";
import { cachedQuery, runTransaction, sessionDatabase } from "../../sqlite/connection";
import {
  readControlRecord,
  requireSessionRecord,
  reviseSessionRecord,
  writeControlRecord,
} from "../session/metadata";

export function requestControlRecord(db: Database, sessionId: string, command: ControlCommand) {
  runTransaction(
    db,
    () => {
      if (command === "step") {
        requestStepControlRecord(db, sessionId);
        return;
      }
      if (command === "force_pause") {
        writeControlRecord(db, sessionId, "pause");
        const orm = sessionDatabase(db);
        orm
          .insert(forcePauseRequests)
          .select(
            orm
              .select({ sessionId: runs.sessionId })
              .from(runs)
              .where(and(eq(runs.sessionId, sessionId), eq(runs.status, "running"))),
          )
          .onConflictDoNothing()
          .run();
        return;
      }
      const previous = command === "cancel" ? readControlRecord(db, sessionId) : undefined;
      writeControlRecord(
        db,
        sessionId,
        previous === "pause" || previous === "pause_cancel" ? "pause_cancel" : command,
      );
      if (command !== "pause") {
        clearForcePauseRequest(db, sessionId);
      }
    },
    "immediate",
  );
}
export function hasForcePauseRequest(db: Database, sessionId: string) {
  return Boolean(
    cachedQuery(db, "SELECT 1 FROM force_pause_requests WHERE session_id = ?").get(sessionId),
  );
}
export function clearForcePauseRequest(db: Database, sessionId: string) {
  sessionDatabase(db)
    .delete(forcePauseRequests)
    .where(eq(forcePauseRequests.sessionId, sessionId))
    .run();
}
function requestStepControlRecord(db: Database, sessionId: string) {
  requireSessionRecord(db, sessionId);
  const orm = sessionDatabase(db),
    run = (status: "paused" | "running") =>
      orm
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.sessionId, sessionId), eq(runs.status, status))),
    steppable = and(exists(run("paused")), not(exists(run("running")))),
    changed = reviseSessionRecord(
      db,
      sessionId,
      "step",
      and(inArray(sessions.control, ["running", "pause"]), steppable),
    );
  if (changed === 1) {
    return;
  }
  const control = readControlRecord(db, sessionId),
    ready = Boolean(
      orm
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), steppable))
        .get(),
    );
  if (control === "step" && ready) {
    return;
  }
  if ((control === "running" || control === "pause") && ready) {
    throw new Error(
      localize("database:execution.controlRevisionExhausted", {
        sessionId,
      }),
    );
  }
  throw controlNotReady("step");
}
