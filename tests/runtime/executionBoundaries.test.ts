import { afterEach, expect, test } from "bun:test";

import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { streamAiModel } from "../../src/agent/model/request";
import { buildTimeline } from "../../src/app/timeline";
import { loadTranscript } from "../../src/app/transcript";
import { processInput } from "../../src/runtime/consumeInputs";
import { hostLoop } from "../../src/runtime/loop";
import { testSettings } from "../support/configuration";
import { cleanupDatabaseDirs, required, workspace } from "../support/database";
import { agentFixture, textResponse, toolResponse } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
test.each([false, true])(
  "model cancellation preserves its reason (already aborted: %s)",
  async (aborted) => {
    const started = Promise.withResolvers<void>(),
      released = Promise.withResolvers<void>(),
      controller = new AbortController(),
      reason = new Error("generation cancelled"),
      settings = testSettings(),
      model = new MockLanguageModelV4({
        doStream: async () => {
          started.resolve();
          await released.promise;
          return textResponse("late reply");
        },
      });
    settings.model.maxConcurrentRequests = 1;
    if (aborted) {
      controller.abort(reason);
    }
    const pending = streamAiModel({
      messages: [new HumanMessage("hello")],
      model,
      sessionId: "target",
      settings,
      signal: controller.signal,
      tools: {},
    });
    try {
      if (!aborted) {
        await started.promise;
        controller.abort(reason);
      }
      await expect(pending).rejects.toBe(reason);
      expect(model.doStreamCalls).toHaveLength(aborted ? 0 : 1);
    } finally {
      released.resolve();
      await Promise.allSettled([pending]);
    }
  },
);
test("the host reports idle only after marking the active run done", async () => {
  using fixture = agentFixture();
  const { context, db } = fixture;
  db.resetSession("target", workspace);
  db.appendUser("target", "run before idle");
  const { runId } = required(db.nextInput("target")),
    statusAtIdle = Promise.withResolvers<ReturnType<typeof db.runStatus>>();
  context.observer = {
    activity: (_, activity) => {
      if (activity === "idle") {
        statusAtIdle.resolve(db.runStatus(runId));
        context.controller.abort();
      }
    },
    token: () => {},
  };
  await hostLoop(context);
  expect(await statusAtIdle.promise).toBe("done");
});
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
