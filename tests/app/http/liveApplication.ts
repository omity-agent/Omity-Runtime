import { rmSync } from "node:fs";
import { join } from "node:path";

import { AccessService } from "../../../src/app/access/service";
import { AppController } from "../../../src/app/controller";
import { createHttpServer } from "../../../src/app/http/transport";
import { closeAppResources } from "../../../src/app/runtime/shutdown";
import { loadSettings } from "../../../src/infrastructure/configuration/settings/load";
import { createTestDirectory } from "../../support/artifacts";
import { writeTestConfiguration } from "../../support/configuration";
import { scopedEnvironment } from "../../support/scopedEnvironment";

export function liveApplication(adapter: "completions" | "responses-sse" = "completions") {
  const root = createTestDirectory("http-workflow"),
    modelName = adapter === "responses-sse" ? "gpt-6.1-sol" : "test",
    requests: unknown[] = [],
    model = Bun.serve({
      async fetch(request) {
        requests.push(await request.json());
        if (adapter === "responses-sse") {
          return responsesReply(modelName);
        }
        const frame = {
            choices: [{ delta: { content: "workflow answer" }, finish_reason: null, index: 0 }],
            created: 1,
            id: "workflow-reply",
            model: modelName,
            object: "chat.completion.chunk",
          },
          ending = { ...frame, choices: [{ delta: {}, finish_reason: "stop", index: 0 }] };
        return new Response(
          `${[frame, ending]
            .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
            .join("")}data: [DONE]\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        );
      },
      hostname: "127.0.0.1",
      port: 0,
    }),
    environment = scopedEnvironment({
      OMITY_HOME: join(root, "home"),
      TEST_KEY: "local-workflow",
    });
  writeTestConfiguration(root, {
    agentYaml: `recursionLimit: 50
prompts: [system.md]
toolOutput: { maxTokens: 8192 }
toolExecution: { parallel: true }
skills: { enabled: false, directory: ~/.agents/skills, skillEnabled: {} }
`,
    modelYaml: `adapter: ${adapter}
model: ${modelName}
apiKeyEnv: TEST_KEY
baseURL: ${new URL("/v1", model.url).href}
maxConcurrentRequests: 1
temperature: ${adapter === "responses-sse" ? "null" : "0"}
reasoning_effort: ${adapter === "responses-sse" ? "medium" : "null"}
raceIntervalMs: 1000
retryDelayMs: 1000
`,
  });
  const controller = new AppController(root),
    access = new AccessService(loadSettings(root)),
    server = createHttpServer({
      access,
      controller,
      hostname: "127.0.0.1",
      port: 0,
      staticRoot: join(root, "frontend"),
    });
  return {
    controller,
    requests,
    root,
    url: server.url.origin,
    async [Symbol.asyncDispose]() {
      try {
        await closeAppResources(
          {
            access,
            controller,
            releaseLock: () => {},
            server,
          },
          { error: console.error, info: () => {} },
          "SIGTERM",
        );
      } finally {
        await model.stop(true);
        environment.dispose();
        rmSync(root, { force: true, recursive: true });
      }
    },
  };
}
function responsesReply(model: string) {
  const message = {
      content: [{ annotations: [], text: "workflow answer", type: "output_text" }],
      id: "workflow-message",
      role: "assistant",
      type: "message",
    },
    events = [
      {
        response: { created_at: 1, id: "workflow-response", model },
        type: "response.created",
      },
      {
        item: { ...message, content: [] },
        output_index: 0,
        type: "response.output_item.added",
      },
      {
        content_index: 0,
        delta: "workflow answer",
        item_id: message.id,
        output_index: 0,
        type: "response.output_text.delta",
      },
      { item: message, output_index: 0, type: "response.output_item.done" },
      {
        response: { usage: { input_tokens: 1, output_tokens: 1 } },
        type: "response.completed",
      },
    ];
  return new Response(
    events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}
