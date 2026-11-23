import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { stringify } from "yaml";

import { createSettingsContext } from "../../src/infrastructure/configuration/settings/context";
import { loadSettings } from "../../src/infrastructure/configuration/settings/load";
import type { Settings } from "../../src/types";
import { createTestDirectory } from "./artifacts";

interface TestConfigurationOptions {
  access?: Partial<Settings["access"]>;
  hooks?: unknown[];
  model?: Partial<Settings["model"]>;
  prediction?: unknown;
  requestBodyLimitBytes?: number;
  systemPrompt?: string;
  userDirectory?: string;
}
export function testProfiles(root: string, userDirectory = join(root, "configuration")) {
  const names = ["isolated", "fixture"],
    isolation = join(userDirectory, "profiles", "isolated"),
    profileDirectory = join(userDirectory, "profiles", "fixture");
  mkdirSync(isolation, { recursive: true });
  mkdirSync(profileDirectory, { recursive: true });
  writeFixtureYaml(userDirectory, "profile", names);
  writeFixtureYaml(isolation, "toolbox", { mcpServers: {}, toolNameOverrides: {}, toolboxes: {} });
  return { context: createSettingsContext(root, userDirectory, names), profileDirectory };
}
export function writeTestConfiguration(root: string, options: TestConfigurationOptions = {}) {
  const fixture = testProfiles(root, options.userDirectory),
    { context, profileDirectory } = fixture;
  writeFixtureYaml(context.userDirectory, "main", {
    access: { publicOrigin: null, trustedProxies: [], ...options.access },
    attachments: { allowedSuffixes: [".txt", ".md"], maxSizeBytes: 8192 },
    host: { pausePollMs: 5, pollMs: 5, shutdownTimeoutMs: 1000 },
    leases: { hostTtlMs: 60_000 },
    logging: { level: "error", streamTokens: false },
    prediction: options.prediction ?? null,
    server: { idleTimeoutSeconds: 0, requestBodyLimitBytes: options.requestBodyLimitBytes ?? 8192 },
  });
  writeFixtureYaml(profileDirectory, "model", {
    adapter: "completions",
    apiKeyEnv: "TEST_KEY",
    baseURL: null,
    maxConcurrentRequests: 1,
    model: "test",
    raceIntervalMs: 250,
    retryDelayMs: 20,
    ...options.model,
    reasoning_effort: options.model?.reasoning_effort ?? null,
    temperature: options.model ? (options.model.temperature ?? null) : 0,
  });
  writeFixtureYaml(profileDirectory, "agent", {
    prompts: options.systemPrompt === undefined ? [] : ["fixture.md"],
    recursionLimit: 50,
    skills: { enabled: false },
    toolExecution: { parallel: true },
    toolOutput: { maxTokens: 8192 },
  });
  writeFixtureYaml(profileDirectory, "hooks", { hooks: options.hooks ?? [] });
  if (options.systemPrompt !== undefined) {
    const prompts = join(profileDirectory, "prompts");
    mkdirSync(prompts, { recursive: true });
    writeFileSync(join(prompts, "fixture.md"), options.systemPrompt);
  }
  return fixture;
}
export function writeFixtureYaml(directory: string, name: string, value: unknown) {
  writeFileSync(join(directory, `${name}.yaml`), stringify(value));
}
export function testSettings() {
  const root = createTestDirectory("settings-fixture");
  try {
    const { context } = writeTestConfiguration(root, { systemPrompt: "test" });
    return loadSettings(root, { settingsContext: context });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}
