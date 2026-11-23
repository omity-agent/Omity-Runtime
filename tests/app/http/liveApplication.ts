import { rmSync } from "node:fs";
import { join } from "node:path";

import { AccessService } from "../../../src/app/access/service";
import { AppController } from "../../../src/app/controller";
import { createHttpServer } from "../../../src/app/http/transport";
import { closeAppResources } from "../../../src/app/runtime/shutdown";
import { userSettingsDirectory } from "../../../src/infrastructure/configuration/settings/files";
import { loadSettings } from "../../../src/infrastructure/configuration/settings/load";
import type { Settings } from "../../../src/types";
import { createTestDirectory } from "../../support/artifacts";
import { writeTestConfiguration } from "../../support/configuration";
import { scopedEnvironment } from "../../support/scopedEnvironment";

export function liveApplication({
  access: accessSettings,
  adapter = "completions",
  requestBodyLimitBytes,
}: {
  access?: Partial<Settings["access"]>;
  adapter?: "completions" | "responses-sse";
  requestBodyLimitBytes?: number;
} = {}) {
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
    }),
    { context, profileDirectory } = writeTestConfiguration(root, {
      access: accessSettings,
      model: {
        adapter,
        baseURL: new URL("/v1", model.url).href,
        model: modelName,
        reasoning_effort: adapter === "responses-sse" ? "medium" : undefined,
        temperature: adapter === "responses-sse" ? undefined : 0,
      },
      requestBodyLimitBytes,
      userDirectory: userSettingsDirectory(),
    }),
    settings = loadSettings(root, { settingsContext: context }),
    controller = new AppController(root, { settings, settingsContext: context }),
    access = new AccessService(settings),
    server = createHttpServer({
      access,
      controller,
      hostname: "127.0.0.1",
      port: 0,
      settings,
      staticRoot: join(root, "frontend"),
    });
  return {
    context,
    controller,
    profileDirectory,
    requests,
    root,
    settings,
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
