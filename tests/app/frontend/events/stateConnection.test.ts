import { afterEach, beforeAll, expect, mock, spyOn, test } from "bun:test";

import { MockLanguageModelV4 } from "ai/test";
import { Hono } from "hono";

import { AppEvents } from "../../../../src/app/events";
import type { SessionFailure, SessionInfo } from "../../../../src/app/events/contracts";
import { i18nReady } from "../../../../src/app/frontend/i18n";
import { subscribeStateEvents } from "../../../../src/app/frontend/services/events/reception";
import { processInput } from "../../../../src/runtime/consumeInputs";
import { setRunStatus } from "../../../../src/runtime/run";
import { agentFixture } from "../../../runtime/support/agentFixture";
import { cleanupDatabaseDirs, required, workspace } from "../../../support/database";
import { nextStateEvent, readStateWire } from "./wireReader";

const storedFailure: SessionInfo = {
  createdAt: 1,
  error: {
    cause: {
      details: { requestBodyValues: { input: "stored history" } },
      message: "failed",
      name: "Error",
    },
    details: { requestBodyValues: { input: "stored history" } },
    message: "failed",
    name: "Error",
  },
  id: "stored",
  status: "error",
  title: "Stored failure",
  updatedAt: 1,
  workspace,
};
beforeAll(async () => {
  await i18nReady;
});
afterEach(cleanupDatabaseDirs);
test("a new state connection restores history while reconnection only synchronizes state", async () => {
  const events = new AppEvents(),
    app = new Hono().get("/events", (context) =>
      events.streamState(context, () => [storedFailure]),
    );
  let cursor = "";
  for (const reconnect of [false, true, false]) {
    await using wire = readStateWire(
      await app.request("/events", reconnect ? { headers: { "Last-Event-ID": cursor } } : {}),
    );
    const snapshot = await nextStateEvent(wire);
    expect(snapshot.type).toBe(reconnect ? "sessions" : "restore");
    expect(JSON.parse(snapshot.data)).toEqual({ sessions: [storedFailure] });
    cursor = snapshot.lastEventId;
  }
});
test("a persisted run failure emits an occurrence independently of subsequent state changes", async () => {
  const fatal = new Error("fatal model failure"),
    model = new MockLanguageModelV4({
      doStream: () => Promise.reject(fatal),
    });
  using fixture = agentFixture({ model });
  const { context, db } = fixture,
    failures: SessionFailure[] = [];
  context.settings.model.maxConcurrentRequests = 1;
  context.observer = {
    failure: (sessionId, error) => {
      failures.push({ error, sessionId });
    },
    token: () => {},
  };
  db.resetSession("target", workspace);
  db.appendUser("target", "hello");
  const input = required(db.nextInput("target"));
  await processInput(context, input);
  expect(db.nextInput("target")?.status).toBe("paused");
  expect(failures).toMatchObject([
    { error: { message: "fatal model failure", name: "Error" }, sessionId: "target" },
  ]);
  setRunStatus(
    context,
    { id: input.runId, items: [input], threadId: input.runId.toString() },
    "paused",
    required(failures[0]).error,
  );
  expect(failures).toHaveLength(1);
  db.setControl("target", "running");
  await processInput(context, required(db.nextInput("target")));
  expect(failures).toHaveLength(2);
  expect(failures[1]).toEqual(failures[0]);
});
test("console restoration and live failures are independent from ordinary state synchronization", async () => {
  const events = new AppEvents(),
    app = new Hono().get("/events", (context) =>
      events.streamState(context, () => [storedFailure]),
    ),
    wire = readStateWire(await app.request("/events")),
    source = Object.assign(new EventTarget(), { close: mock(() => {}) }),
    handlers = {
      deleted: mock(() => {}),
      session: mock(() => {}),
      sessions: mock(() => {}),
    },
    close = subscribeStateEvents(source, handlers),
    info = spyOn(console, "info").mockReturnValue(),
    error = spyOn(console, "error").mockReturnValue();
  try {
    const restored = await nextStateEvent(wire);
    source.dispatchEvent(restored);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[1]).toMatchObject({
      error: {
        causes: [
          {
            details: { requestBodyValues: { input: "stored history" } },
            message: "failed",
            name: "Error",
          },
        ],
      },
    });
    expect(error).not.toHaveBeenCalled();
    expect(handlers.sessions).toHaveBeenCalledWith([storedFailure]);
    events.notifySession({ ...storedFailure, title: "Updated title" });
    source.dispatchEvent(await nextStateEvent(wire));
    expect(handlers.session).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    let cursor = restored.lastEventId;
    for (let occurrence = 0; occurrence < 2; occurrence += 1) {
      events.notifyFailure({ error: required(storedFailure.error), sessionId: storedFailure.id });
      const failure = await nextStateEvent(wire);
      source.dispatchEvent(failure);
      cursor = failure.lastEventId;
    }
    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[0]).toEqual(error.mock.calls[1]);
    await using reconnected = readStateWire(
      await app.request("/events", { headers: { "Last-Event-ID": cursor } }),
    );
    source.dispatchEvent(await nextStateEvent(reconnected));
    expect(handlers.sessions).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);
  } finally {
    close();
    expect(source.close).toHaveBeenCalledTimes(1);
    await wire.return();
    info.mockRestore();
    error.mockRestore();
  }
});
