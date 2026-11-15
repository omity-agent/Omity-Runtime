import { expect, spyOn, test } from "bun:test";
import { join } from "node:path";

import { z } from "zod";

import { localize } from "../../../src/i18n/server";
import { Logger } from "../../../src/infrastructure/logging/logger";
import { RestartingStdioClient } from "../../../src/infrastructure/mcp/client/restarting";
import { containingText } from "../../support/asymmetric";

test("real MCP process crash rejects the interrupted call and the next call uses a new child", async () => {
  const client = await RestartingStdioClient.create(
    "crash-recovery",
    { args: [join(import.meta.dir, "crashingToolServer.ts")], command: process.execPath },
    { delayMs: 0, maxAttempts: 1 },
    new Logger("error", true),
  );
  try {
    expect(client.getProtocolEra()).toBe("legacy");
    const catalog = await client.listTools({});
    expect(catalog.tools.map(({ name }) => name).toSorted()).toEqual(["crash", "identity"]);
    const before = await client.callTool({ arguments: {}, name: "identity" });
    let failure: unknown;
    try {
      await client.callTool(
        { arguments: {}, name: "crash" },
        { signal: AbortSignal.timeout(5000) },
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: "MCP_STDIO_PROCESS_EXITED",
      diagnostics: containingText("intentional tool process crash"),
    });
    const after = await client.callTool({ arguments: {}, name: "identity" }),
      schema = z.object({ content: z.array(z.object({ text: z.string() })) });
    expect(client.getProtocolEra()).toBe("legacy");
    expect(schema.parse(after).content).not.toEqual(schema.parse(before).content);
  } finally {
    await client.close();
  }
  await expect(client.listTools({})).rejects.toThrow("正在关闭");
}, 10_000);
test("closing a real MCP process immediately rejects new requests", async () => {
  const client = await RestartingStdioClient.create(
      "closing-client",
      { args: [join(import.meta.dir, "crashingToolServer.ts")], command: process.execPath },
      { delayMs: 0, maxAttempts: 1 },
      new Logger("error", true),
    ),
    closing = client.close(),
    concurrentClose = client.close();
  try {
    await expect(client.listTools({})).rejects.toThrow("正在关闭");
    await Promise.all([closing, concurrentClose]);
    expect(client.getProtocolEra()).toBeUndefined();
  } finally {
    await Promise.all([closing, concurrentClose]);
  }
}, 10_000);
test("shutdown during restart backoff reports cancellation without a recovery error", async () => {
  const logger = new Logger("error", true),
    failedAttempt = Promise.withResolvers<void>(),
    warnings = spyOn(logger, "warn").mockImplementation((message) => {
      if (message === localize("mcp:client.processRestartFailed")) {
        failedAttempt.resolve();
      }
    }),
    errors = spyOn(logger, "error").mockReturnValue(),
    connection = {
      args: [join(import.meta.dir, "crashingToolServer.ts")],
      command: process.execPath,
    },
    client = await RestartingStdioClient.create(
      "closing-recovery",
      connection,
      { delayMs: 5000, maxAttempts: 3 },
      logger,
    );
  connection.args = ["--eval", 'throw new Error("initialization unavailable")'];
  const interrupted = (async () => {
    try {
      return await client.callTool({ arguments: {}, name: "crash" });
    } catch (error: unknown) {
      return error;
    }
  })();
  try {
    await failedAttempt.promise;
    await client.close();
    expect(await interrupted).toHaveProperty("message", containingText("正在关闭"));
    expect(errors).not.toHaveBeenCalled();
  } finally {
    await client.close();
    await interrupted;
    warnings.mockRestore();
    errors.mockRestore();
  }
}, 10_000);
