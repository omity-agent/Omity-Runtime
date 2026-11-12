import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { raceSignal } from "race-signal";
import type { z } from "zod";

import { httpServerOptions } from "../../../../settings/networking";
import { createAppMcp } from "../../../../src/app/runtime/resources/toolPool";
import { createSettingsContext } from "../../../../src/infrastructure/configuration/settings/context";
import type { mcpServerSchema } from "../../../../src/infrastructure/mcp/configuration/connections";
import { AskUserRuntime } from "../../../../src/infrastructure/toolbox/runtime";
import { createTestDirectory } from "../../../support/artifacts";
import { defaultBuiltIns, writeToolboxConfiguration } from "../../../support/builtins";

interface StartupCheckpoint {
  reached: PromiseWithResolvers<void>;
  response: PromiseWithResolvers<{ failure?: string }>;
}
export function coordinateStartup(declarations: Record<string, z.input<typeof mcpServerSchema>>) {
  const root = createTestDirectory("parallel-mcp-startup"),
    processes = new Map<string, number>(),
    checkpoints = new Map<string, StartupCheckpoint>(
      Object.keys(declarations).flatMap((name) =>
        ["boot", "tools", "listed"].map(
          (phase) =>
            [
              `/${name}/${phase}`,
              {
                reached: Promise.withResolvers<void>(),
                response: Promise.withResolvers<{ failure?: string }>(),
              },
            ] as const,
        ),
      ),
    ),
    server = Bun.serve({
      ...httpServerOptions,
      async fetch(request) {
        const url = new URL(request.url),
          checkpoint = checkpoints.get(url.pathname);
        if (!checkpoint) {
          return new Response("未知测试同步点", { status: 404 });
        }
        processes.set(url.pathname.split("/")[1]!, Number(url.searchParams.get("pid")));
        checkpoint.reached.resolve();
        const { failure } = await checkpoint.response.promise;
        return new Response(failure, { status: failure ? 500 : 200 });
      },
      hostname: "127.0.0.1",
      port: 0,
    }),
    endpoint = server.url.origin,
    mcpServers = Object.fromEntries(
      Object.entries(declarations).map(([name, configuration]) => [
        name,
        {
          args: [join(import.meta.dir, "gatedStdioServer.ts"), endpoint, name],
          command: process.execPath,
          ...configuration,
        },
      ]),
    );
  for (const name of Object.keys(declarations)) {
    checkpoints.get(`/${name}/listed`)!.response.resolve({});
  }
  mkdirSync(join(root, "settings"));
  writeToolboxConfiguration(root, {
    mcpServers,
    stdio: { restart: { delayMs: 0, maxAttempts: 1 } },
    toolboxes: Object.fromEntries(
      Object.entries(defaultBuiltIns()).map(([name, configuration]) => [
        name,
        { ...configuration, enabled: false },
      ]),
    ),
  });
  const context = createSettingsContext(root, join(root, "user-settings")),
    mcp = createAppMcp(root, "error", context, new AskUserRuntime(() => {}));
  function releaseAll() {
    for (const checkpoint of checkpoints.values()) {
      checkpoint.response.resolve({});
    }
  }
  return {
    async dispose(loading: Promise<unknown>) {
      releaseAll();
      try {
        await loading;
        await mcp.close();
      } finally {
        await server.stop(true);
        rmSync(root, { force: true, recursive: true });
      }
    },
    mcp,
    processes,
    release(name: string, phase: string, failure?: string) {
      checkpoints.get(`/${name}/${phase}`)!.response.resolve({ failure });
    },
    releaseAll,
    root,
    wait(name: string, phase: string) {
      return raceSignal(
        checkpoints.get(`/${name}/${phase}`)!.reached.promise,
        AbortSignal.timeout(5000),
      );
    },
  };
}
