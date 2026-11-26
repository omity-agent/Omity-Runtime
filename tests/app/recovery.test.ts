import { afterEach, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { AppController } from "../../src/app/controller";
import { sessionPaths } from "../../src/infrastructure/configuration/sessionPaths";
import { settingsProfileNames } from "../../src/infrastructure/configuration/settings/context";
import { userDataDirectory } from "../../src/infrastructure/configuration/settings/files";
import { AgentDatabase } from "../../src/infrastructure/database/agentDatabase";
import {
  hasForcePauseRequest,
  requestControlRecord,
} from "../../src/infrastructure/database/records/execution/control";
import { emptySessionDefinition } from "../../src/infrastructure/database/session/sessionDefinition";
import { hostOwnerId } from "../../src/infrastructure/process/ownership";
import { recoverHostSession } from "../../src/runtime/execution/recovery";
import { createTestDirectory } from "../support/artifacts";
import { containingText } from "../support/asymmetric";
import { writeTestConfiguration } from "../support/configuration";
import { required, runOf } from "../support/database";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
  rmSync(join(userDataDirectory(), "sessions"), { force: true, recursive: true });
});
test("app startup atomically pauses an orphaned run", async () => {
  const fixture = interruptedSession("orphan"),
    pending = fixture.db.appendUser("orphan", "尚未消费的追加输入");
  fixture.db.close();
  const controller = new AppController(fixture.root, { settingsContext: fixture.context }),
    transcript = controller.transcript("orphan");
  expect(controller.bootstrap().sessions[0]?.status).toBe("paused");
  expect(transcript.control).toBe("pause");
  expect(transcript.queue.map(({ id, status }) => ({ id, status }))).toEqual([
    { id: fixture.inputId, status: "paused" },
    { id: pending, status: "pending" },
  ]);
  await controller.close();
});
test("app startup preserves the activity time of an already paused session", async () => {
  const fixture = interruptedSession("already-paused");
  fixture.db.setRunStatus(runOf(fixture.db, fixture.inputId), "paused");
  fixture.db.setControl("already-paused", "pause");
  fixture.db.db.run("UPDATE sessions SET updated_at = 1 WHERE id = 'already-paused'");
  fixture.db.db.run("UPDATE messages SET created_at = 1 WHERE session_id = 'already-paused'");
  const revision = fixture.db.transcriptRevision("already-paused");
  fixture.db.close();
  const controller = new AppController(fixture.root, { settingsContext: fixture.context });
  expect(controller.bootstrap().sessions[0]?.updatedAt).toBe(1);
  expect(controller.transcript("already-paused").transcriptRevision).toBe(revision);
  await controller.close();
});
test.each(["abandoned", "live", "expired"] as const)(
  "startup reconciles a %s host lease without stealing live work",
  async (sessionId) => {
    const fixture = interruptedSession(sessionId),
      abandonedOwner = { pid: process.pid, token: randomUUID() },
      expired = sessionId === "expired",
      live = sessionId === "live";
    using db = fixture.db;
    db.acquireHostLease({
      now: Date.now() - (expired ? 60_000 : 0),
      ownerId: hostOwnerId({
        instanceId: abandonedOwner.token,
        kind: sessionId === "abandoned" ? "app" : "standalone",
        pid: abandonedOwner.pid,
      }),
      sessionId,
      ttlMs: 30_000,
    });
    if (expired) {
      requestControlRecord(db.db, sessionId, "force_pause");
      expect(hasForcePauseRequest(db.db, sessionId)).toBe(true);
      expect(recoverHostSession(db, sessionId).status).toBe("recovered");
      expect(hasForcePauseRequest(db.db, sessionId)).toBe(false);
    } else {
      await new AppController(fixture.root, {
        abandonedOwner,
        settingsContext: fixture.context,
      }).close();
    }
    expect(db.control(sessionId)).toBe(live ? "running" : "pause");
    expect(db.runStatus(runOf(db, fixture.inputId))).toBe(live ? "running" : "paused");
    expect(db.hostLease(sessionId) !== null).toBe(live);
  },
);
test("resume reloads the current MCP configuration", async () => {
  const fixture = interruptedSession("resume-failure");
  fixture.db.close();
  writeFileSync(join(fixture.profileDirectory, "toolbox.yaml"), "[]\n");
  const controller = new AppController(fixture.root, { settingsContext: fixture.context }),
    failures = spyOn(controller.events, "notifyFailure");
  try {
    await expect(controller.control("resume-failure", "running")).rejects.toThrow("MCP 配置");
    expect(failures).toHaveBeenCalledTimes(1);
    expect(failures.mock.calls[0]?.[0]).toMatchObject({
      error: { message: containingText("MCP 配置") },
      sessionId: "resume-failure",
    });
    await controller.close();
    expect(failures).toHaveBeenCalledTimes(1);
  } finally {
    await controller.close();
    failures.mockRestore();
  }
});
function interruptedSession(sessionId: string) {
  const root = createTestDirectory("app-recovery");
  roots.push(root);
  const configuration = writeTestConfiguration(root),
    workspace = join(root, "workspace");
  mkdirSync(workspace);
  const db = openSession(sessionId),
    definition = emptySessionDefinition();
  definition.prefix.model = {
    adapter: "completions",
    baseURL: null,
    model: "test",
    reasoning_effort: "medium",
  };
  db.createSession(sessionId, workspace, settingsProfileNames(configuration.context), definition);
  const inputId = db.appendUser(sessionId, "运行中的输入");
  db.consumeInput(sessionId, required(db.nextInput(sessionId)));
  return { ...configuration, db, inputId, root };
}
function openSession(sessionId: string) {
  return new AgentDatabase(sessionPaths(sessionId).dbPath);
}
