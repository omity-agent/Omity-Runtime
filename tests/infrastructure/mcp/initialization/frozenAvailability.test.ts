import { expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { Logger } from "../../../../src/infrastructure/logging/logger";
import { loadMcp, loadSessionMcp } from "../../../../src/infrastructure/mcp/tools/catalog";
import { snapshotMcpTools } from "../../../../src/infrastructure/mcp/tools/definitions";
import { createTestDirectory } from "../../../support/artifacts";
import { fixtureTools } from "../../../support/builtins";
import { testProfiles, writeFixtureYaml } from "../../../support/configuration";

test.each([true, false])(
  "session tools remain callable after configuration disables them (server prefix: %s)",
  async (prefixToolNameWithServerName) => {
    const root = createTestDirectory("frozen-mcp-availability"),
      logger = new Logger("error", true),
      { context, profileDirectory } = testProfiles(root),
      server = {
        args: [
          join(import.meta.dir, "../../../app/http/preferences/argumentServer.ts"),
          "original",
        ],
        command: process.execPath,
        defer_loading: prefixToolNameWithServerName,
        enabled: true,
        freeformToolInputs: prefixToolNameWithServerName ? [] : ["original"],
        prefixToolNameWithServerName,
      },
      toolboxes = {
        choice: fixtureTools.choice,
        update_title: { ...fixtureTools.update_title, enabled: false },
      },
      configuration = {
        mcpServers: { active: server },
        toolNameOverrides: {
          [prefixToolNameWithServerName ? "active__original" : "original"]: "frozen_tool",
        },
        toolboxes,
      };
    try {
      writeFixtureYaml(profileDirectory, "toolbox", configuration);
      const initial = await loadMcp(root, logger, context),
        snapshot = snapshotMcpTools(initial, { cwd: root, session: root });
      await initial.close();
      writeFixtureYaml(profileDirectory, "toolbox", {
        ...configuration,
        mcpServers: { active: { ...server, defer_loading: false, enabled: false } },
        toolboxes: {
          choice: { ...fixtureTools.choice, enabled: false },
          update_title: fixtureTools.update_title,
        },
      });
      const fresh = await loadMcp(root, logger, context);
      try {
        expect(Object.keys(fresh.configuration.mcpServers)).toEqual([]);
        expect(fresh.tools.map(({ name }) => name)).toEqual([fixtureTools.update_title.name]);
      } finally {
        await fresh.close();
      }
      const restored = await loadSessionMcp(logger, context, snapshot);
      try {
        expect(Object.keys(restored.configuration.mcpServers)).toEqual(["active"]);
        expect(restored.tools.map(({ name }) => name)).toEqual(
          snapshot.tools.map(({ name }) => name),
        );
        expect(restored.freeformToolParameters.has("frozen_tool")).toBe(
          !prefixToolNameWithServerName,
        );
        const tool = restored.tools.find(({ name }) => name === "frozen_tool")!;
        expect(tool.extras?.["defer_loading"]).toBe(prefixToolNameWithServerName);
        expect(await tool.invoke({ input: "after restart" })).toContain("after restart");
      } finally {
        await restored.close();
      }
      writeFixtureYaml(profileDirectory, "toolbox", {
        ...configuration,
        mcpServers: {
          active: {
            ...server,
            args: [
              join(import.meta.dir, "../../../app/http/preferences/argumentServer.ts"),
              "replacement",
            ],
            enabled: false,
          },
        },
      });
      await expect(loadSessionMcp(logger, context, snapshot)).rejects.toMatchObject({
        code: "MCP_LOAD_FAILED",
        details: {
          failures: [
            {
              error: { message: "会话冻结的 MCP 工具不存在：frozen_tool" },
              stage: "customization",
            },
          ],
        },
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  },
  15_000,
);
test("session server selections override changed configuration activation flags", async () => {
  const root = createTestDirectory("frozen-server-selection"),
    logger = new Logger("error", true),
    { context, profileDirectory } = testProfiles(root),
    server = {
      args: [join(import.meta.dir, "../../../app/http/preferences/argumentServer.ts"), "identity"],
      command: process.execPath,
    },
    overrides = { excluded: false, selected: true };
  try {
    writeFixtureYaml(profileDirectory, "toolbox", {
      mcpServers: {
        excluded: { command: `\${OMITY_FROZEN_EXCLUDED_COMMAND}`, enabled: false },
        selected: { ...server, enabled: true },
      },
    });
    const initial = await loadMcp(root, logger, context, { serverOverrides: overrides }),
      snapshot = snapshotMcpTools(initial, { cwd: root, session: root }, overrides);
    await initial.close();
    writeFixtureYaml(profileDirectory, "toolbox", {
      mcpServers: {
        excluded: { command: `\${OMITY_FROZEN_EXCLUDED_COMMAND}`, enabled: true },
        selected: { ...server, enabled: false },
      },
    });
    const restored = await loadSessionMcp(logger, context, snapshot);
    try {
      expect(Object.keys(restored.configuration.mcpServers)).toEqual(["selected"]);
      expect(restored.tools.map(({ name }) => name)).toEqual(
        snapshot.tools.map(({ name }) => name),
      );
      expect(
        await restored.tools
          .find(({ name }) => name === "selected__identity")!
          .invoke({
            input: "selected session",
          }),
      ).toContain("selected session");
    } finally {
      await restored.close();
    }
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}, 15_000);
