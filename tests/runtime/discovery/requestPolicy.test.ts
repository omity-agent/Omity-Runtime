import { expect, test } from "bun:test";

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

import { structuredRequestOptions } from "../../../src/agent/model/provider";
import { aiModelTools } from "../../../src/agent/model/tools";
import { discoverySettings, wireModel } from "./wireFixtures";

test.each(["completions", "responses", "messages"] as const)(
  "%s explicitly disables tools for empty main and structured requests",
  async (api) => {
    await using wire = wireModel(api);
    const settings = discoverySettings(api);
    await expect(wire.requestModel()).rejects.toThrow("request captured");
    await expect(
      generateText({
        ...structuredRequestOptions(settings.model),
        maxRetries: 0,
        model: wire.model,
        output: Output.object({ schema: z.object({ reply: z.string() }) }),
        prompt: "Predict a reply",
      }),
    ).rejects.toThrow("request captured");
    expect(wire.requests).toHaveLength(2);
    for (const request of wire.requests) {
      expect(request).toMatchObject({
        tool_choice: api === "messages" ? { type: "none" } : "none",
        tools: [],
      });
    }
  },
);
test.each(["completions", "responses", "messages"] as const)(
  "%s preserves application functions even when named like built-in tools",
  async (api) => {
    await using wire = wireModel(api);
    await expect(
      wire.requestModel(
        aiModelTools(
          [
            {
              description: "Local search",
              freeform: false,
              inputSchema: { type: "object" },
              name: "web_search",
            },
          ],
          api,
        ),
      ),
    ).rejects.toThrow("request captured");
    expect(wire.requests[0]?.["tools"]).toHaveLength(1);
    expect(wire.requests[0]?.["tool_choice"]).toEqual(
      api === "messages" ? { type: "auto" } : "auto",
    );
  },
);
test.each(["responses", "messages"] as const)(
  "%s rejects built-in web search before sending a request",
  async (api) => {
    await using wire = wireModel(api);
    await expect(
      wire.requestModel({
        search:
          api === "responses" ? openai.tools.webSearch({}) : anthropic.tools.webSearch_20250305({}),
      }),
    ).rejects.toThrow("供应商内置工具已禁用");
    expect(wire.requests).toHaveLength(0);
  },
);
test("Responses preserves application free-form tools", async () => {
  await using wire = wireModel("responses");
  await expect(
    wire.requestModel(
      aiModelTools(
        [
          {
            description: "Local command",
            freeform: true,
            inputSchema: { type: "object" },
            name: "shell",
          },
        ],
        "responses",
      ),
    ),
  ).rejects.toThrow("request captured");
  expect(wire.requests[0]?.["tools"]).toEqual([
    expect.objectContaining({ name: "shell", type: "custom" }),
  ]);
});
