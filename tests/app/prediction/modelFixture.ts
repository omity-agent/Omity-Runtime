import { randomUUID } from "node:crypto";

import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";

import { PredictionService } from "../../../src/app/prediction/service";
import { sessionPaths } from "../../../src/infrastructure/configuration/sessionPaths";
import { AgentDatabase } from "../../../src/infrastructure/database/agentDatabase";
import { removeDatabaseDirectory } from "../../../src/infrastructure/database/sqlite/connection";
import { createTestDirectory } from "../../support/artifacts";
import { scopedEnvironment } from "../../support/scopedEnvironment";
import { testSettings } from "../../support/settings";

export async function createPredictionFixture(outputCount = 2) {
  await using cleanup = new AsyncDisposableStack();
  const home = createTestDirectory("forecast-home");
  cleanup.defer(() => removeDatabaseDirectory(home));
  const requests: Record<string, unknown>[] = [],
    replies = Array.from(
      { length: outputCount },
      (_, index) => `候选输入 ${(index + 1).toString()}`,
    ),
    apiKeyEnv = `PREDICTION_${randomUUID()}`,
    sessionId = randomUUID();
  cleanup.use(scopedEnvironment({ OMITY_HOME: home, [apiKeyEnv]: "local-test" }));
  const paths = sessionPaths(sessionId),
    database = cleanup.use(new AgentDatabase(paths.dbPath));
  let respond = () => Promise.resolve(Response.json(completion(replies)));
  const server = Bun.serve({
      fetch: async (request) => {
        requests.push(z.record(z.string(), z.unknown()).parse(await request.json()));
        return respond();
      },
      hostname: "127.0.0.1",
      port: 0,
    }),
    settings = testSettings();
  cleanup.defer(() => server.stop(true));
  settings.prediction = {
    enabled: true,
    maxUserMessageTokens: 200,
    model: {
      ...settings.model,
      adapter: "completions",
      apiKeyEnv,
      baseURL: new URL("/v1", server.url).href,
    },
    outputCount,
    refreshIntervalHours: 1,
    sampleContextTokens: 1,
    sampleCount: 1,
    task: "预测用户下一条输入",
  };
  database.createSession(sessionId, process.cwd());
  await database.syncHistory(sessionId, [
    new HumanMessage({ content: "请分析这段代码并给出详细设计", id: "first-user" }),
    new AIMessage({ content: "历史回复 <sample>", id: "sample-assistant" }),
    new HumanMessage({ content: "请继续实现 <latest-user>", id: "sample-user" }),
    new AIMessage({
      content: "准备执行",
      id: "working-assistant",
      tool_calls: [{ args: {}, id: "work-call", name: "work" }],
    }),
    new ToolMessage({ content: "执行结果", id: "work-result", tool_call_id: "work-call" }),
    new AIMessage({ content: "当前回复 <current>", id: "current-assistant" }),
  ]);
  const service = new PredictionService(settings);
  cleanup.defer(() => service.close());
  const resources = cleanup.move();
  return {
    database,
    home,
    paths,
    replies,
    requests,
    respondWith(response: () => Promise<Response>) {
      respond = response;
    },
    service,
    sessionId,
    settings,
    [Symbol.asyncDispose]: () => resources.disposeAsync(),
  };
}
export function completion(replies: readonly string[]) {
  return {
    choices: [
      {
        finish_reason: "stop",
        index: 0,
        message: {
          content: JSON.stringify(
            Object.fromEntries(
              replies
                .map((reply, index) => [`candidate_${(index + 1).toString()}`, reply])
                .toReversed(),
            ),
          ),
          role: "assistant",
        },
      },
    ],
    created: 1,
    id: "prediction-completion",
    model: "test",
    object: "chat.completion",
    usage: { completion_tokens: 10, prompt_tokens: 20, total_tokens: 30 },
  };
}
