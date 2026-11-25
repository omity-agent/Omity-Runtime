import { afterEach, expect, test } from "bun:test";

import { HumanMessage, ToolMessage } from "@langchain/core/messages";

import { toModelMessages } from "../../../src/agent/messages/encode";
import { type AiStreamEvent, streamAiModel } from "../../../src/agent/model/request";
import { aiModelTools } from "../../../src/agent/model/tools";
import { containingItems } from "../../support/asymmetric";
import { cleanupDatabaseDirs, makeDb, required, workspace } from "../../support/database";
import { echoDefinition, geminiApis, geminiWire } from "./endpointFixture";
import { replyStream, toolStream } from "./exchangeSamples";

afterEach(cleanupDatabaseDirs);
test.each([...geminiApis])(
  "%s streams reasoning and tools, persists signatures, and continues with multimodal results",
  async (api) => {
    await using wire = geminiWire(api, [toolStream(api), replyStream(api)]);
    using db = makeDb();
    const user = new HumanMessage("Echo hello"),
      events: string[] = [],
      options = {
        sessionId: "gemini",
        settings: wire.settings,
        tools: aiModelTools([echoDefinition], api),
        write: ({ part }: AiStreamEvent) => {
          events.push(part.type);
        },
      },
      response = await streamAiModel({ ...options, messages: [user] });
    expect(response.tool_calls).toEqual([
      { args: { text: "hello" }, id: "echo-call", name: "echo", type: "tool_call" },
    ]);
    expect(events).toEqual<unknown>(
      containingItems(["reasoning-delta", "tool-input-delta", "tool-call"]),
    );
    expect(response.response_metadata["usage"]).toMatchObject({
      cacheRead: 3,
      input: 10,
      output: 7,
    });
    db.createSession("gemini", workspace);
    await db.syncHistory("gemini", [user, response]);
    const restored = required(db.history("gemini").at(-1)),
      result = await streamAiModel({
        ...options,
        messages: [
          user,
          restored,
          new ToolMessage({
            content: [
              { text: "hello", type: "text" },
              { data: "aGVsbG8=", mimeType: "image/png", type: "image" },
            ],
            name: "echo",
            tool_call_id: "echo-call",
          }),
        ],
      });
    expect(toModelMessages([restored], api)).toEqual(toModelMessages([response], api));
    expect(result.text).toBe("Finished");
    expect(events).toContain("text-delta");
    const request = required(wire.requests[1]);
    expect(request.headers.get("x-goog-api-key")).toBe("gemini-test-key");
    expect(request.body).not.toHaveProperty("tool_choice");
    if (api === "interactions") {
      expect(request.path).toBe("/v1beta/interactions");
      expect(request.body).toMatchObject({
        generation_config: {
          thinking_level: "high",
          thinking_summaries: "auto",
          tool_choice: "validated",
        },
        input: containingItems([
          {
            signature: "reasoning-signature",
            summary: [{ text: "Need a tool", type: "text" }],
            type: "thought",
          },
          {
            arguments: { text: "hello" },
            id: "echo-call",
            name: "echo",
            signature: "tool-signature",
            type: "function_call",
          },
          {
            call_id: "echo-call",
            name: "echo",
            result: [
              { text: "hello", type: "text" },
              { data: "aGVsbG8=", mime_type: "image/png", type: "image" },
            ],
            type: "function_result",
          },
        ]),
        store: false,
        system_instruction: "test",
      });
      expect(request.body).not.toHaveProperty("previous_interaction_id");
    } else {
      expect(request.path).toBe("/v1beta/models/gemini-3-flash-preview:streamGenerateContent");
      expect(request.body).toMatchObject({
        contents: containingItems([
          {
            parts: [
              { text: "Need a tool", thought: true, thoughtSignature: "reasoning-signature" },
              {
                functionCall: { args: { text: "hello" }, id: "echo-call", name: "echo" },
                thoughtSignature: "tool-signature",
              },
            ],
            role: "model",
          },
          {
            parts: [
              {
                functionResponse: {
                  id: "echo-call",
                  name: "echo",
                  parts: [{ inlineData: { data: "aGVsbG8=", mimeType: "image/png" } }],
                  response: { content: "hello", name: "echo" },
                },
              },
            ],
            role: "user",
          },
        ]),
        generationConfig: { thinkingConfig: { includeThoughts: true, thinkingLevel: "high" } },
        systemInstruction: { parts: [{ text: "test" }] },
        toolConfig: { functionCallingConfig: { mode: "VALIDATED" } },
      });
    }
  },
);
