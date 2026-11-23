import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildSkillsList } from "../../../skills";
import type { Settings } from "../../../types";
import { resolveConfiguredPath } from "../configuredPath";
import { loadConfiguredHookRules } from "../hookRules";
import { readSettingsText } from "../placeholders";
import { safeId } from "../sessionPaths";
import { normalizeWorkspacePath } from "../workspacePath";
import { createSettingsContext, type SettingsContext } from "./context";
import { requireLayeredSettingsYaml, resolveLayeredSettingsText, userDataDirectory } from "./files";
import { prepareMainSettings } from "./models";
import {
  omitCodexConnectionSettings,
  parseAgentSettings,
  parseMainSettings,
  parseModelSettings,
} from "./schema";

interface LoadSettingsOptions {
  cwd?: string;
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
    agent = parseAgentSettings(requireLayeredSettingsYaml(context, "profile", "agent.yaml").value),
    storageDirectory = userDataDirectory(),
    session = options.sessionId
      ? resolve(storageDirectory, "sessions", safeId(options.sessionId))
      : undefined,
    placeholders = {
      deferSession: true,
      session: { cwd, session },
    },
    skills = {
      ...agent.skills,
      directory: resolveConfiguredPath(configRoot, agent.skills.directory),
    };
  let skillsList: string | undefined;
  const promptPlaceholders = {
    ...placeholders,
    dynamic: (name: string) =>
      name === "skills"
        ? {
            matched: true,
            value: (skillsList ??= buildSkillsList({ skills })),
          }
        : name === "toolOutputMaxTokens"
          ? { matched: true, value: agent.toolOutput.maxTokens }
          : { matched: false },
  };
  mkdirSync(storageDirectory, { recursive: true });
  return {
    ...main,
    agent: {
      recursionLimit: agent.recursionLimit,
      systemPrompt: agent.prompts
        .map((file) =>
          readSettingsText(
            resolveLayeredSettingsText(context, "profile", join("prompts", file)),
            promptPlaceholders,
          ).trimEnd(),
        )
        .join("\n\n"),
    },
    hooks: loadConfiguredHookRules(context, placeholders),
    model,
    skills,
    toolExecution: agent.toolExecution,
    toolOutput: agent.toolOutput,
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
