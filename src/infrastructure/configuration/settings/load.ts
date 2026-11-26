import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { isPlainObject, omit } from "es-toolkit";

import type { Settings } from "../../../types";
import { resolveConfiguredPath } from "../configuredPath";
import { loadConfiguredHookRules } from "../hookRules";
import { readSettingsText } from "../placeholders";
import { composeSystemPrompt, type PromptComposition } from "../prompts/compose";
import { safeId } from "../sessionPaths";
import { normalizeWorkspacePath } from "../workspacePath";
import { createSettingsContext, type SettingsContext } from "./context";
import { requireLayeredSettingsYaml, resolveLayeredSettingsText, userDataDirectory } from "./files";
import { prepareMainSettings } from "./models";
import {
  omitCodexConnectionSettings,
  parseAgentSettings,
  parseAppSettings,
  parseMainSettings,
  parseModelSettings,
} from "./schema";

interface LoadSettingsOptions {
  cwd?: string;
  prompt?: PromptComposition | { content: string; kind: "snapshot" };
  sessionId?: string;
  settingsContext?: SettingsContext;
  userSettingsDir?: string;
}
export function loadSettings(root = process.cwd(), options: LoadSettingsOptions = {}): Settings {
  const configRoot = resolve(root),
    cwd = normalizeWorkspacePath(options.cwd ?? configRoot, configRoot),
    context = options.settingsContext ?? createSettingsContext(configRoot, options.userSettingsDir),
    model = loadModelSettings(context),
    main = loadMainSettings(context, model),
    agent = loadAgentSettings(context),
    storageDirectory = userDataDirectory(),
    session = options.sessionId
      ? resolve(storageDirectory, "sessions", safeId(options.sessionId))
      : undefined,
    placeholders = {
      deferSession: true,
      session: { cwd, session },
    };
  mkdirSync(storageDirectory, { recursive: true });
  return {
    ...main,
    agent: {
      recursionLimit: agent.recursionLimit,
      systemPrompt:
        options.prompt?.kind === "snapshot"
          ? options.prompt.content
          : composeSystemPrompt(context, agent, placeholders, options.prompt),
    },
    hooks: loadConfiguredHookRules(context, placeholders),
    model,
    toolExecution: agent.toolExecution,
    toolOutput: agent.toolOutput,
  };
}
export function loadAgentSettings(context: SettingsContext) {
  const agent = parseAgentSettings(
    requireLayeredSettingsYaml(context, "profile", "agent.yaml").value,
  );
  return {
    ...agent,
    skills: {
      ...agent.skills,
      directory: resolveConfiguredPath(context.root, agent.skills.directory),
    },
  };
}
export function loadModelSettings(context: SettingsContext) {
  return parseModelSettings(
    requireLayeredSettingsYaml(
      context,
      "profile",
      "model.yaml",
      {},
      { beforePlaceholders: omitCodexConnectionSettings },
    ).value,
  );
}
export function loadAppSettings(context: SettingsContext) {
  const { value } = requireLayeredSettingsYaml(
    context,
    "global",
    "main.yaml",
    {},
    {
      beforePlaceholders: (settings) =>
        isPlainObject(settings) ? omit(settings, ["prediction"]) : settings,
    },
  );
  return parseAppSettings(value);
}
export function loadMainSettings(context: SettingsContext, model: Settings["model"]) {
  return parseMainSettings(
    requireLayeredSettingsYaml(
      context,
      "global",
      "main.yaml",
      {
        dynamic: (name) =>
          name === "predictionTask"
            ? {
                matched: true,
                value: readSettingsText(
                  resolveLayeredSettingsText(context, "global", "prompts/prediction.md"),
                  {},
                ).trimEnd(),
              }
            : { matched: false },
      },
      { beforePlaceholders: (value) => prepareMainSettings(value, model) },
    ).value,
    model,
  );
}
