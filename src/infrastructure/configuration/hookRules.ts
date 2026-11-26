import { z } from "zod";

import { isHookOutputVariable } from "../../hooks/variables";
import { localize } from "../../i18n/server";
import type { HookRule } from "../../types";
import type { PlaceholderOptions } from "./placeholders";
import type { SettingsContext } from "./settings/context";
import { emptyAs } from "./settings/fieldSchemas";
import { readLayeredSettingsYaml } from "./settings/files";

const hookSchema = z.strictObject({
    description: emptyAs(z.string().optional(), undefined).optional(),
    enable: z.boolean().optional(),
    id: z.string().min(1),
    input: z.union([z.record(z.string(), z.unknown()), z.string()]),
    mode: z.enum(["silent", "takeover"]),
    runLimit: z.number().int().min(-1),
    target: z.string().min(1),
    tool: z.string().min(1),
    when: z.enum(["before", "after"]),
  }),
  hooksFileSchema = z
    .strictObject({ hooks: emptyAs(z.array(hookSchema), []) })
    .superRefine(({ hooks }, context) => {
      const ids = new Set<string>();
      for (const [index, hook] of hooks.entries()) {
        if (ids.has(hook.id)) {
          context.addIssue({
            code: "custom",
            message: localize("configuration:hooks.duplicateId", {
              hookId: hook.id,
            }),
            path: ["hooks", index, "id"],
          });
        }
        ids.add(hook.id);
      }
    });
export function loadConfiguredHookRules(
  context: SettingsContext,
  placeholders: Omit<PlaceholderOptions, "source"> = { deferSession: true },
): HookRule[] {
  const file = readLayeredSettingsYaml(context, "profile", "hooks.yaml", {
    ...placeholders,
    deferred: isHookOutputVariable,
  });
  if (!file) {
    throw new Error(localize("configuration:hooks.configurationMissing"));
  }
  return hooksFileSchema.parse(file.value).hooks;
}
