import { afterEach, expect, test } from "bun:test";

import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { raceSignal } from "race-signal";
import { z } from "zod";

import { AppEvents } from "../../src/app/events";
import { buildTimeline } from "../../src/app/timeline";
import { loadTranscript } from "../../src/app/transcript";
import { requestControlRecord } from "../../src/infrastructure/database/records/execution/control";
import { processInput } from "../../src/runtime/consumeInputs";
import { hostLoop } from "../../src/runtime/loop";
import { cleanupDatabaseDirs, makeDatabases, required, workspace } from "../support/database";
import { agentFixture, textResponse, toolResponse } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
test.each(["model", "tool"] as const)(
  "forced pause interrupts a running %s and resumes the same run",
  async (mode) => {
    const databases = makeDatabases(2);
    using hostDb = required(databases[0]),
      clientDb = required(databases[1]);
    let toolCalls = 0;
    const events = mode === "model" ? new AppEvents() : undefined,
      started = Promise.withResolvers<AbortSignal | undefined>(),
      release = Promise.withResolvers<string>(),
      paused = Promise.withResolvers<void>(),
      idle = Promise.withResolvers<string>(),
      timeout = AbortSignal.timeout(3000),
      wait = <T>(promise: Promise<T>) => raceSignal(promise, timeout),
      command = (control: Parameters<typeof requestControlRecord>[2]) => {
        requestControlRecord(clientDb.db, "target", control);
        events?.wake("target");
      },
      echo = tool(
        (_, { signal }) => {
          if (++toolCalls === 1) {
            started.resolve(signal instanceof AbortSignal ? signal : undefined);
            return release.promise;
          }
          return "tool response";
        },
        { name: "echo", schema: z.object({}) },
      ),
      partial = new ReadableStream<LanguageModelV4StreamPart>({
        start(stream) {
          stream.enqueue({ id: "answer", type: "text-start" });
          stream.enqueue({ delta: "discard me", id: "answer", type: "text-delta" });
        },
      }),
      model = new MockLanguageModelV4({
        doStream: [mode === "model" ? { stream: partial } : toolResponse(), textResponse()],
      });
    using fixture = agentFixture({ db: hostDb, model, tools: [echo] });
    const { context, db } = fixture;
    if (events) {
      context.settings.host.pollMs = context.settings.host.pausePollMs = 30_000;
      context.wake = (delayMs, signal) => events.wait("target", delayMs, signal);
    }
    db.resetSession("target", workspace);
    db.appendUser("target", "hello");
    const { runId } = required(db.nextInput("target"));
    context.observer = {
      activity: (_, status) => {
        if (status === "idle") idle.resolve(db.runStatus(runId));
      },
      changed: () => {
        if (db.runStatus(runId) === "paused") paused.resolve();
      },
      token: () => started.resolve(model.doStreamCalls[0]?.abortSignal),
    };
    const running = hostLoop(context);
    try {
      const signal = required(await wait(started.promise));
      command("pause");
      await Bun.sleep(10);
      expect(db.runStatus(runId)).toBe("running");
      expect(signal.aborted).toBe(false);
      command("force_pause");
      await wait(paused.promise);
      expect(signal.aborted).toBe(true);
      const snapshot = loadTranscript(db.db, "target");
      expect(snapshot.queue).toMatchObject([{ error: null, status: "paused" }]);
      expect(snapshot.events.map(({ kind }) => kind)).not.toContain(
        mode === "model" ? "assistant_text_delta" : "tool_started",
      );
      if (mode === "tool") {
        expect(snapshot.events.map(({ kind }) => kind)).toContain("tool_call_delta");
        db.appendUser("target", "follow-up while paused");
      }
      command("running");
      expect(await wait(idle.promise)).toBe("done");
      expect(model.doStreamCalls).toHaveLength(2);
      expect(toolCalls).toBe(mode === "tool" ? 2 : 0);
      expect(db.history("target").at(-1)?.text).toBe("continued");
      if (mode === "tool") {
        expect(
          model.doStreamCalls[1]?.prompt
            .filter(({ role }) => role !== "system")
            .map(({ role }) => role),
        ).toEqual(["user", "assistant", "tool", "user"]);
      }
    } finally {
      release.resolve("released by cleanup");
      context.controller.abort();
      await running;
    }
  },
);
test("paused cancellation is visible immediately and survives host reconstruction", async () => {
  let called = 0;
  const echo = tool(
    () => {
      called += 1;
      return "must not execute";
    },
    {
      description: "echo",
      name: "echo",
      schema: z.object({}),
    },
  );
  using first = agentFixture({
    model: new MockLanguageModelV4({ doStream: toolResponse() }),
    tools: [echo],
  });
  const { db } = first,
    stopping = new AbortController();
  db.resetSession("target", workspace);
  db.appendUser("target", "run");
  db.setControl("target", "step");
  first.context.stopping = stopping.signal;
  first.context.observer = {
    changed: () => {
      if (db.control("target") === "pause") {
        stopping.abort();
      }
    },
    token: () => {},
  };
  await processInput(first.context, required(db.nextInput("target")));
  expect(called).toBe(0);
  expect(db.nextInput("target")?.status).toBe("paused");
  db.requestToolCancellation("target", "echo-call");
  const timelineParts = buildTimeline(loadTranscript(db.db, "target")).flatMap(
    ({ parts }) => parts,
  );
  expect(timelineParts.find((part) => part.type === "tool")).toMatchObject({
    output: { content: "工具运行 0 毫秒后被用户手动终止。" },
    phase: "completed",
  });
  first.executions.close();
  using resumed = agentFixture({ db, tools: [echo] });
  db.setControl("target", "running");
  await processInput(resumed.context, required(db.nextInput("target")));
  expect(called).toBe(0);
  expect(db.nextInput("target")).toBeNull();
  expect(db.history("target").find((message) => ToolMessage.isInstance(message))?.text).toBe(
    "工具运行 0 毫秒后被用户手动终止。",
  );
  expect(resumed.model.doStreamCalls).toHaveLength(1);
});
test("responses reusing provider block ids keep separate tool streams", async () => {
  const echo = tool(() => "done", { description: "echo", name: "echo", schema: z.object({}) });
  using fixture = agentFixture({
    model: new MockLanguageModelV4({
      doStream: ["first", "second"].map((id) => toolResponse([{ id, name: "echo" }], "thinking")),
    }),
    tools: [echo],
  });
  const { db } = fixture,
    stopping = new AbortController();
  db.resetSession("target", workspace);
  db.appendUser("target", "run");
  fixture.context.stopping = stopping.signal;
  fixture.context.observer = {
    changed: () => {
      const snapshot = loadTranscript(db.db, "target");
      buildTimeline(snapshot);
      if (snapshot.messages.some((message) => message.toolCallId === "second")) {
        stopping.abort();
      }
    },
    token: () => {},
  };
  await processInput(fixture.context, required(db.nextInput("target")));
  expect(db.nextInput("target")?.status).toBe("paused");
});
