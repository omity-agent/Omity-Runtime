import type { StructuredToolInterface } from "@langchain/core/tools";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { createAgentGraph } from "../../../src/agent";
import { ToolExecutions } from "../../../src/agent/toolExecutions";
import { BunSqliteSaver } from "../../../src/checkpointer/saver";
import { HookRuntime } from "../../../src/hooks/runtime";
import { Logger } from "../../../src/infrastructure/logging/logger";
import type { HostContext } from "../../../src/runtime/context";
import type { HookRule } from "../../../src/types";
import { testSettings } from "../../support/configuration";
import { makeDb, workspace } from "../../support/database";

export function agentFixture({
  db: existingDatabase,
  freeformToolParameters = new Map<string, string>(),
  hooks: rules = [],
  model = new MockLanguageModelV4({ doStream: textResponse() }),
  sessionId = "target",
  tools = [],
}: {
  db?: ReturnType<typeof makeDb>;
  freeformToolParameters?: ReadonlyMap<string, string>;
  hooks?: HookRule[];
  model?: MockLanguageModelV4;
  sessionId?: string;
  tools?: StructuredToolInterface[];
} = {}) {
  const db = existingDatabase ?? makeDb(),
    settings = testSettings({
      hooks: rules,
      model: freeformToolParameters.size > 0 ? { adapter: "responses-sse" } : undefined,
    }),
    logger = new Logger("error", true),
    checkpointer = new BunSqliteSaver(db.db),
    executions = new ToolExecutions({
      cancellationRequested: (callId) => db.toolCancellation(sessionId, callId),
      pollMs: settings.host.pollMs,
    }),
    hooks = new HookRuntime(
      settings.hooks,
      tools,
      db.db,
      logger,
      sessionId,
      workspace,
      freeformToolParameters,
    ),
    graph = createAgentGraph({
      checkpointer,
      hooks,
      model,
      settings,
      toolExecutions: executions,
      tools,
    }),
    context: HostContext = {
      controller: new AbortController(),
      db,
      graph,
      logger,
      sessionId,
      settings,
      toolExecutions: executions,
    };
  return {
    context,
    db,
    executions,
    model,
    [Symbol.dispose]() {
      executions.close();
      if (!existingDatabase) {
        db.close();
      }
    },
  };
}
const usage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1, total: 1 },
  outputTokens: { reasoning: 0, text: 1, total: 1 },
};
export function textResponse(text = "continued") {
  return {
    stream: simulateReadableStream({
      chunks: [
        { id: "answer", type: "text-start" as const },
        { delta: text, id: "answer", type: "text-delta" as const },
        { id: "answer", type: "text-end" as const },
        {
          finishReason: { raw: undefined, unified: "stop" as const },
          type: "finish" as const,
          usage,
        },
      ],
    }),
  };
}
export function toolResponse(calls = [{ id: "echo-call", name: "echo" }], reasoning?: string) {
  return {
    stream: simulateReadableStream({
      chunks: [
        ...(reasoning === undefined
          ? []
          : [
              { id: "0", type: "reasoning-start" as const },
              { delta: reasoning, id: "0", type: "reasoning-delta" as const },
              { id: "0", type: "reasoning-end" as const },
            ]),
        ...calls.flatMap(({ id, name }) => [
          { id, toolName: name, type: "tool-input-start" as const },
          { delta: "{}", id, type: "tool-input-delta" as const },
          { id, type: "tool-input-end" as const },
          { input: "{}", toolCallId: id, toolName: name, type: "tool-call" as const },
        ]),
        {
          finishReason: { raw: undefined, unified: "tool-calls" as const },
          type: "finish" as const,
          usage,
        },
      ],
    }),
  };
}
