import { afterEach, expect, test } from "bun:test";

import { ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { buildTimeline } from "../../src/app/timeline";
import { loadTranscript } from "../../src/app/transcript";
import { processInput } from "../../src/runtime/consumeInputs";
import { cleanupDatabaseDirs, required, workspace } from "../support/database";
import { agentFixture, toolResponse } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
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
  const snapshot = loadTranscript(db.db, "target"),
    parts = buildTimeline(snapshot.messages, snapshot.queue, snapshot.events).flatMap(
      (message) => message.parts,
    );
  expect(parts.find((part) => part.type === "tool")).toMatchObject({
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
      buildTimeline(snapshot.messages, snapshot.queue, snapshot.events);
      if (snapshot.messages.some((message) => message.toolCallId === "second")) {
        stopping.abort();
      }
    },
    token: () => {},
  };
  await processInput(fixture.context, required(db.nextInput("target")));
  expect(db.nextInput("target")?.status).toBe("paused");
});
