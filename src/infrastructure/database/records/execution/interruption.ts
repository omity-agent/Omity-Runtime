import type { Database } from "bun:sqlite";

import { and, eq, inArray, ne } from "drizzle-orm";

import type { ErrorDetails } from "../../../../failures/details";
import { checkpoints, events, fileLinkSets } from "../../schema";
import { activeRuns, inputs, runs } from "../../schema/execution";
import { runTransaction, sessionDatabase } from "../../sqlite/connection";
import {
  consumeStepControlRecord,
  readControlRecord,
  touchSessionRecord,
  writeControlRecord,
} from "../session/metadata";
import { pruneUnreferencedMessages } from "../transcript/messages/writing";
import { activeInputRows } from "./queue/workItems";
import { pauseRunRecord } from "./runs/mutations";

function recoverInterruptedSessionRecord(db: Database, sessionId: string) {
  const active = activeInputRows(db, sessionId),
    control = readControlRecord(db, sessionId);
  let action: "paused" | "canceled" | "none" = "none";
  if (control === "cancel") {
    if (active.length > 0) {
      cancelActiveRuns(db, sessionId);
      action = "canceled";
    }
    writeControlRecord(db, sessionId, "running");
  } else if (active.length > 0) {
    const paused = sessionDatabase(db)
        .update(runs)
        .set({ status: "paused" })
        .where(and(eq(runs.sessionId, sessionId), eq(runs.status, "running")))
        .run(),
      controlChanged = writeControlRecord(db, sessionId, "pause");
    if (paused.changes > 0 && !controlChanged) {
      touchSessionRecord(db, sessionId);
    }
    action = "paused";
  } else if (control === "pause_cancel" || control === "step") {
    writeControlRecord(db, sessionId, "pause");
  }
  return { action, activeItems: active.length };
}
function cancelActiveRuns(db: Database, sessionId: string) {
  const orm = sessionDatabase(db),
    ownedRuns = orm
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.sessionId, sessionId), activeRuns())),
    activeInputs = orm
      .select({ id: inputs.id })
      .from(inputs)
      .where(and(inArray(inputs.runId, ownedRuns), ne(inputs.delivery, "canceled")));
  orm.delete(events).where(inArray(events.inputId, activeInputs)).run();
  orm.delete(fileLinkSets).where(inArray(fileLinkSets.inputId, activeInputs)).run();
  orm.delete(checkpoints).where(inArray(checkpoints.runId, ownedRuns)).run();
  orm
    .update(runs)
    .set({ error: null, status: "canceled" })
    .where(and(eq(runs.sessionId, sessionId), activeRuns()))
    .run();
  orm
    .update(inputs)
    .set({ delivery: "canceled" })
    .where(and(eq(inputs.sessionId, sessionId), eq(inputs.delivery, "pending")))
    .run();
  pruneUnreferencedMessages(db, sessionId);
}
export class RecoverableDatabase {
  constructor(readonly db: Database) {}
  activeInputs(sessionId: string) {
    return activeInputRows(this.db, sessionId);
  }
  pauseRun(sessionId: string, runId: number, error?: ErrorDetails) {
    return runTransaction(this.db, () => {
      const controlChanged = writeControlRecord(this.db, sessionId, "pause"),
        paused = pauseRunRecord(this.db, sessionId, runId, error);
      if (paused > 0 && !controlChanged) {
        touchSessionRecord(this.db, sessionId);
      }
      return paused;
    });
  }
  pauseCompletedStep(sessionId: string, runId: number) {
    return runTransaction(this.db, () => {
      if (!consumeStepControlRecord(this.db, sessionId)) {
        return false;
      }
      pauseRunRecord(this.db, sessionId, runId);
      return true;
    });
  }
  recoverInterruptedSession(sessionId: string) {
    return runTransaction(this.db, () => recoverInterruptedSessionRecord(this.db, sessionId));
  }
}
