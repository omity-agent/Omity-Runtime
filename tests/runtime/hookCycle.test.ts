import { afterEach, expect, test } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";

import { AIMessage, type BaseMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { buildTimeline } from "../../src/app/timeline";
import { loadTranscript } from "../../src/app/transcript";
import { isHookCallId } from "../../src/hooks/storage/calls";
import { processInput } from "../../src/runtime/consumeInputs";
import type { HookRule } from "../../src/types";
import { cleanupDatabaseDirs, required, workspace } from "../support/database";
import { agentFixture, textResponse, toolResponse } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
test("takeover hooks bracket an Agent tool cycle without recursive hooks", async () => {
  const calls: string[] = [],
    release = Promise.withResolvers<void>(),
    visible = Promise.withResolvers<void>(),
    hookTool = makeTool("hook", () => {
      calls.push("hook");
      return calls.length === 2 ? release.promise : undefined;
    }),
    originalTool = makeTool("original", () => calls.push("original"));
  using fixture = agentFixture({
    hooks: [
      rule("silent-before", "original", "before"),
      rule("before", "original", "before", "takeover"),
      rule("after", "original", "after", "takeover"),
      rule("must-not-run", "hook", "before"),
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
    expect(live).toMatchObject([
      { call: { input: { message: "inspect" }, name: "hook" }, phase: "running" },
    ]);
  } finally {
    release.resolve();
    await processing;
  }
  expect(calls).toEqual(["hook", "hook", "original", "hook"]);
  const history = fixture.db.history("session"),
    hookIds = history
      .filter((message) => AIMessage.isInstance(message))
      .flatMap((message) => message.tool_calls ?? [])
      .map((call) => call.id)
      .filter(isHookCallId);
  expect(hookIds).toHaveLength(2);
  expect(hookIds.every((id) => /^[A-Za-z0-9_-]+$/.test(id))).toBe(true);
  assertToolProtocol(history);
}, 10_000);
function makeTool(name: string, record: () => unknown) {
  return tool(
    async () => {
      await record();
      return `${name}-result`;
    },
    { description: name, name, schema: z.object({ message: z.string().optional() }) },
  );
}
function rule(
  id: string,
  target: string,
  when: HookRule["when"],
  mode: HookRule["mode"] = "silent",
): HookRule {
  return { args: { message: "inspect" }, id, mode, runLimit: -1, target, tool: "hook", when };
}
function assertToolProtocol(messages: BaseMessage[]) {
  for (const [index, message] of messages.entries()) {
    if (AIMessage.isInstance(message)) {
      for (const call of message.tool_calls ?? []) {
        const next = messages[index + 1];
        expect(next).toBeInstanceOf(ToolMessage);
        expect(ToolMessage.isInstance(next) ? next.tool_call_id : undefined).toBe(
          required(call.id),
        );
      }
    }
  }
}
