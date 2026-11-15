import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSessionWithAttachments } from "../../src/app/attachments/session";
import { createSessionStorage, forkSessionStorage } from "../../src/app/runtime/sessionStorage";
import { sessionPaths } from "../../src/infrastructure/configuration/sessionPaths";
import { AgentDatabase } from "../../src/infrastructure/database/agentDatabase";
import { emptySessionDefinition } from "../../src/infrastructure/database/session/sessionDefinition";
import { createTestDirectory } from "../support/artifacts";
import { required, workspace } from "../support/database";
import { scopedEnvironment } from "../support/scopedEnvironment";
import { testSettings } from "../support/settings";

const history = [
    { assistant: "first answer", user: "first user" },
    { assistant: "second answer", user: "second user" },
  ],
  operations = ["create", "fork"] as const;
let environment: DisposableStack, home: string;
beforeEach(() => {
  home = createTestDirectory("storage-transactions");
  environment = scopedEnvironment({ OMITY_HOME: home });
});
afterEach(() => {
  environment.dispose();
  rmSync(home, { force: true, recursive: true });
});
test.each(operations)(
  "%s rolls back database records when message files cannot be written",
  (mode) => {
    const initialize = prepareInitialization(mode),
      paths = sessionPaths("target");
    mkdirSync(paths.userMessagesDir);
    writeFileSync(join(paths.userMessagesDir, "1.txt"), "blocked");
    expect(initialize).toThrow("EEXIST");
    using db = new AgentDatabase(paths.dbPath);
    expect(db.hasSession("target")).toBe(false);
    expect(existsSync(paths.dir)).toBe(false);
    for (const table of ["runs", "inputs", "messages", "composer_drafts"]) {
      expect(db.db.query(`SELECT * FROM ${table} WHERE session_id = ?`).all("target")).toEqual([]);
    }
    initialize();
    expect(db.hasSession("target")).toBe(true);
    expect(db.history("target").map(({ text }) => text)).toEqual([
      "first user",
      "first answer",
      "second user",
      "second answer",
    ]);
    expect(readFileSync(join(paths.userMessagesDir, "0.txt"), "utf8")).toBe("first user");
    expect(readFileSync(join(paths.userMessagesDir, "1.txt"), "utf8")).toBe("second user");
    expect(db.db.query("PRAGMA foreign_key_check").all()).toEqual([]);
  },
);
test.each(operations)("%s preserves an existing destination on a session conflict", (mode) => {
  const initialize = prepareInitialization(mode);
  createSessionStorage("target", workspace, [], [], "existing message");
  const paths = sessionPaths("target");
  expect(initialize).toThrow();
  expect(existsSync(paths.dir)).toBe(true);
  expect(readFileSync(join(paths.userMessagesDir, "0.txt"), "utf8")).toBe("existing message");
  using db = new AgentDatabase(paths.dbPath);
  expect(db.nextInput("target")?.content).toBe("existing message");
  expect(db.hasSession("source")).toBe(true);
});
test("attachment initialization only discards its own files on a session conflict", async () => {
  createSessionStorage("target", workspace, [], [], "existing message");
  await expect(
    createSessionWithAttachments({
      attachments: [{ file: new File(["attachment"], "notes.txt"), id: "a1b2c3d4" }],
      definition: emptySessionDefinition(),
      history: [],
      message: "read {{file:a1b2c3d4:notes.txt}}",
      profiles: [],
      sessionId: "target",
      settings: testSettings(),
      workspace,
    }),
  ).rejects.toThrow();
  const paths = sessionPaths("target");
  using db = new AgentDatabase(paths.dbPath);
  expect(db.hasSession("target")).toBe(true);
  expect(db.nextInput("target")?.content).toBe("existing message");
  expect(readFileSync(join(paths.userMessagesDir, "0.txt"), "utf8")).toBe("existing message");
  expect(readdirSync(join(paths.dir, "attachments"))).toEqual([]);
});
test("appending queued inputs preserves archive files and reuses missing sequence numbers", () => {
  createSessionStorage("target", workspace, [], history, "pending message");
  const paths = sessionPaths("target");
  using db = new AgentDatabase(paths.dbPath);
  db.appendUser("target", "appended message");
  expect(readFileSync(join(paths.userMessagesDir, "0.txt"), "utf8")).toBe("first user");
  expect(readFileSync(join(paths.userMessagesDir, "3.txt"), "utf8")).toBe("appended message");
  rmSync(join(paths.userMessagesDir, "1.txt"));
  db.appendUser("target", "fills archive hole");
  expect(readFileSync(join(paths.userMessagesDir, "1.txt"), "utf8")).toBe("fills archive hole");
  expect(readFileSync(join(paths.userMessagesDir, "2.txt"), "utf8")).toBe("pending message");
  expect(readFileSync(join(paths.userMessagesDir, "3.txt"), "utf8")).toBe("appended message");
  expect(db.pendingInputs("target").map(({ content }) => content)).toEqual([
    "pending message",
    "appended message",
    "fills archive hole",
  ]);
});
function prepareInitialization(mode: (typeof operations)[number]) {
  createSessionStorage("source", workspace, [], history, "fork draft");
  using source = new AgentDatabase(sessionPaths("source").dbPath);
  const beforeMessageId = source.consumeInput("source", required(source.nextInput("source")));
  return () => {
    if (mode === "create") {
      createSessionStorage("target", workspace, [], history, "fork draft");
    } else {
      forkSessionStorage({
        beforeMessageId,
        profiles: [],
        sourceSessionId: "source",
        targetSessionId: "target",
        workspace,
      });
    }
  };
}
