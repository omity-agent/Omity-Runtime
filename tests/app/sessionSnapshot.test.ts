import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadSessionRuntime } from "../../src/app/hosts/execution";
import { createAppMcp } from "../../src/app/runtime/resources/toolPool";
import { provisionAppSession } from "../../src/app/runtime/sessions/provision";
import { databasePath } from "../../src/infrastructure/configuration/sessionPaths";
import { settingsProfileNames } from "../../src/infrastructure/configuration/settings/context";
import { AgentDatabase } from "../../src/infrastructure/database/agentDatabase";
import { readDefinitionRecord } from "../../src/infrastructure/database/records/session/metadata";
import { removeDatabaseDirectory } from "../../src/infrastructure/database/sqlite/connection";
import { AskUserRuntime } from "../../src/infrastructure/toolbox/runtime";
import { createTestDirectory } from "../support/artifacts";
import { containingItems } from "../support/asymmetric";
import { fixtureTools } from "../support/builtins";
import { writeFixtureYaml, writeTestConfiguration } from "../support/configuration";
import { scopedEnvironment } from "../support/scopedEnvironment";

test("session snapshots lock only the model prefix while runtime configuration changes", async () => {
  await using resources = new AsyncDisposableStack();
  const root = createTestDirectory("session-snapshot"),
    { choice, open_ended } = fixtureTools,
    toolboxes = { choice, open_ended },
    rule = { input: {}, mode: "silent", runLimit: -1, target: "agent" };
  resources.defer(() => removeDatabaseDirectory(root));
  resources.use(scopedEnvironment({ OMITY_HOME: join(root, "home") }));
  const { context, profileDirectory } = writeTestConfiguration(root, {
    hooks: [
      { ...rule, enable: true, id: "notify", tool: open_ended.name, when: "after" },
      { ...rule, enable: false, id: "review", tool: choice.name, when: "before" },
    ],
    model: {
      apiKeyEnv: "INITIAL_KEY",
      baseURL: "https://locked.example.test",
      model: "locked-model",
      reasoning_effort: "medium",
      temperature: 0,
    },
    systemPrompt: "locked prompt",
  });
  writeFixtureYaml(profileDirectory, "toolbox", { toolboxes });
  const workspacePath = join(root, "workspace");
  mkdirSync(workspacePath, { recursive: true });
  mkdirSync(join(root, "home"), { recursive: true });
  const db = resources.use(new AgentDatabase(databasePath())),
    mcp = createAppMcp(root, "debug", context, new AskUserRuntime(() => {}));
  resources.defer(() => mcp.close());
  const created = await provisionAppSession({
      baseContext: context,
      database: db,
      mcp,
      root,
      submission: {
        attachments: [],
        history: [],
        hookOverrides: { notify: false, review: true },
        message: "hello",
        workspace: workspacePath,
      },
    }),
    definition = readDefinitionRecord(db.db, created.sessionId);
  writeFileSync(join(profileDirectory, "prompts", "fixture.md"), "changed prompt");
  writeFixtureYaml(profileDirectory, "model", {
    adapter: "responses-sse",
    apiKeyEnv: "CURRENT_KEY",
    baseURL: "https://changed.example.test",
    maxConcurrentRequests: 4,
    model: "changed-model",
    raceIntervalMs: 3500,
    reasoning_effort: "high",
    retryDelayMs: 2500,
    temperature: 0.75,
  });
  writeFixtureYaml(profileDirectory, "toolbox", {
    stdio: { restart: { delayMs: 4321, maxAttempts: 7 } },
    toolboxes,
  });
  expect(definition.prefix.systemPrompt).toBe("locked prompt");
  expect(definition.hookOverrides).toEqual({ notify: false, review: true });
  expect(definition.prefix.model).toEqual({
    adapter: "completions",
    baseURL: "https://locked.example.test",
    model: "locked-model",
    reasoning_effort: "medium",
  });
  expect(definition.prefix.tools).not.toHaveProperty("configuration");
  expect(definition.prefix.tools.tools.map(({ name }) => name)).toContain(
    toolboxes.open_ended.name,
  );
  const prepared = loadSessionRuntime(db, created.sessionId, workspacePath, context);
  expect(prepared.settings.agent.systemPrompt).toBe(definition.prefix.systemPrompt);
  expect(prepared.settings.hooks.map(({ id, enable }) => ({ enable, id }))).toEqual([
    { enable: false, id: "notify" },
    { enable: true, id: "review" },
  ]);
  expect(prepared.settings.model).toEqual({
    adapter: "completions",
    apiKeyEnv: "CURRENT_KEY",
    baseURL: "https://locked.example.test",
    maxConcurrentRequests: 4,
    model: "locked-model",
    raceIntervalMs: 3500,
    reasoning_effort: "medium",
    retryDelayMs: 2500,
    temperature: 0.75,
  });
  const restoredMcp = createAppMcp(root, "debug", context, new AskUserRuntime(() => {}));
  resources.defer(() => restoredMcp.close());
  const restored = await restoredMcp.loadSession(
    created.sessionId,
    settingsProfileNames(context),
    definition.prefix.tools,
    workspacePath,
  );
  expect(restored.configuration.stdio.restart).toEqual({
    delayMs: 4321,
    maxAttempts: 7,
  });
  expect(restored.tools.map(({ name }) => name)).toEqual<unknown>(
    containingItems([toolboxes.choice.name, toolboxes.open_ended.name]),
  );
});
