import { expect, test } from "bun:test";
import { resolve } from "node:path";

import { submissionForm } from "../../../../src/app/attachments/submission";
import { containingItems, containingText, partialObject } from "../../../support/asymmetric";
import { writeFixtureYaml } from "../../../support/configuration";
import { liveApplication } from "../liveApplication";

test.each(["freeformToolInputs", "toolDescriptionOverrides"] as const)(
  "enabled MCP validates original tool names in %s",
  async (field) => {
    await using app = liveApplication();
    writeFixtureYaml(app.profileDirectory, "toolbox", {
      mcpServers: {
        active: {
          args: [resolve(import.meta.dir, "argumentServer.ts"), "original"],
          command: process.execPath,
          [field]:
            field === "freeformToolInputs" ? ["renamed_tool"] : { renamed_tool: "absent.md" },
        },
      },
      toolNameOverrides: { active__original: "renamed_tool" },
    });
    const response = await fetch(`${app.url}/api/sessions`, {
      body: submissionForm({ history: [], message: "hello", workspace: app.root }, []),
      method: "POST",
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: {
        code: "MCP_LOAD_FAILED",
        details: {
          failures: containingItems([
            partialObject({
              error: partialObject({
                message: containingText("不存在的工具：renamed_tool"),
              }),
              server: "active",
              stage: "customization",
            }),
          ]),
        },
      },
    });
    expect(app.requests).toHaveLength(0);
  },
  15_000,
);
test("all disabled MCP customizations and unavailable global renames are ignored with no tools loaded", async () => {
  await using app = liveApplication();
  writeFixtureYaml(app.profileDirectory, "toolbox", {
    mcpServers: {
      inactive: {
        command: `\${OMITY_INACTIVE_COMMAND}`,
        freeformToolInputs: ["unavailable"],
        prefixToolNameWithServerName: false,
        toolDescriptionOverrides: { unavailable: `\${OMITY_INACTIVE_DESCRIPTION}` },
      },
    },
    toolNameOverrides: { unavailable: "ignored_alias" },
  });
  const response = await fetch(`${app.url}/api/sessions`, {
    body: submissionForm(
      {
        history: [],
        mcpOverrides: { inactive: false },
        message: "hello",
        workspace: app.root,
      },
      [],
    ),
    method: "POST",
  });
  expect(response.status).toBe(200);
});
