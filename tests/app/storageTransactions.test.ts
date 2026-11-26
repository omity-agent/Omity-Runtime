import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createSessionWithAttachments } from "../../src/app/attachments/session";
import {
  createSessionStorage,
  forkSessionStorage,
} from "../../src/app/runtime/sessions/persistence";
import { materializeAppFork } from "../../src/app/runtime/sessions/provision";
import { databasePath, sessionPaths } from "../../src/infrastructure/configuration/sessionPaths";
import { AgentDatabase } from "../../src/infrastructure/database/agentDatabase";
import { emptySessionDefinition } from "../../src/infrastructure/database/session/sessionDefinition";
import { createTestDirectory } from "../support/artifacts";
import { testSettings } from "../support/configuration";
import { required, workspace } from "../support/database";
import { scopedEnvironment } from "../support/scopedEnvironment";

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
test("fork initialization releases its reservation when the fork point is missing", async () => {
  const paths = sessionPaths("source");
  using database = new AgentDatabase(paths.dbPath);
  database.createSession("source", workspace);
  await expect(
    materializeAppFork(database, {
      beforeMessageId: 1,
      pauseSource: () => Promise.resolve(),
      profiles: [],
      sourceSessionId: "source",
      workspace,
    }),
  ).rejects.toThrow();
  expect(readdirSync(dirname(paths.dir))).toEqual(["source"]);
});
test.each(operations)(
  "%s rolls back database records when message files cannot be written",
  (mode) => {
    using db = new AgentDatabase(databasePath());
    const initialize = prepareInitialization(db, mode),
      paths = sessionPaths("target");
    mkdirSync(paths.userMessagesDir);
    writeFileSync(join(paths.userMessagesDir, "1.txt"), "blocked");
    expect(initialize).toThrow("EEXIST");
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
  using db = new AgentDatabase(databasePath());
  const initialize = prepareInitialization(db, mode);
  createSessionStorage(db, "target", workspace, [], [], "existing message");
  const paths = sessionPaths("target");
  expect(initialize).toThrow();
  expect(existsSync(paths.dir)).toBe(true);
  expect(readFileSync(join(paths.userMessagesDir, "0.txt"), "utf8")).toBe("existing message");
  expect(db.nextInput("target")?.content).toBe("existing message");
  expect(db.hasSession("source")).toBe(true);
});
test("attachment initialization only discards its own files on a session conflict", async () => {
  using db = new AgentDatabase(databasePath());
  createSessionStorage(db, "target", workspace, [], [], "existing message");
  await expect(
    createSessionWithAttachments({
      attachments: [{ file: new File(["attachment"], "notes.txt"), id: "a1b2c3d4" }],
      database: db,
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
  expect(db.hasSession("target")).toBe(true);
  expect(db.nextInput("target")?.content).toBe("existing message");
  expect(readFileSync(join(paths.userMessagesDir, "0.txt"), "utf8")).toBe("existing message");
  expect(readdirSync(join(paths.dir, "attachments"))).toEqual([]);
});
test("an attachment shared by initial history and the pending message is written once", async () => {
  using db = new AgentDatabase(databasePath());
  const message = "read {{file:a1b2c3d4:notes.txt}}";
  await createSessionWithAttachments({
    attachments: [{ file: new File(["attachment"], "notes.txt"), id: "a1b2c3d4" }],
    database: db,
    definition: emptySessionDefinition(),
    history: [{ assistant: "received", user: message }],
    message,
    profiles: [],
    sessionId: "target",
    settings: testSettings(),
    workspace,
  });
  const paths = sessionPaths("target");
  const first = required(db.history("target")[0]).text;
  expect(db.nextInput("target")?.content).toBe(first);
  expect(readFileSync(first.slice("read ".length), "utf8")).toBe("attachment");
  expect(readdirSync(join(paths.dir, "attachments"))).toHaveLength(1);
});
test("appending queued inputs preserves archive files and reuses missing sequence numbers", () => {
  using db = new AgentDatabase(databasePath());
  createSessionStorage(db, "target", workspace, [], history, "pending message");
  const paths = sessionPaths("target");
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
function prepareInitialization(source: AgentDatabase, mode: (typeof operations)[number]) {
  createSessionStorage(source, "source", workspace, [], history, "fork draft");
  const beforeMessageId = source.consumeInput("source", required(source.nextInput("source")));
  return () => {
    if (mode === "create") {
      createSessionStorage(source, "target", workspace, [], history, "fork draft");
    } else {
      forkSessionStorage(source, {
        beforeMessageId,
        profiles: [],
        sourceSessionId: "source",
        targetSessionId: "target",
        workspace,
      });
    }
  };
}
