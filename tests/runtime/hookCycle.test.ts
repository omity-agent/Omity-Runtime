import { afterEach, expect, test } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";

import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { buildTimeline } from "../../src/app/timeline";
import { loadTranscript } from "../../src/app/transcript";
import { isHookCallId } from "../../src/hooks/storage/calls";
import { processInput } from "../../src/runtime/consumeInputs";
import { cleanupDatabaseDirs, required, workspace } from "../support/database";
import { agentFixture, textResponse, toolResponse } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
test("Freeform hooks bracket a structured tool call without recursive hooks", async () => {
  const calls: string[] = [],
    text = "inspect\n  another line\n",
    release = Promise.withResolvers<void>(),
    visible = Promise.withResolvers<void>(),
    hookTool = tool(
      async ({ message }) => {
        calls.push(message);
        if (calls.length === 2) {
          await release.promise;
        }
        return message;
      },
      { description: "hook", name: "hook", schema: z.object({ message: z.string() }) },
    ),
    originalTool = tool(
      () => {
        calls.push("original");
        return "done";
      },
      { description: "original", name: "original", schema: z.object({}) },
    ),
    rule = {
      mode: "silent",
      runLimit: -1,
      target: "original",
      tool: "hook",
      when: "before",
    } as const;
  using fixture = agentFixture({
    freeformToolParameters: new Map([["hook", "message"]]),
    hooks: [
      { ...rule, id: "silent-before", input: text },
      { ...rule, id: "before", input: "${toolOutputs.fromEnd.1.output}", mode: "takeover" },
      { ...rule, id: "after", input: "", mode: "takeover", when: "after" },
      { ...rule, id: "must-not-run", input: "recursive", target: "hook" },
    ],
    model: new MockLanguageModelV4({
      doStream: [toolResponse([{ id: "original-call", name: "original" }]), textResponse("done")],
    }),
    sessionId: "session",
    tools: [hookTool, originalTool],
  });
  fixture.db.resetSession("session", workspace);
  fixture.db.appendUser("session", "run");
  fixture.db.onChange((event) => {
    if (event.kind === "tool_started" && isHookCallId(event.value)) {
      visible.resolve();
    }
  });
  const processing = processInput(fixture.context, required(fixture.db.nextInput("session")));
  try {
    await Promise.race([visible.promise, delay(5000, undefined, { ref: false })]);
    const live = buildTimeline(loadTranscript(fixture.db.db, "session"))
      .flatMap(({ parts }) => parts)
      .filter((part) => part.type === "tool" && isHookCallId(part.call.id));
    expect(live).toMatchObject([{ call: { name: "hook", rawInput: text }, phase: "running" }]);
  } finally {
    release.resolve();
    await processing;
  }
  expect(calls).toEqual([text, text, "original", ""]);
  const history = fixture.db.history("session"),
    storedCalls = history.flatMap((message, index) => {
      if (!AIMessage.isInstance(message)) {
        return [];
      }
      const next = history[index + 1];
      return (message.tool_calls ?? []).filter((call) => {
        expect(ToolMessage.isInstance(next) ? next.tool_call_id : undefined).toBe(
          required(call.id),
        );
        return isHookCallId(call.id);
      });
    }),
    promptCalls = fixture.model.doStreamCalls
      .at(-1)
      ?.prompt.flatMap((message) => (message.role === "assistant" ? message.content : []))
      .filter((part) => part.type === "tool-call" && part.toolName === "hook");
  expect(storedCalls).toMatchObject(
    [text, ""].map((input) => ({ args: { input }, isCustomTool: true })),
  );
  expect(storedCalls.every(({ id }) => /^[A-Za-z0-9_-]+$/.test(required(id)))).toBe(true);
  expect(promptCalls).toMatchObject([text, ""].map((input) => ({ input })));
}, 10_000);
