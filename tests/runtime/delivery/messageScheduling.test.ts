import { afterEach, expect, test } from "bun:test";

import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { processInput } from "../../../src/runtime/consumeInputs";
import { cleanupDatabaseDirs, required, workspace } from "../../support/database";
import { agentFixture, textResponse } from "../support/agentFixture";

afterEach(cleanupDatabaseDirs);
test("queued messages enter the first model request and each runs its before hook once", async () => {
  let hooks = 0;
  const before = tool(
    () => {
      hooks += 1;
      return "ready";
    },
    { description: "before", name: "before", schema: z.object({}) },
  );
  using fixture = agentFixture({
    hooks: [
      {
        args: {},
        id: "prepare-user",
        mode: "silent",
        runLimit: -1,
        target: "agent",
        tool: "before",
        when: "before",
      },
    ],
    tools: [before],
  });
  const { context, db, model } = fixture,
    texts = ["initial", "queued one", "queued two"];
  db.resetSession("target", workspace);
  for (const text of texts) {
    db.appendUser("target", text);
  }
  await processInput(context, required(db.nextInput("target")));
  expect(model.doStreamCalls).toHaveLength(1);
  expect(model.doStreamCalls[0]?.prompt.filter(({ role }) => role === "user")).toMatchObject(
    texts.map((text) => ({ content: [{ text, type: "text" }], role: "user" })),
  );
  expect(hooks).toBe(texts.length);
  expect(
    db
      .history("target")
      .filter((message) => HumanMessage.isInstance(message))
      .map(({ text }) => text),
  ).toEqual(texts);
  expect(db.nextInput("target")).toBeNull();
});
test("an arriving message waits for the active request without aborting or replaying it", async () => {
  const started = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>(),
    model = new MockLanguageModelV4({
      doStream: async () => {
        if (model.doStreamCalls.length === 1) {
          started.resolve();
          await release.promise;
          return textResponse("first reply");
        }
        return textResponse("updated reply");
      },
    });
  using fixture = agentFixture({ model });
  const { context, db } = fixture;
  db.resetSession("target", workspace);
  db.appendUser("target", "initial");
  const running = processInput(context, required(db.nextInput("target")));
  try {
    await started.promise;
    db.appendUser("target", "arrived while running");
    expect(db.pendingInputs("target")).toHaveLength(1);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0]?.abortSignal?.aborted).toBe(false);
    release.resolve();
    await running;
    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls[1]?.prompt.at(-1)).toEqual({
      content: [{ text: "arrived while running", type: "text" }],
      role: "user",
    });
    expect(db.history("target").map(({ text }) => text)).toEqual([
      "initial",
      "first reply",
      "arrived while running",
      "updated reply",
    ]);
    expect(db.nextInput("target")).toBeNull();
  } finally {
    release.resolve();
    await running;
  }
});
