import { isPlainObject as isRecord } from "es-toolkit";

import { localize } from "../../../i18n/server";
import { resolveConfiguredPath } from "../../configuration/configuredPath";
import type { SettingsContext } from "../../configuration/settings/context";
import { requireLayeredSettingsYaml } from "../../configuration/settings/files";
import type { BuiltInPreferences } from "../../toolbox/metadata";
import type { McpToolSnapshot } from "../tools/definitions";
import { enableConfiguredMcpServers, omitDisabledToolboxConfiguration } from "./activation";
import { toolboxSchema } from "./declaration";
import {
  applyServerOverrides,
  applyToolboxOverrides,
  describeToolbox,
  toolboxOptionsSchema,
  type ToolboxOverrides,
} from "./selection";

export function readProfileMcpConfiguration(
  context: SettingsContext,
  overrides: ToolboxOverrides = {},
) {
  return readToolboxConfiguration(context, (value) => applyToolboxOverrides(value, overrides));
}
export function readSessionMcpConfiguration(context: SettingsContext, snapshot: McpToolSnapshot) {
  const configuration = readToolboxConfiguration(context, (value) =>
      applyServerOverrides(enableConfiguredMcpServers(value), snapshot.serverOverrides),
    ),
    names = new Set(snapshot.tools.map(({ name }) => name));
  for (const preferences of Object.values<BuiltInPreferences[keyof BuiltInPreferences]>(
    configuration.toolboxes,
  )) {
    if (preferences) {
      preferences.enabled = names.has(
        configuration.toolNameOverrides[preferences.name] ?? preferences.name,
      );
    }
  }
  return configuration;
}
function readToolboxConfiguration(
  context: SettingsContext,
  selectTools: (value: unknown) => unknown,
) {
  const file = requireLayeredSettingsYaml(
    context,
    "profile",
    "toolbox.yaml",
    {},
    {
      beforePlaceholders: (value) => omitDisabledToolboxConfiguration(selectTools(value)),
      override: resolveProfilePaths,
    },
  );
  return parseMcpConfiguration(file.value, file.path);
}
export function readProfileToolboxOptions(context: SettingsContext) {
  return toolboxOptionsSchema.parse(
    requireLayeredSettingsYaml(
      context,
      "profile",
      "toolbox.yaml",
      {},
      {
        beforePlaceholders: describeToolbox,
      },
    ).value,
  );
}
function parseMcpConfiguration(parsed: unknown, path: string) {
  return toolboxSchema.parse(omitDisabledToolboxConfiguration(parsed), {
    error: (issue) =>
      issue.code === "invalid_type" && issue.input === parsed
        ? localize("mcp:configuration.entryMustBeObject", { path })
        : undefined,
  });
}
export type McpConfiguration = ReturnType<typeof parseMcpConfiguration>;
function resolveProfilePaths(value: unknown, override: unknown, directory: string): unknown {
  if (
    !isRecord(value) ||
    !isRecord(value["mcpServers"]) ||
    !isRecord(override) ||
    !isRecord(override["mcpServers"])
  ) {
    return value;
  }
  const overrides: Record<string, unknown> = override["mcpServers"];
  return {
    ...value,
    mcpServers: Object.fromEntries(
      Object.entries(value["mcpServers"]).map(([serverName, server]) => {
        const serverOverride = overrides[serverName];
        if (
          !isRecord(server) ||
          !isRecord(server["toolDescriptionOverrides"]) ||
          !isRecord(serverOverride) ||
          !isRecord(serverOverride["toolDescriptionOverrides"])
        ) {
          return [serverName, server];
        }
        const paths: Record<string, unknown> = { ...server["toolDescriptionOverrides"] };
        for (const tool of Object.keys(serverOverride["toolDescriptionOverrides"])) {
          const path = paths[tool];
          if (typeof path === "string" && path.length > 0) {
            paths[tool] = resolveConfiguredPath(directory, path);
          }
        }
        return [serverName, { ...server, toolDescriptionOverrides: paths }];
      }),
    ),
  };
}
