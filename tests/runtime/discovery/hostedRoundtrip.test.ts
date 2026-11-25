import { afterEach, expect, test } from "bun:test";

import { HumanMessage, ToolMessage } from "@langchain/core/messages";

import { toModelMessages } from "../../../src/agent/messages/encode";
import { streamAiModel } from "../../../src/agent/model/request";
import { aiModelTools } from "../../../src/agent/model/tools";
import { modelTokenUsage } from "../../../src/app/timeline/tokenCounts";
import { anyValue, containingItems, partialObject } from "../../support/asymmetric";
import { cleanupDatabaseDirs, makeDb, required, workspace } from "../../support/database";
import {
  deferredDefinition,
  discoverySettings,
  messagesSearchEvents,
  responsesSearchEvents,
  wireModel,
} from "./wireFixtures";

afterEach(cleanupDatabaseDirs);
test.each(["responses", "messages"] as const)(
  "%s streams hosted discovery and replays it after persistence without local search execution",
  async (api) => {
    await using wire = wireModel(
      api,
      api === "responses" ? responsesSearchEvents() : messagesSearchEvents(),
    );
    using db = makeDb();
    const { model, requests } = wire,
      tools = aiModelTools([deferredDefinition], api),
      options = { model, sessionId: "discovery", settings: discoverySettings(api), tools },
      response = await streamAiModel({ ...options, messages: [new HumanMessage("Find a file")] });
    expect(response.tool_calls).toMatchObject([
      { args: { query: "file" }, id: "call-1", name: "find_file" },
    ]);
    expect(response.tool_calls).toHaveLength(1);
    db.createSession("discovery", workspace);
    await db.syncHistory("discovery", [new HumanMessage("Find a file"), response]);
    const restored = required(db.history("discovery").at(-1));
    expect(required(modelTokenUsage(restored)).cacheReadTokens).toBeUndefined();
    expect(toModelMessages([restored], api)).toEqual(toModelMessages([response], api));
    await expect(
      streamAiModel({
        ...options,
        messages: [
          new HumanMessage("Find a file"),
          restored,
          new ToolMessage({ content: "found", name: "find_file", tool_call_id: "call-1" }),
        ],
      }),
    ).rejects.toThrow("request captured");
    expect(requests).toHaveLength(2);
    if (api === "responses") {
      for (const request of requests) {
        expect(request).not.toHaveProperty("instructions");
        expect(request["input"]).toHaveProperty("0", { content: "test", role: "developer" });
      }
      expect(requests[0]?.["tools"]).toEqual(
        containingItems([
          partialObject({ defer_loading: true, name: "find_file", type: "function" }),
          { execution: "server", type: "tool_search" },
        ]),
      );
      expect(requests[1]?.["input"]).toEqual(
        containingItems([
          partialObject({
            arguments: { paths: ["find_file"] },
            execution: "server",
            type: "tool_search_call",
          }),
          partialObject({
            execution: "server",
            tools: anyValue(Array),
            type: "tool_search_output",
          }),
          partialObject({
            call_id: "call-1",
            output: "found",
            type: "function_call_output",
          }),
        ]),
      );
    } else {
      expect(requests[0]).toMatchObject({
        system: [{ text: "test", type: "text" }],
        tools: [
          { defer_loading: true, name: "find_file" },
          { name: "tool_search_tool_regex", type: "tool_search_tool_regex_20251119" },
        ],
      });
      expect(requests[1]?.["messages"]).toEqual(
        containingItems([
          partialObject({
            content: [
              partialObject({
                id: "search-1",
                input: { pattern: "file" },
                type: "server_tool_use",
              }),
              partialObject({
                content: {
                  tool_references: [{ tool_name: "find_file", type: "tool_reference" }],
                  type: "tool_search_tool_search_result",
                },
                tool_use_id: "search-1",
                type: "tool_search_tool_result",
              }),
              partialObject({ id: "call-1", type: "tool_use" }),
            ],
            role: "assistant",
          }),
        ]),
      );
    }
  },
);
test("Messages adapter retains a hosted search pause without inventing a local tool call", async () => {
  await using wire = wireModel("messages", messagesSearchEvents(true));
  const { model } = wire,
    response = await streamAiModel({
      messages: [new HumanMessage("Find a file")],
      model,
      sessionId: "paused-search",
      settings: discoverySettings("messages"),
      tools: aiModelTools([deferredDefinition], "messages"),
    });
  expect(response.tool_calls).toEqual([]);
  expect(response.response_metadata["rawFinishReason"]).toBe("pause_turn");
  expect(response.additional_kwargs["aiSdkContent"]).toHaveLength(2);
});
