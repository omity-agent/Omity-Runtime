import { afterEach, expect, test } from "bun:test";

import { AIMessage, type BaseMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { isHookCallId } from "../../src/hooks/storage/calls";
import type { HookRule } from "../../src/types";
import { cleanupDatabaseDirs, required, workspace } from "../support/database";
import { agentFixture, textResponse, toolResponse } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
test("takeover hooks bracket an Agent tool cycle without recursive hooks", async () => {
  const calls: string[] = [],
    hookTool = makeTool("hook", () => calls.push("hook")),
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
  const input = required(fixture.db.nextInput("session"));
  fixture.db.consumeInput("session", input);
  const result = await fixture.context.graph.invoke(
    { hookPendingUserIds: ["input:1"], messages: [{ content: "run", role: "user" }] },
    { configurable: { thread_id: input.runId.toString() } },
  );
  expect(calls).toEqual(["hook", "hook", "original", "hook"]);
  const hookIds = result.messages
    .filter((message) => AIMessage.isInstance(message))
    .flatMap((message) => message.tool_calls ?? [])
    .map((call) => call.id)
    .filter(isHookCallId);
  expect(hookIds).toHaveLength(2);
  expect(hookIds.every((id) => /^[A-Za-z0-9_-]+$/.test(id))).toBe(true);
  assertToolProtocol(result.messages);
});
function makeTool(name: string, record: () => void) {
  return tool(
    () => {
      record();
      return Promise.resolve(`${name}-result`);
    },
    { description: name, name, schema: z.object({}) },
  );
}
function rule(
  id: string,
  target: string,
  when: HookRule["when"],
  mode: HookRule["mode"] = "silent",
): HookRule {
  return { args: {}, id, mode, runLimit: -1, target, tool: "hook", when };
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
