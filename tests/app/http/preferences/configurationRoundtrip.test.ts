import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { sessionOptionsSchema } from "../../../../src/app/contracts/results";
import { createAppMcp } from "../../../../src/app/runtime/resources/toolPool";
import { readDefinitionRecord } from "../../../../src/infrastructure/database/records/session/metadata";
import { AskUserRuntime } from "../../../../src/infrastructure/toolbox/runtime";
import { openStoredSession } from "../../../../src/storedSessions";
import { fixtureTools } from "../../../support/builtins";
import { writeFixtureYaml } from "../../../support/configuration";
import { liveApplication } from "../liveApplication";

test("HTTP session preferences list disabled servers without resolving secrets and preserve per-session selections", async () => {
  await using app = liveApplication();
  const optionalServer = {
      args: [resolve(import.meta.dir, "argumentServer.ts"), "identity"],
      command: process.execPath,
      enabled: false,
    },
    unavailableServer = { command: `\${OMITY_UNCONFIGURED_COMMAND}`, enabled: true },
    profileDirectory = join(app.context.userDirectory, "profiles", "alternate"),
    { choice, open_ended } = fixtureTools;
  writeFixtureYaml(app.profileDirectory, "toolbox", {
    mcpServers: { optional: optionalServer, unavailable: unavailableServer },
    toolNameOverrides: {
      [choice.name]: "prompt_choices",
      unavailable__identity: "unavailable_identity",
    },
    toolboxes: { choice: { ...choice, enabled: false }, open_ended },
  });
  mkdirSync(profileDirectory, { recursive: true });
  writeFileSync(join(profileDirectory, "model.yaml"), "model: alternate-model\n");
  writeFileSync(
    join(profileDirectory, "toolbox.yaml"),
    "mcpServers:\n  optional:\n    enabled: true\n  unavailable:\n    enabled: false\n",
  );
  const response = await fetch(`${app.url}/api/session-options`),
    responseText = await response.text();
  expect(response.status).toBe(200);
  expect(responseText).not.toContain("OMITY_UNCONFIGURED_COMMAND");
  expect(responseText).not.toContain(process.execPath);
  const options = sessionOptionsSchema.parse(JSON.parse(responseText));
  expect(options.builtInTools.find(({ id }) => id === "choice")).toMatchObject({
    enable: false,
    name: "prompt_choices",
  });
  expect(options).toMatchObject({
    hooks: [],
    mcpServers: [
      { enable: false, id: "optional" },
      { enable: true, id: "unavailable" },
    ],
    model: "test",
  });
  const profileOptions = await fetch(`${app.url}/api/session-options?profile=alternate`);
  expect(sessionOptionsSchema.parse(await profileOptions.json())).toMatchObject({
    hooks: [],
    mcpServers: [
      { enable: true, id: "optional" },
      { enable: false, id: "unavailable" },
    ],
    model: "alternate-model",
  });
  const invalidModel = await app.submitSession({ model: "   " }),
    invalidServer = await app.submitSession({
      mcpOverrides: { missing: true, unavailable: false },
    });
  expect(invalidModel.status).toBe(400);
  expect(invalidServer.status).toBe(400);
  expect(await invalidServer.json()).toMatchObject({
    error: { code: "MCP_SELECTION_INVALID" },
  });
  const overrides = { optional: true, unavailable: false },
    session = await app.createSession({
      builtInOverrides: { choice: true, open_ended: false },
      mcpOverrides: overrides,
      model: " chosen-model ",
    });
  await app.waitForRun(session.id);
  expect(app.requests).toHaveLength(1);
  expect(app.requests[0]).toMatchObject({ model: "chosen-model" });
  using database = openStoredSession(session.id);
  const { prefix } = readDefinitionRecord(database.db, session.id),
    names = prefix.tools.tools.map(({ name }) => name);
  expect(prefix.model).toMatchObject({ adapter: "completions", model: "chosen-model" });
  expect(prefix.tools.serverOverrides).toEqual(overrides);
  expect(names).toContain("optional__identity");
  expect(names).not.toContain("unavailable_identity");
  await using cleanup = new AsyncDisposableStack();
  const mcp = createAppMcp(app.root, "error", app.context, new AskUserRuntime(() => {}));
  cleanup.defer(() => mcp.close());
  const restored = await mcp.loadSession(
      session.id,
      database.profiles(session.id),
      prefix.tools,
      app.root,
    ),
    restoredNames = restored.tools.map(({ name }) => name);
  expect(Object.keys(restored.configuration.mcpServers)).toEqual(["optional"]);
  expect(restoredNames).toContain("optional__identity");
  expect(restoredNames).toContain("prompt_choices");
  expect(restoredNames).not.toContain(open_ended.name);
  const disabledSession = await app.createSession({
      mcpOverrides: { optional: false, unavailable: false },
      model: "test",
    }),
    disabled = readDefinitionRecord(database.db, disabledSession.id).prefix.tools.tools.map(
      ({ name }) => name,
    );
  expect(disabled).toContain(open_ended.name);
  expect(disabled).not.toContain("optional__identity");
}, 15_000);
