import { localize } from "../../i18n/server";
import { loadConfiguredHookRules } from "../../infrastructure/configuration/hookRules";
import {
  prioritizeSettingsProfile,
  type SettingsContext,
} from "../../infrastructure/configuration/settings/context";
import { readLayeredSettingsYaml } from "../../infrastructure/configuration/settings/files";
import {
  omitCodexConnectionSettings,
  parseModelSettings,
} from "../../infrastructure/configuration/settings/models";
import { readProfileToolboxOptions } from "../../infrastructure/mcp/configuration";
import type { SessionOptions } from "../contracts/results";

export function availableSessionOptions(
  context: SettingsContext,
  profile?: string,
): SessionOptions {
  const selected = prioritizeSettingsProfile(context, profile),
    modelFile = readLayeredSettingsYaml(
      selected,
      "profile",
      "model.yaml",
      {},
      {
        beforePlaceholders: omitCodexConnectionSettings,
      },
    );
  if (!modelFile) {
    throw new Error(localize("application:runtime.modelConfigMissing"));
  }
  return {
    ...readProfileToolboxOptions(selected),
    hooks: loadConfiguredHookRules(selected).map(({ id, enable, description }) => ({
      description,
      enable: enable ?? true,
      id,
    })),
    model: parseModelSettings(modelFile.value).model,
  };
}
