import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createAppMcp } from "../../../../src/app/runtime/resources/toolPool";
import { readDefinitionRecord } from "../../../../src/infrastructure/database/records/session/metadata";
import { AskUserRuntime } from "../../../../src/infrastructure/toolbox/runtime";
import { openStoredSession } from "../../../../src/storedSessions";
import { containingItems, partialObject } from "../../../support/asymmetric";
import { writeFixtureYaml } from "../../../support/configuration";
import { liveApplication } from "../liveApplication";

test.each([true, false])(
  "MCP-owned original-name customizations survive server selection and snapshot restoration (prefix: %s)",
  async (prefixToolNameWithServerName) => {
    await using app = liveApplication({ adapter: "responses-sse" });
    const sourceName = prefixToolNameWithServerName ? "active__original" : "original",
      workspace = join(app.root, "workspace"),
      profileDirectory = join(app.context.userDirectory, "profiles", "custom"),
      server = {
        args: [resolve(import.meta.dir, "argumentServer.ts"), "original"],
        command: process.execPath,
        freeformToolInputs: ["original"],
        prefixToolNameWithServerName,
        toolDescriptionOverrides: { original: "prompts/original.md" },
      },
      configuration = {
        mcpServers: {
          active: server,
          inactive: {
            command: `\${OMITY_INACTIVE_COMMAND}`,
            freeformToolInputs: ["unavailable"],
            prefixToolNameWithServerName,
            toolDescriptionOverrides: { unavailable: `\${OMITY_INACTIVE_DESCRIPTION}` },
          },
        },
        toolNameOverrides: {
          missing_source: "unused_alias",
          [sourceName]: "renamed_tool",
        },
      };
    mkdirSync(workspace);
    mkdirSync(join(profileDirectory, "prompts"), { recursive: true });
    mkdirSync(join(app.profileDirectory, "prompts"));
    writeFileSync(join(app.profileDirectory, "prompts", "original.md"), "base description");
    writeFileSync(join(profileDirectory, "prompts", "override.md"), "profile description");
    writeFileSync(
      join(profileDirectory, "toolbox.yaml"),
      "mcpServers:\n  active:\n    toolDescriptionOverrides:\n      original: prompts/override.md\n",
    );
    writeFixtureYaml(app.profileDirectory, "toolbox", configuration);
    const overrides = { active: true, inactive: false },
      session = await app.createSession({ mcpOverrides: overrides, profile: "custom", workspace });
    await app.waitForRun(session.id);
    expect(app.requests).toHaveLength(1);
    expect(app.requests[0]).toMatchObject({
      tools: containingItems([
        partialObject({
          description: "profile description",
          name: "renamed_tool",
          type: "custom",
        }),
      ]),
    });
    using database = openStoredSession(session.id);
    const { prefix } = readDefinitionRecord(database.db, session.id);
    expect(prefix.tools.tools.find(({ name }) => name === "renamed_tool")).toMatchObject({
      description: "profile description",
      freeform: true,
    });
    expect(prefix.tools.serverOverrides).toEqual(overrides);
    writeFileSync(
      join(profileDirectory, "toolbox.yaml"),
      "mcpServers:\n  active:\n    freeformToolInputs: [unavailable]\n    toolDescriptionOverrides: { unavailable: absent.md }\n",
    );
    await using cleanup = new AsyncDisposableStack();
    const mcp = createAppMcp(app.root, "error", app.context, new AskUserRuntime(() => {}));
    cleanup.defer(() => mcp.close());
    const restored = await mcp.loadSession(
      session.id,
      database.profiles(session.id),
      prefix.tools,
      workspace,
    );
    expect(Object.keys(restored.configuration.mcpServers)).toEqual(["active"]);
    expect(restored.freeformToolParameters.get("renamed_tool")).toBe("input");
    expect(restored.tools.map(({ name }) => name)).not.toContain("unused_alias");
  },
  15_000,
);
