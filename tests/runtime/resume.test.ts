import { afterEach, expect, test } from "bun:test";

import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { queryAll } from "../../src/infrastructure/database/sqlite/connection";
import { processInput } from "../../src/runtime/consumeInputs";
import type { HostContext } from "../../src/runtime/context";
import { wireHostSignals } from "../../src/runtime/execution/signals";
import type { StreamEvent } from "../../src/types";
import { cleanupDatabaseDirs, required, workspace } from "../support/database";
import { agentFixture, textResponse, toolResponse } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
test("a paused run resumes from the model boundary without repeating the model call", async () => {
  const calls: string[] = [],
    echo = tool(
      () => {
        calls.push("tool");
        return Promise.resolve("echoed");
      },
      { description: "echo", name: "echo", schema: z.object({}) },
    ),
    model = modelWithToolCalls(),
    stopping = new AbortController();
  using fixture = agentFixture({ model, sessionId: "session", tools: [echo] });
  const { context, db } = fixture;
  db.resetSession("session", workspace);
  db.appendUser("session", "run tool");
  context.stopping = stopping.signal;
  context.observer = {
    changed: () => {
      if (model.doStreamCalls.length === 1) {
        stopping.abort();
      }
    },
    token: () => {},
  };
  await processInput(context, required(db.nextInput("session")));
  expect(db.nextInput("session")?.status).toBe("paused");
  expect(model.doStreamCalls).toHaveLength(1);
  expect(calls).toEqual([]);
  db.appendUser("session", "follow-up before resuming");
  db.setControl("session", "running");
  context.stopping = undefined;
  await processInput(context, required(db.nextInput("session")));
  expect(db.nextInput("session")).toBeNull();
  expect(model.doStreamCalls).toHaveLength(2);
  expect(calls).toEqual(["tool", "tool"]);
  expect(
    model.doStreamCalls[1]?.prompt.filter(({ role }) => role !== "system").map(({ role }) => role),
  ).toEqual(["user", "assistant", "tool", "user"]);
  expect(model.doStreamCalls[1]?.prompt.at(-1)).toEqual({
    content: [{ text: "follow-up before resuming", type: "text" }],
    role: "user",
  });
});
test("a paused run steps through one model request or a complete tool batch", async () => {
  const calls: string[] = [],
    delivered: StreamEvent[] = [],
    invoked = Promise.withResolvers<string>(),
    release = Promise.withResolvers<string>(),
    echo = tool(
      (_, config) => {
        const { id } = z.object({ id: z.string() }).parse(config.toolCall);
        calls.push(id);
        invoked.resolve(id);
        return release.promise;
      },
      { description: "echo", name: "echo", schema: z.object({}) },
    ),
    model = modelWithToolCalls();
  using fixture = agentFixture({ model, sessionId: "session", tools: [echo] });
  const { context, db } = fixture;
  db.resetSession("session", workspace);
  db.appendUser("session", "run tool");
  db.setControl("session", "step");
  db.onChange((event) => delivered.push(event));
  await processInput(stepContext(context), required(db.nextInput("session")));
  expect(db.nextInput("session")?.status).toBe("paused");
  expect(db.control("session")).toBe("pause");
  expect(model.doStreamCalls).toHaveLength(1);
  expect(calls).toEqual([]);
  db.setControl("session", "step");
  const toolStep = processInput(stepContext(context), required(db.nextInput("session")));
  expect(await invoked.promise).toBe("echo-call-1");
  expect(
    queryAll<{ kind: string }>(
      db.db,
      `SELECT kind FROM events
       WHERE kind IN ('tool_started', 'tool_finished')
       ORDER BY id`,
    ).map(({ kind }) => kind),
  ).toEqual(["tool_started", "tool_started"]);
  expect(calls).toEqual(["echo-call-1", "echo-call-2"]);
  const cursor = db.eventCursor();
  release.resolve("echoed");
  await toolStep;
  expect(db.nextInput("session")?.status).toBe("paused");
  expect(db.control("session")).toBe("pause");
  expect(model.doStreamCalls).toHaveLength(1);
  expect(calls).toEqual(["echo-call-1", "echo-call-2"]);
  expect(db.db.query("SELECT id FROM events WHERE kind <> 'user_appended'").all()).toEqual([]);
  const finished = delivered.filter((event) => event.kind === "tool_finished");
  expect(finished).toHaveLength(2);
  expect(finished.every((event) => event.id > cursor)).toBe(true);
  expect(db.eventCursor()).toBe(required(finished.at(-1)).id);
});
test.each(["SIGINT", "SIGTERM"] as const)(
  "repeated %s escalates a paused Agent from a graceful stop to forced cancellation",
  async (signal) => {
    using fixture = agentFixture();
    const { context, db } = fixture,
      stopping = new AbortController();
    using listeners = new DisposableStack();
    listeners.defer(
      wireHostSignals({
        enabled: true,
        force: context.controller,
        logger: context.logger,
        stopping,
        timeoutMs: 60_000,
      }),
    );
    db.resetSession("target", workspace);
    db.appendUser("target", "hello");
    context.stopping = stopping.signal;
    context.observer = {
      changed: () => {
        if (fixture.model.doStreamCalls.length === 1 && !stopping.signal.aborted) {
          process.emit(signal, signal);
        }
      },
      token: () => {},
    };
    await processInput(context, required(db.nextInput("target")));
    expect(stopping.signal.aborted).toBe(true);
    expect(context.controller.signal.aborted).toBe(false);
    expect(db.nextInput("target")?.status).toBe("paused");
    process.emit(signal, signal);
    expect(context.controller.signal.aborted).toBe(true);
  },
);
function stepContext(ctx: HostContext) {
  const stopping = new AbortController(),
    { db, sessionId } = ctx;
  ctx.stopping = stopping.signal;
  ctx.observer = {
    changed: () => {
      if (db.nextInput(sessionId)?.status === "paused") {
        stopping.abort();
      }
    },
    token: () => {},
  };
  return ctx;
}
function modelWithToolCalls() {
  return new MockLanguageModelV4({
    doStream: [
      toolResponse([
        { id: "echo-call-1", name: "echo" },
        { id: "echo-call-2", name: "echo" },
      ]),
      textResponse("done"),
    ],
  });
}
