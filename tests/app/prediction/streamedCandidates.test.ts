import { expect, test } from "bun:test";

import { createNetworkRuntime } from "../../../src/infrastructure/network/installNetworking";
import { completion, createPredictionFixture } from "./modelFixture";

test.each([false, true])(
  "WebSocket prediction consumes events and reports failures: %s",
  async (failed) => {
    await using value = await createPredictionFixture();
    await using resources = new AsyncDisposableStack();
    const { content } = completion(value.replies).choices[0]!.message,
      item = {
        content: [{ annotations: [], text: content, type: "output_text" }],
        id: "forecast-message",
        role: "assistant",
        type: "message",
      },
      server = Bun.serve({
        fetch(request, listener) {
          return listener.upgrade(request) ? undefined : new Response(null, { status: 400 });
        },
        hostname: "127.0.0.1",
        port: 0,
        websocket: {
          message(socket) {
            for (const event of [
              {
                response: { created_at: 1, id: "forecast-response", model: "test" },
                type: "response.created",
              },
              {
                item: { ...item, content: [] },
                output_index: 0,
                type: "response.output_item.added",
              },
              {
                delta: content,
                item_id: item.id,
                output_index: 0,
                type: "response.output_text.delta",
              },
              { item, output_index: 0, type: "response.output_item.done" },
              {
                response: failed
                  ? { error: { code: "upstream_error", message: "forecast unavailable" } }
                  : { usage: { input_tokens: 1, output_tokens: 1 } },
                type: failed ? "response.failed" : "response.completed",
              },
            ]) {
              socket.send(JSON.stringify(event));
            }
            socket.close(1000);
          },
        },
      });
    resources.defer(() => server.stop(true));
    const runtime = createNetworkRuntime(async () => {}),
      previousFetch = globalThis.fetch;
    resources.defer(() => runtime.close());
    resources.defer(() => {
      globalThis.fetch = previousFetch;
    });
    globalThis.fetch = runtime.fetch;
    if (
      !value.settings.prediction?.enabled ||
      value.settings.prediction.model.adapter === "codex"
    ) {
      throw new Error("Prediction fixture must use API key credentials");
    }
    value.settings.prediction.model = {
      ...value.settings.prediction.model,
      adapter: "responses-websocket",
      baseURL: new URL("/v1", server.url).href,
    };
    if (failed) {
      await expect(value.service.get(value.sessionId)).rejects.toThrow("forecast unavailable");
    } else {
      expect(await value.service.get(value.sessionId)).toEqual(value.replies);
    }
  },
);
