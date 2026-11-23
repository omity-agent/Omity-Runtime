import { isPlainObject as isRecord } from "es-toolkit";
import { z } from "zod";

import { DomainError } from "../../../errors";
import { localize } from "../../../i18n/server";
import { emptyAs } from "../../configuration/settings/fieldSchemas";
import { builtInPreferencesSchema } from "../../toolbox/metadata";
import { mcpServerSchema } from "./connections";

const option = z.object({ enable: z.boolean(), id: z.string().min(1) }),
  builtInPreferences = z.object({
    description: emptyAs(z.string(), ""),
    enabled: z.boolean(),
    name: z.string().min(1),
  }),
  toolboxPreferences = z.object({
    mcpServers: emptyAs(z.record(z.string().min(1), mcpServerSchema.pick({ enabled: true })), {}),
    toolNameOverrides: emptyAs(z.record(z.string(), z.string()), {}),
    toolboxes: emptyAs(
      z.partialRecord(
        builtInPreferencesSchema.keyof(),
        emptyAs(builtInPreferences.optional(), undefined),
      ),
      {},
    ),
  });
export const toolboxOptionsSchema = z.object({
  builtInTools: z.array(option.extend({ description: z.string(), name: z.string().min(1) })),
  mcpServers: z.array(option),
});
export interface ToolboxOverrides {
  builtInOverrides?: Record<string, boolean>;
  serverOverrides?: Record<string, boolean>;
}
type BuiltInMetadata = z.output<typeof builtInPreferences>;
export function describeToolbox(value: unknown) {
  const { mcpServers, toolboxes, toolNameOverrides } = toolboxPreferences.parse(value),
    aliases = new Map(Object.entries(toolNameOverrides));
  return {
    builtInTools: Object.entries<BuiltInMetadata | undefined>(toolboxes).flatMap(([id, tool]) =>
      tool
        ? [
            {
              description: tool.description,
              enable: tool.enabled,
              id,
              name: aliases.get(tool.name) ?? tool.name,
            },
          ]
        : [],
    ),
    mcpServers: Object.entries(mcpServers).map(([id, server]) => ({
      enable: server.enabled ?? true,
      id,
    })),
  };
}
export function applyToolboxOverrides(value: unknown, overrides: ToolboxOverrides): unknown {
  return applyOverrides(
    applyServerOverrides(value, overrides.serverOverrides),
    "toolboxes",
    overrides.builtInOverrides,
  );
}
export function applyServerOverrides(value: unknown, overrides?: Record<string, boolean>): unknown {
  return applyOverrides(value, "mcpServers", overrides);
}
function applyOverrides(
  value: unknown,
  group: "mcpServers" | "toolboxes",
  overrides: Record<string, boolean> = {},
): unknown {
  if (Object.keys(overrides).length === 0) {
    return value;
  }
  const entries = isRecord(value) && isRecord(value[group]) ? value[group] : {},
    builtIn = group === "toolboxes";
  for (const name of Object.keys(overrides)) {
    if (!Object.hasOwn(entries, name) || (builtIn && !isRecord(entries[name]))) {
      throw new DomainError(
        builtIn ? "BUILT_IN_SELECTION_INVALID" : "MCP_SELECTION_INVALID",
        localize(builtIn ? "mcp:configuration.builtInMissing" : "mcp:configuration.serverMissing", {
          value0: name,
        }),
      );
    }
  }
  return {
    ...z.record(z.string(), z.unknown()).parse(value),
    [group]: Object.fromEntries(
      Object.entries(entries).map(([name, entry]) => [
        name,
        Object.hasOwn(overrides, name)
          ? { ...z.record(z.string(), z.unknown()).parse(entry), enabled: overrides[name] }
          : entry,
      ]),
    ),
  };
}
