import { afterEach, expect, test } from "bun:test";

import { captureError } from "../../src/failures/details";
import { parseError, stringifyError } from "../../src/failures/persistence";
import { cleanupDatabaseDirs, makeDb, required, runOf, workspace } from "../support/database";

afterEach(cleanupDatabaseDirs);
test("recovery preserves pending work while normalizing an interrupted run", () => {
  using db = makeDb();
  db.resetSession("123", workspace);
  const running = db.appendUser("123", "运行中"),
    paused = db.appendUser("123", "已经暂停"),
    pending = db.appendUser("123", "仍在等待");
  db.consumeInput("123", required(db.nextInput("123")));
  db.consumeInput("123", required(db.pendingInputs("123")[0]));
  db.setRunStatus(runOf(db, paused), "paused");
  db.setControl("123", "pause_cancel");
  expect(db.recoverInterruptedSession("123")).toEqual({
    action: "paused",
    activeItems: 3,
  });
  expect(db.activeInputs("123").map(({ id, status }) => ({ id, status }))).toEqual([
    { id: running, status: "paused" },
    { id: paused, status: "paused" },
    { id: pending, status: "pending" },
  ]);
  expect(db.control("123")).toBe("pause");
});
test("recovery completes a persisted cancel and removes only its run data", async () => {
  using db = makeDb();
  db.resetSession("123", workspace);
  const root = db.appendUser("123", "取消我"),
    appended = db.appendUser("123", "也取消我");
  db.consumeInput("123", required(db.nextInput("123")));
  await db.appendStream("123", {
    inputId: root,
    kind: "assistant_text_delta",
    messageId: "message-1",
    partId: "text-1",
    value: "partial",
  });
  await db.appendStream("123", {
    inputId: appended,
    kind: "assistant_text_delta",
    messageId: "message-2",
    partId: "text-1",
    value: "partial append",
  });
  db.setControl("123", "cancel");
  expect(db.recoverInterruptedSession("123")).toEqual({
    action: "canceled",
    activeItems: 2,
  });
  expect([db.runStatus(runOf(db, root)), db.runStatus(runOf(db, appended))]).toEqual([
    "canceled",
    "canceled",
  ]);
  expect(db.control("123")).toBe("running");
  expect(count(db, "events", "session_id = '123'")).toBe(0);
});
test("pauseRun is atomic, preserves pending work and omitted errors", () => {
  using db = makeDb();
  db.resetSession("123", workspace);
  const root = db.appendUser("123", "第一条");
  db.appendUser("123", "第二条");
  const runId = runOf(db, root),
    appendedItem = required(db.activeInputs("123")[1]);
  db.consumeInput("123", required(db.nextInput("123")));
  db.consumeInput("123", appendedItem);
  db.appendUser("123", "仍在等待");
  const oldError = captureError(
    new SuppressedError(new Error("清理错误"), new Error("执行错误"), "旧错误"),
  );
  db.db.run("UPDATE runs SET error_json = ? WHERE id = ?", [stringifyError(oldError), runId]);
  db.db.run(
    `CREATE TRIGGER fail_group_pause BEFORE UPDATE ON runs
     WHEN OLD.id = ${runId.toString()} AND NEW.status = 'paused'
     BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
  );
  expect(() => db.pauseRun("123", runId)).toThrow("injected failure");
  expect(db.control("123")).toBe("running");
  expect(db.activeInputs("123").map(({ status }) => status)).toEqual([
    "running",
    "running",
    "pending",
  ]);
  db.db.run("DROP TRIGGER fail_group_pause");
  expect(db.pauseRun("123", runId)).toBe(1);
  expect(db.control("123")).toBe("pause");
  expect(db.activeInputs("123").map(({ status }) => status)).toEqual([
    "paused",
    "paused",
    "pending",
  ]);
  const errors = db.db.query<{ error: string | null }, []>("SELECT error_json AS error FROM runs");
  expect(parseError(required(errors.get()?.error))).toMatchObject({
    details: {
      error: { message: "清理错误" },
      suppressed: { message: "执行错误" },
    },
    message: "旧错误",
  });
  const replacement = captureError(new Error("新错误"));
  expect(db.pauseRun("123", runId, replacement)).toBe(1);
  expect(errors.all().map(({ error }) => parseError(required(error)).message)).toEqual(["新错误"]);
});
function count(db: ReturnType<typeof makeDb>, table: "events", predicate: string) {
  return required(
    db.db
      .query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table} WHERE ${predicate}`)
      .get(),
  ).count;
}
